import io
import json
import shutil
import tempfile
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image, ImageDraw
from rest_framework.test import APITestCase

from . import ai_client
from .models import Exam, ExamImport, Question

TEST_MEDIA = tempfile.mkdtemp()


def make_photo_pdf(page_count=2):
    """An image-only PDF (no text layer), like phone photos of exam pages."""
    pages = []
    for number in range(1, page_count + 1):
        image = Image.new('RGB', (850, 1100), (238, 236, 228))
        draw = ImageDraw.Draw(image)
        draw.text((60, 80), f'{number}. Which data structure is LIFO?', fill=(20, 20, 20))
        for row, choice in enumerate(['A. Queue', 'B. Stack', 'C. Tree', 'D. Graph']):
            draw.text((90, 130 + row * 30), choice, fill=(20, 20, 20))
        pages.append(image)
    buffer = io.BytesIO()
    pages[0].save(buffer, format='PDF', save_all=True, append_images=pages[1:])
    return buffer.getvalue()


def ai_reply(questions, title=''):
    return json.dumps({'title': title, 'questions': questions}), 'stop'


AI_QUESTION = {
    'question': '1. Which data structure is LIFO?',
    'choices': ['A. Queue', 'B. Stack', 'C. Tree', 'D. Graph'],
    'correctAnswer': 'B',
    'explanation': 'A stack removes the most recently added item first.',
    'subject': 'data structure and algorithms',
    'topic': 'Stacks',
}


@override_settings(
    MEDIA_ROOT=TEST_MEDIA,
    AI_API_KEY='server-secret-key',
    AI_MODEL='vision-model',
    AI_BASE_URL='https://ai.example.test/v1',
    EXAM_IMPORT_RUN_INLINE=True,
    EXAM_IMPORT_PAGES_PER_BATCH=1,
)
class ExamImportTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.token_a = self.signup('importer_a')
        self.token_b = self.signup('importer_b')

    def signup(self, username):
        response = self.client.post('/api/auth/signup/', {'username': username, 'password': 'study-hard-2026'}, format='json')
        return response.data['token']

    def as_user(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    def upload(self, data=None, name='model-exam.pdf', title=''):
        file = SimpleUploadedFile(name, data if data is not None else make_photo_pdf(), content_type='application/pdf')
        return self.client.post('/api/exam-imports/', {'file': file, 'title': title}, format='multipart')

    def upload_and_extract(self, replies):
        self.as_user(self.token_a)
        upload = self.upload()
        self.assertEqual(upload.status_code, 201, upload.data)
        with mock.patch.object(ai_client, 'chat_completion', side_effect=replies) as chat:
            response = self.client.post(f"/api/exam-imports/{upload.data['id']}/extract/")
        return upload.data['id'], response, chat

    def test_endpoints_require_auth(self):
        self.client.credentials()
        for method, url in [
            ('get', '/api/exam-imports/'),
            ('post', '/api/exam-imports/'),
            ('get', '/api/exam-imports/1/'),
            ('post', '/api/exam-imports/1/extract/'),
            ('post', '/api/exam-imports/1/publish/'),
            ('delete', '/api/exam-imports/1/'),
        ]:
            with self.subTest(method=method, url=url):
                self.assertEqual(getattr(self.client, method)(url).status_code, 401)

    def test_upload_rejects_non_pdf(self):
        self.as_user(self.token_a)
        response = self.upload(data=b'not a pdf at all', name='notes.pdf')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ExamImport.objects.count(), 0)

    def test_extract_normalizes_ai_output_into_reviewable_draft(self):
        import_id, response, chat = self.upload_and_extract([
            ai_reply([AI_QUESTION], title='AAU Model Exam'),
            ai_reply([{**AI_QUESTION, 'question': 'Q2) What is a queue?', 'choices': ['FIFO', 'LIFO'],
                       'correctAnswer': 'Answer: a', 'subject': 'Astrology'}]),
        ])
        self.assertEqual(response.status_code, 202)
        self.assertEqual(chat.call_count, 2)  # one AI call per page batch

        data = self.client.get(f'/api/exam-imports/{import_id}/').data
        self.assertEqual(data['status'], 'ready')
        self.assertEqual(data['pagesProcessed'], 2)
        self.assertEqual(data['title'], 'AAU Model Exam')
        first, second = data['questions']
        self.assertEqual(first['question'], 'Which data structure is LIFO?')
        self.assertEqual(first['choices'], ['Queue', 'Stack', 'Tree', 'Graph'])
        self.assertEqual(first['correctAnswer'], 'Stack')
        self.assertEqual(first['subject'], 'Data Structures and Algorithms')
        self.assertEqual(first['sourcePages'], [1])
        self.assertEqual(first['issues'], [])
        self.assertEqual(second['question'], 'What is a queue?')
        self.assertEqual(second['correctAnswer'], 'FIFO')
        self.assertEqual(second['subject'], '')
        self.assertIn('Pick a subject from the official list.', second['issues'])
        self.assertEqual(Question.objects.count(), 0)  # nothing is saved before publish

        user_content = chat.call_args_list[0].args[0][1]['content']
        self.assertTrue(any(part.get('type') == 'image_url' and part['image_url']['url'].startswith('data:image/jpeg;base64,')
                            for part in user_content))

    def test_bad_ai_json_is_retried_once_then_fails_with_clear_error(self):
        import_id, response, chat = self.upload_and_extract([
            ('Sure! Here are the questions:', 'stop'),
            ('```json\n{"questions": [', 'length'),
        ])
        self.assertEqual(chat.call_count, 2)
        data = self.client.get(f'/api/exam-imports/{import_id}/').data
        self.assertEqual(data['status'], 'failed')
        self.assertEqual(data['pagesProcessed'], 0)
        self.assertIn('unreadable answer for pages 1-1', data['error'])
        self.assertIn('Retry', data['error'])
        self.assertEqual(data['questions'], [])

        with mock.patch.object(ai_client, 'chat_completion', side_effect=[
            ('not json', 'stop'), ai_reply([AI_QUESTION]), ai_reply([]),
        ]):
            retry = self.client.post(f'/api/exam-imports/{import_id}/extract/')
        self.assertEqual(retry.status_code, 202)
        data = self.client.get(f'/api/exam-imports/{import_id}/').data
        self.assertEqual(data['status'], 'ready')
        self.assertEqual(len(data['questions']), 1)

    def test_rejected_api_key_fails_without_retry(self):
        import_id, _response, chat = self.upload_and_extract(ai_client.AIConfigError('The AI provider rejected the server API key (check AI_API_KEY).'))
        self.assertEqual(chat.call_count, 1)
        data = self.client.get(f'/api/exam-imports/{import_id}/').data
        self.assertEqual(data['status'], 'failed')
        self.assertIn('AI_API_KEY', data['error'])
        self.assertNotIn('server-secret-key', json.dumps(data))

    @override_settings(AI_API_KEY='')
    def test_extract_reports_missing_ai_configuration(self):
        self.as_user(self.token_a)
        upload = self.upload()
        response = self.client.post(f"/api/exam-imports/{upload.data['id']}/extract/")
        self.assertEqual(response.status_code, 503)
        self.assertIn('not configured', response.data['error'])

    def test_publish_creates_exam_owned_by_user_and_is_all_or_nothing(self):
        import_id, _response, _chat = self.upload_and_extract([ai_reply([AI_QUESTION]), ai_reply([])])
        draft = self.client.get(f'/api/exam-imports/{import_id}/').data['questions']

        bad = self.client.post(f'/api/exam-imports/{import_id}/publish/', {
            'title': 'My exam', 'questions': draft + [{**draft[0], 'question': 'Other?', 'correctAnswer': 'Not a choice'}],
        }, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.data['questionErrors'], [{'index': 1, 'errors': ['Correct answer must be one of the choices.']}])
        self.assertEqual(Question.objects.count(), 0)
        self.assertEqual(Exam.objects.count(), 0)

        edited = {**draft[0], 'question': 'Which structure is LIFO? (edited)', 'questionId': 'client-id'}
        published = self.client.post(f'/api/exam-imports/{import_id}/publish/', {
            'title': 'Reviewed exam', 'questions': [edited],
        }, format='json')
        self.assertEqual(published.status_code, 201, published.data)
        exam = Exam.objects.get(exam_id=published.data['exam']['examId'])
        self.assertEqual(exam.owner.username, 'importer_a')
        self.assertEqual(exam.title, 'Reviewed exam')
        question = Question.objects.get(question_id=exam.question_ids[0])
        self.assertEqual(question.owner.username, 'importer_a')
        self.assertEqual(question.question, 'Which structure is LIFO? (edited)')
        self.assertNotEqual(question.question_id, 'client-id')

        exam_import = ExamImport.objects.get(pk=import_id)
        self.assertEqual(exam_import.status, 'published')
        self.assertFalse(exam_import.pdf)
        again = self.client.post(f'/api/exam-imports/{import_id}/publish/', {'title': 'x', 'questions': [edited]}, format='json')
        self.assertEqual(again.status_code, 409)

        # The published exam works with the existing exam/question endpoints.
        self.assertEqual(self.client.get('/api/exams/').data['count'], 1)
        self.assertEqual(len(self.client.post('/api/questions/bulk/', {'questionIds': exam.question_ids}, format='json').data), 1)

    def test_other_user_cannot_see_or_touch_import_or_resulting_exam(self):
        import_id, _response, _chat = self.upload_and_extract([ai_reply([AI_QUESTION]), ai_reply([])])
        draft = self.client.get(f'/api/exam-imports/{import_id}/').data['questions']

        self.as_user(self.token_b)
        self.assertEqual(self.client.get('/api/exam-imports/').data['count'], 0)
        self.assertEqual(self.client.get(f'/api/exam-imports/{import_id}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/exam-imports/{import_id}/extract/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/exam-imports/{import_id}/publish/', {
            'title': 'stolen', 'questions': draft,
        }, format='json').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/exam-imports/{import_id}/').status_code, 404)
        self.assertTrue(ExamImport.objects.filter(pk=import_id).exists())

        self.as_user(self.token_a)
        published = self.client.post(f'/api/exam-imports/{import_id}/publish/', {'title': 'Mine', 'questions': draft}, format='json')
        exam_id = published.data['exam']['examId']

        self.as_user(self.token_b)
        self.assertEqual(self.client.get('/api/exams/').data['count'], 0)
        self.assertEqual(self.client.get(f'/api/exams/{exam_id}/').status_code, 404)
        self.assertEqual(self.client.get('/api/questions/').data['count'], 0)


@override_settings(AI_API_KEY='server-secret-key', AI_MODEL='vision-model', AI_BASE_URL='https://ai.example.test/v1')
class AIClientTests(APITestCase):
    def test_sends_openai_compatible_request_with_server_key(self):
        response = mock.Mock(status_code=200, ok=True)
        response.json.return_value = {'choices': [{'message': {'content': '{"questions": []}'}, 'finish_reason': 'stop'}]}
        with mock.patch('api.ai_client.requests.post', return_value=response) as post:
            text, finish_reason = ai_client.chat_completion([{'role': 'user', 'content': 'hi'}])
        self.assertEqual((text, finish_reason), ('{"questions": []}', 'stop'))
        url, kwargs = post.call_args.args[0], post.call_args.kwargs
        self.assertEqual(url, 'https://ai.example.test/v1/chat/completions')
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer server-secret-key')
        self.assertEqual(kwargs['json']['model'], 'vision-model')

    def test_maps_provider_errors(self):
        for status_code, error in [(401, ai_client.AIConfigError), (429, ai_client.AIUnavailableError), (503, ai_client.AIUnavailableError)]:
            response = mock.Mock(status_code=status_code, ok=False)
            response.json.return_value = {}
            with self.subTest(status_code=status_code), mock.patch('api.ai_client.requests.post', return_value=response):
                with self.assertRaises(error):
                    ai_client.chat_completion([])
