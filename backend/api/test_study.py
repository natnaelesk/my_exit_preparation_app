import json
import shutil
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from . import ai_client
from .models import DailyPlan, Question, StudyDoc, StudyMessage, StudySession
from .test_exam_import import make_photo_pdf

TEST_MEDIA = tempfile.mkdtemp()


def make_text_pdf(lines):
    """A one-page PDF with a real text layer."""
    stream = 'BT /F1 12 Tf 50 750 Td 14 TL ' + ' '.join(
        '(' + line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)') + ") '" for line in lines
    ) + ' ET'
    objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R '
        '/Resources << /Font << /F1 5 0 R >> >> >>',
        f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    out, offsets = '%PDF-1.4\n', []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f'{number} 0 obj\n{body}\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'
    out += ''.join(f'{offset:010d} 00000 n \n' for offset in offsets)
    out += f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'
    return out.encode('latin-1')


def description_reply(**overrides):
    data = {
        'title': 'Normalization Notes',
        'description': 'Covers 1NF, 2NF, 3NF and BCNF with worked examples of removing anomalies.',
        'subject': 'fundamentals of database systems',
        'topics': ['Normalization', 'Functional dependencies', 'BCNF'],
        'keyPoints': ['3NF removes transitive dependencies'],
    }
    data.update(overrides)
    return json.dumps(data), 'stop'


@override_settings(
    MEDIA_ROOT=TEST_MEDIA,
    AI_API_KEY='server-secret-key',
    AI_MODEL='vision-model',
    AI_BASE_URL='https://ai.example.test/v1',
    AI_JOBS_RUN_INLINE=True,
)
class StudyTestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.token_a = self.signup('student_a')
        self.token_b = self.signup('student_b')
        self.user_a = get_user_model().objects.get(username='student_a')

    def signup(self, username):
        response = self.client.post('/api/auth/signup/', {'username': username, 'password': 'study-hard-2026'}, format='json')
        return response.data['token']

    def as_user(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    def upload_doc(self, data=None, name='normalization.pdf', reply=None):
        file = SimpleUploadedFile(name, data if data is not None else make_photo_pdf(1), content_type='application/pdf')
        with mock.patch.object(ai_client, 'chat_completion', return_value=reply or description_reply()) as ai:
            response = self.client.post('/api/study-docs/', {'file': file}, format='multipart')
        return response, ai


class StudyDocTests(StudyTestCase):
    def test_upload_stores_doc_and_ai_description(self):
        self.as_user(self.token_a)
        response, ai = self.upload_doc(make_text_pdf(['Third normal form removes transitive dependencies.']))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['title'], 'Normalization Notes')
        self.assertIn('BCNF', response.data['description'])
        self.assertEqual(response.data['subject'], 'Database Systems')
        self.assertEqual(response.data['topics'], ['Normalization', 'Functional dependencies', 'BCNF'])
        self.assertTrue(response.data['fileAvailable'])
        doc = StudyDoc.objects.get(pk=response.data['id'])
        self.assertEqual(doc.owner, self.user_a)
        self.assertIn('transitive dependencies', doc.text_excerpt)

        user_content = ai.call_args.args[0][1]['content']
        self.assertTrue(any(part['type'] == 'image_url' for part in user_content))
        self.assertIn('transitive dependencies', user_content[0]['text'])

    def test_other_user_cannot_list_download_or_touch_doc(self):
        self.as_user(self.token_a)
        doc_id = self.upload_doc()[0].data['id']

        self.as_user(self.token_b)
        self.assertEqual(self.client.get('/api/study-docs/').data, [])
        self.assertEqual(self.client.get(f'/api/study-docs/{doc_id}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/study-docs/{doc_id}/file/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/study-docs/{doc_id}/describe/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/study-docs/{doc_id}/').status_code, 404)
        self.assertTrue(StudyDoc.objects.filter(pk=doc_id).exists())

        self.client.credentials()
        self.assertEqual(self.client.get('/api/study-docs/').status_code, 401)
        self.assertEqual(self.client.get(f'/api/study-docs/{doc_id}/file/').status_code, 401)

    def test_owner_can_download_and_delete(self):
        self.as_user(self.token_a)
        pdf = make_photo_pdf(1)
        doc_id = self.upload_doc(pdf, name='my notes.pdf')[0].data['id']

        response = self.client.get(f'/api/study-docs/{doc_id}/file/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('my notes.pdf', response['Content-Disposition'])
        self.assertEqual(b''.join(response.streaming_content), pdf)

        path = StudyDoc.objects.get(pk=doc_id).file.path
        self.assertEqual(self.client.delete(f'/api/study-docs/{doc_id}/').status_code, 204)
        self.assertFalse(StudyDoc.objects.filter(pk=doc_id).exists())
        with self.assertRaises(FileNotFoundError):
            open(path, 'rb')

    def test_rejects_non_pdf(self):
        self.as_user(self.token_a)
        response, ai = self.upload_doc(b'not a pdf', name='notes.pdf')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'That file is not a PDF.')
        ai.assert_not_called()

    def test_ai_failure_is_retry_friendly(self):
        self.as_user(self.token_a)
        file = SimpleUploadedFile('notes.pdf', make_photo_pdf(1), content_type='application/pdf')
        with mock.patch.object(ai_client, 'chat_completion', side_effect=ai_client.AIUnavailableError('busy')):
            response = self.client.post('/api/study-docs/', {'file': file}, format='multipart')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'failed')
        self.assertIn('retry', response.data['error'])
        self.assertEqual(response.data['title'], 'notes')

        with mock.patch.object(ai_client, 'chat_completion', return_value=description_reply()):
            retry = self.client.post(f'/api/study-docs/{response.data["id"]}/describe/')
        self.assertEqual(retry.status_code, 202)
        self.assertEqual(retry.data['status'], 'ready')
        self.assertEqual(retry.data['error'], '')

    @override_settings(AI_API_KEY='')
    def test_upload_without_ai_config_saves_doc_with_clear_error(self):
        self.as_user(self.token_a)
        response, ai = self.upload_doc()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'failed')
        self.assertIn('not configured', response.data['error'])
        ai.assert_not_called()
        retry = self.client.post(f'/api/study-docs/{response.data["id"]}/describe/')
        self.assertEqual(retry.status_code, 503)


class StudySessionTests(StudyTestCase):
    def make_plan(self, date_key='2026-10-03'):
        topics = ['Normalization', 'Normalization', 'Transactions', 'General']
        ids = []
        for index, topic in enumerate(topics):
            question = Question.objects.create(
                question_id=f'q_study_{index}', owner=self.user_a, question=f'Q{index}?',
                choices=['A', 'B'], correct_answer='A', subject='Database Systems', topic=topic,
            )
            ids.append(question.question_id)
        return DailyPlan.objects.create(
            owner=self.user_a, date_key=date_key, focus_subject='Database Systems', question_ids=ids,
        )

    def open_plan_session(self, date_key='2026-10-03'):
        return self.client.post('/api/study-sessions/', {'planDateKey': date_key}, format='json')

    def test_plan_session_is_created_once_with_plan_topics(self):
        self.make_plan()
        self.as_user(self.token_a)
        first = self.open_plan_session()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['subject'], 'Database Systems')
        self.assertEqual(first.data['topics'], ['Normalization', 'Transactions'])
        self.assertEqual(first.data['planDateKey'], '2026-10-03')
        self.assertEqual(first.data['messages'], [])

        again = self.open_plan_session()
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data['id'], first.data['id'])
        self.assertEqual(self.open_plan_session('2026-10-04').status_code, 400)

    def test_messages_persist_and_use_protocol_and_relevant_docs(self):
        self.make_plan()
        self.as_user(self.token_a)
        relevant_id = self.upload_doc()[0].data['id']
        self.upload_doc(name='networks.pdf', reply=description_reply(
            title='OSI Model', description='The seven OSI layers and TCP/IP.', subject='computer networking',
            topics=['OSI model', 'TCP/IP'], keyPoints=[],
        ))
        session = self.open_plan_session().data
        self.assertEqual([m['id'] for m in session['materials']], [relevant_id])

        with mock.patch.object(ai_client, 'chat_completion', return_value=('## Chunk 1 of 4: Why normalize', 'stop')) as ai:
            response = self.client.post(f'/api/study-sessions/{session["id"]}/messages/', {'content': 'Start'}, format='json')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['status'], 'idle')

        system = ai.call_args.args[0][0]['content']
        for phrase in ['EXACTLY 4', 'Memory Lock', 'Exam Traps', 'Likely Questions', '"continue"',
                       'Normalization, Transactions', 'Normalization Notes', 'BCNF']:
            self.assertIn(phrase, system)
        self.assertNotIn('OSI', system)
        self.assertEqual(ai.call_args.args[0][1:], [{'role': 'user', 'content': 'Start'}])

        with mock.patch.object(ai_client, 'chat_completion', return_value=('## Chunk 2 of 4', 'stop')) as ai:
            self.client.post(f'/api/study-sessions/{session["id"]}/messages/', {'content': 'continue'}, format='json')
        self.assertEqual([m['role'] for m in ai.call_args.args[0][1:]], ['user', 'assistant', 'user'])

        reloaded = self.client.get(f'/api/study-sessions/{session["id"]}/')
        self.assertEqual(
            [(m['role'], m['content']) for m in reloaded.data['messages']],
            [('user', 'Start'), ('assistant', '## Chunk 1 of 4: Why normalize'),
             ('user', 'continue'), ('assistant', '## Chunk 2 of 4')],
        )
        self.assertEqual(len(self.client.get('/api/study-sessions/').data), 1)

    def test_other_user_cannot_see_or_use_session(self):
        self.make_plan()
        self.as_user(self.token_a)
        session_id = self.open_plan_session().data['id']

        self.as_user(self.token_b)
        self.assertEqual(self.client.get('/api/study-sessions/').data, [])
        self.assertEqual(self.client.get(f'/api/study-sessions/{session_id}/').status_code, 404)
        with mock.patch.object(ai_client, 'chat_completion') as ai:
            response = self.client.post(f'/api/study-sessions/{session_id}/messages/', {'content': 'hi'}, format='json')
        self.assertEqual(response.status_code, 404)
        ai.assert_not_called()
        self.assertEqual(self.client.post(f'/api/study-sessions/{session_id}/retry/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/study-sessions/{session_id}/').status_code, 404)
        # Another user's plan day is not visible either.
        self.assertEqual(self.open_plan_session().status_code, 400)
        self.assertEqual(StudyMessage.objects.count(), 0)

    def test_failed_reply_can_be_retried(self):
        self.as_user(self.token_a)
        session = self.client.post('/api/study-sessions/', {'subject': 'Operating System', 'topic': 'Deadlock'}, format='json').data
        self.assertEqual(session['topics'], ['Deadlock'])

        with mock.patch.object(ai_client, 'chat_completion', side_effect=ai_client.AIUnavailableError('down')):
            failed = self.client.post(f'/api/study-sessions/{session["id"]}/messages/', {'content': 'Start'}, format='json')
        self.assertEqual(failed.data['status'], 'failed')
        self.assertIn('Retry', failed.data['error'])
        self.assertEqual(len(failed.data['messages']), 1)

        with mock.patch.object(ai_client, 'chat_completion', return_value=('## Chunk 1 of 4: Conditions', 'stop')):
            retried = self.client.post(f'/api/study-sessions/{session["id"]}/retry/')
        self.assertEqual(retried.status_code, 202)
        self.assertEqual(retried.data['status'], 'idle')
        self.assertEqual([m['role'] for m in retried.data['messages']], ['user', 'assistant'])
        self.assertEqual(self.client.post(f'/api/study-sessions/{session["id"]}/retry/').status_code, 409)

    def test_busy_session_rejects_new_messages(self):
        self.as_user(self.token_a)
        session = self.client.post('/api/study-sessions/', {'subject': 'Compiler Design', 'topic': 'Parsing'}, format='json').data
        StudySession.objects.filter(pk=session['id']).update(status=StudySession.STATUS_THINKING)
        response = self.client.post(f'/api/study-sessions/{session["id"]}/messages/', {'content': 'continue'}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(StudyMessage.objects.count(), 0)

    @override_settings(AI_API_KEY='')
    def test_message_without_ai_config_is_rejected_clearly(self):
        self.as_user(self.token_a)
        session = self.client.post('/api/study-sessions/', {'subject': 'Compiler Design', 'topic': 'Parsing'}, format='json').data
        response = self.client.post(f'/api/study-sessions/{session["id"]}/messages/', {'content': 'Start'}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertIn('not configured', response.data['error'])
        self.assertEqual(StudyMessage.objects.count(), 0)
