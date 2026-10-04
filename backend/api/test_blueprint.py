import copy
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
from .curriculum import match_course
from .models import BlueprintImport, SubjectPriority, UserBlueprint
from .study_chat import build_messages, get_or_create_session, topic_context
from .test_exam_import import make_photo_pdf
from .test_helpers import SAMPLE_DRAFT, give_curriculum

TEST_MEDIA = tempfile.mkdtemp()

PAGE_ONE = {
    'programName': 'Civil Engineering',
    'themes': [{'name': 'Structures', 'creditHours': 14, 'itemShare': 40, 'courses': [
        {'name': 'Structural Analysis I', 'creditHours': 3, 'itemCount': 8, 'weight': None, 'focusNotes': ''},
        {'name': 'Reinforced Concrete', 'creditHours': 3, 'itemCount': None, 'weight': None, 'focusNotes': ''},
    ]}],
}
PAGE_TWO = {
    'programName': 'Civil Engineering',
    'themes': [
        {'name': 'Structures', 'courses': [
            {'name': 'reinforced concrete', 'itemCount': 12, 'focusNotes': ['Beam design', 'Column interaction']},
        ]},
        {'name': 'Water', 'creditHours': 6, 'itemShare': 20, 'courses': [
            {'name': 'Hydraulics', 'creditHours': 3, 'itemCount': 6, 'focusNotes': '- Open channel flow'},
        ]},
    ],
}


@override_settings(
    MEDIA_ROOT=TEST_MEDIA,
    CURSOR_API_KEY='crsr_server-secret-key',
    AI_JOBS_RUN_INLINE=True,
    BLUEPRINT_IMPORT_PAGES_PER_BATCH=1,
)
class BlueprintTestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.token_a = self.signup('planner_a')
        self.token_b = self.signup('planner_b')
        self.user_a = get_user_model().objects.get(username='planner_a')
        self.user_b = get_user_model().objects.get(username='planner_b')

    def signup(self, username):
        response = self.client.post('/api/auth/signup/', {'username': username, 'password': 'study-hard-2026'}, format='json')
        return response.data['token']

    def as_user(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    def upload(self):
        file = SimpleUploadedFile('blueprint.pdf', make_photo_pdf(), content_type='application/pdf')
        return self.client.post('/api/blueprint-imports/', {'file': file}, format='multipart')

    def upload_and_extract(self):
        self.as_user(self.token_a)
        upload = self.upload()
        self.assertEqual(upload.status_code, 201, upload.data)
        replies = [json.dumps(PAGE_ONE), json.dumps(PAGE_TWO)]
        with mock.patch.object(ai_client, 'complete', side_effect=replies) as chat:
            started = self.client.post(f"/api/blueprint-imports/{upload.data['id']}/extract/")
        self.assertEqual(started.status_code, 202, started.data)
        return upload.data['id'], chat


class NoSeedTests(BlueprintTestCase):
    def test_new_user_has_zero_subjects_and_nothing_is_seeded(self):
        self.as_user(self.token_a)
        self.assertEqual(self.client.get('/api/subject-priorities/').data, [])
        self.assertEqual(self.client.get('/api/subjects/').data, [])
        self.assertEqual(self.client.get('/api/analytics/subjects/').data, {})
        self.assertEqual(self.client.get('/api/blueprint/').status_code, 404)
        self.assertEqual(self.client.get('/api/blueprints/').data, [])
        self.client.patch('/api/subject-priorities/reorder/', {'order': ['Database Systems']}, format='json')
        self.assertFalse(SubjectPriority.objects.exists())

    def test_new_endpoints_require_auth(self):
        give_curriculum(self.user_a)
        blueprint_id = UserBlueprint.objects.get(owner=self.user_a).id
        self.client.credentials()
        for method, url in [
            ('get', '/api/blueprint-imports/'),
            ('post', '/api/blueprint-imports/'),
            ('get', '/api/blueprint-imports/1/'),
            ('post', '/api/blueprint-imports/1/extract/'),
            ('post', '/api/blueprint-imports/1/apply/'),
            ('get', '/api/blueprint/'),
            ('get', '/api/blueprints/'),
            ('get', f'/api/blueprints/{blueprint_id}/'),
            ('post', f'/api/blueprints/{blueprint_id}/activate/'),
            ('get', '/api/subjects/'),
        ]:
            with self.subTest(method=method, url=url):
                self.assertEqual(getattr(self.client, method)(url).status_code, 401)


class ImportFlowTests(BlueprintTestCase):
    def test_extract_merges_page_batches_into_reviewable_draft(self):
        import_id, chat = self.upload_and_extract()
        self.assertEqual(chat.call_count, 2)
        images = [part for part in chat.call_args.args[0][1]['content'] if part['type'] == 'image_url']
        self.assertEqual(len(images), 1)

        polled = self.client.get(f'/api/blueprint-imports/{import_id}/').data
        self.assertEqual((polled['status'], polled['pagesProcessed'], polled['pageCount']), ('ready', 2, 2))
        draft = polled['draft']
        self.assertEqual(draft['programName'], 'Civil Engineering')
        self.assertEqual([theme['name'] for theme in draft['themes']], ['Structures', 'Water'])
        concrete = draft['themes'][0]['courses'][1]
        self.assertEqual(concrete['name'], 'Reinforced Concrete')
        self.assertEqual(concrete['itemCount'], 12)
        self.assertIn('Beam design', concrete['focusNotes'])
        # Nothing is applied until the user reviews and confirms.
        self.assertEqual(self.client.get('/api/subjects/').data, [])

    def test_apply_saves_reviewed_draft_activates_and_builds_priorities(self):
        import_id, _chat = self.upload_and_extract()
        draft = self.client.get(f'/api/blueprint-imports/{import_id}/').data['draft']
        draft['themes'][1]['courses'][0]['focusNotes'] = '- Open channel flow\n- Pipe networks'

        applied = self.client.post(f'/api/blueprint-imports/{import_id}/apply/', draft, format='json')
        self.assertEqual(applied.status_code, 201, applied.data)
        self.assertTrue(applied.data['blueprint']['isActive'])
        self.assertEqual(applied.data['import']['status'], 'applied')
        self.assertFalse(BlueprintImport.objects.get(pk=import_id).pdf)

        self.assertEqual(
            self.client.get('/api/subjects/').data,
            ['Structural Analysis I', 'Reinforced Concrete', 'Hydraulics'],
        )
        active = self.client.get('/api/blueprint/').data
        self.assertEqual(active['programName'], 'Civil Engineering')
        self.assertEqual(active['themes'][1]['courses'][0]['focusNotes'], '- Open channel flow\n- Pipe networks')
        priorities = self.client.get('/api/subject-priorities/').data
        self.assertEqual([p['subject'] for p in priorities], ['Reinforced Concrete', 'Structural Analysis I', 'Hydraulics'])

        again = self.client.post(f'/api/blueprint-imports/{import_id}/apply/', draft, format='json')
        self.assertEqual(again.status_code, 409)

    def test_apply_rejects_invalid_drafts(self):
        import_id, _chat = self.upload_and_extract()
        url = f'/api/blueprint-imports/{import_id}/apply/'
        no_name = {**copy.deepcopy(PAGE_ONE), 'programName': ' '}
        self.assertEqual(self.client.post(url, no_name, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'programName': 'X', 'themes': []}, format='json').status_code, 400)
        duplicate = copy.deepcopy(PAGE_ONE)
        duplicate['themes'][0]['courses'][1]['name'] = 'structural analysis i'
        response = self.client.post(url, duplicate, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('more than once', response.data['error'])
        self.assertFalse(UserBlueprint.objects.exists())

    def test_extract_reports_missing_ai_configuration(self):
        self.as_user(self.token_a)
        upload = self.upload()
        with override_settings(CURSOR_API_KEY='', AI_API_KEY=''):
            response = self.client.post(f"/api/blueprint-imports/{upload.data['id']}/extract/")
        self.assertEqual(response.status_code, 503)

    def test_rejects_non_pdf_upload(self):
        self.as_user(self.token_a)
        file = SimpleUploadedFile('notes.pdf', b'not a pdf', content_type='application/pdf')
        response = self.client.post('/api/blueprint-imports/', {'file': file}, format='multipart')
        self.assertEqual(response.status_code, 400)


class HistoryTests(BlueprintTestCase):
    def test_apply_appends_history_and_activates_newest(self):
        first = give_curriculum(self.user_a, label='cs-2025.pdf')
        second = give_curriculum(self.user_a, PAGE_ONE, label='civil.pdf')
        self.as_user(self.token_a)

        history = self.client.get('/api/blueprints/').data
        self.assertEqual([entry['id'] for entry in history], [second.id, first.id])
        self.assertEqual([entry['isActive'] for entry in history], [True, False])
        self.assertEqual(history[0]['programName'], 'Civil Engineering')
        self.assertIn('appliedAt', history[0])
        self.assertEqual(UserBlueprint.objects.filter(owner=self.user_a, is_active=True).count(), 1)
        self.assertEqual(self.client.get('/api/subjects/').data, ['Structural Analysis I', 'Reinforced Concrete'])

    def test_activate_switches_curriculum_and_rebuilds_priorities_keeping_shared_progress(self):
        older = give_curriculum(self.user_a)
        self.as_user(self.token_a)
        self.assertEqual(self.client.patch('/api/subject-priorities/Database Systems/toggle/').status_code, 200)

        revised = copy.deepcopy(SAMPLE_DRAFT)
        revised['programName'] = 'Computer Science (2026)'
        revised['themes'][1]['courses'] = [revised['themes'][1]['courses'][0]]
        give_curriculum(self.user_a, revised)
        subjects = [p['subject'] for p in self.client.get('/api/subject-priorities/').data]
        self.assertNotIn('Compiler Design', subjects)
        self.assertTrue(SubjectPriority.objects.get(owner=self.user_a, subject='Database Systems').is_completed)

        response = self.client.post(f'/api/blueprints/{older.id}/activate/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['isActive'])
        self.assertEqual(self.client.get('/api/blueprint/').data['id'], older.id)
        priorities = self.client.get('/api/subject-priorities/').data
        self.assertEqual(
            [p['subject'] for p in priorities],
            ['Data Structures and Algorithms', 'Database Systems', 'Object Oriented Programming', 'Compiler Design'],
        )
        self.assertTrue(next(p for p in priorities if p['subject'] == 'Database Systems')['isCompleted'])
        self.assertEqual(UserBlueprint.objects.filter(owner=self.user_a, is_active=True).count(), 1)


class OwnershipTests(BlueprintTestCase):
    def test_other_user_cannot_see_or_touch_imports_or_blueprints(self):
        import_id, _chat = self.upload_and_extract()
        draft = self.client.get(f'/api/blueprint-imports/{import_id}/').data['draft']
        blueprint = give_curriculum(self.user_a)

        self.as_user(self.token_b)
        self.assertEqual(self.client.get('/api/blueprint-imports/').data, [])
        self.assertEqual(self.client.get(f'/api/blueprint-imports/{import_id}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/blueprint-imports/{import_id}/extract/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/blueprint-imports/{import_id}/apply/', draft, format='json').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/blueprint-imports/{import_id}/').status_code, 404)
        self.assertEqual(self.client.get('/api/blueprints/').data, [])
        self.assertEqual(self.client.get(f'/api/blueprints/{blueprint.id}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/blueprints/{blueprint.id}/activate/').status_code, 404)
        self.assertEqual(self.client.get('/api/blueprint/').status_code, 404)
        self.assertEqual(self.client.get('/api/subjects/').data, [])
        self.assertEqual(self.client.get('/api/subject-priorities/').data, [])
        self.assertTrue(BlueprintImport.objects.filter(pk=import_id).exists())
        self.assertFalse(SubjectPriority.objects.filter(owner=self.user_b).exists())

    def test_activating_does_not_touch_other_users(self):
        give_curriculum(self.user_b, PAGE_ONE)
        older = give_curriculum(self.user_a)
        give_curriculum(self.user_a, PAGE_ONE)
        self.as_user(self.token_a)
        self.client.post(f'/api/blueprints/{older.id}/activate/')
        self.as_user(self.token_b)
        self.assertEqual(self.client.get('/api/subjects/').data, ['Structural Analysis I', 'Reinforced Concrete'])


class CurriculumUsageTests(BlueprintTestCase):
    def test_exam_import_is_blocked_until_a_blueprint_is_applied(self):
        self.as_user(self.token_a)
        file = SimpleUploadedFile('exam.pdf', make_photo_pdf(), content_type='application/pdf')
        upload = self.client.post('/api/exam-imports/', {'file': file}, format='multipart')
        self.assertEqual(upload.status_code, 201)
        extract = self.client.post(f"/api/exam-imports/{upload.data['id']}/extract/")
        self.assertEqual(extract.status_code, 409)
        self.assertEqual(extract.data['code'], 'no_curriculum')
        question = {'question': 'Which is LIFO?', 'choices': ['Queue', 'Stack'], 'correctAnswer': 'Stack', 'subject': 'Database Systems'}
        publish = self.client.post(
            f"/api/exam-imports/{upload.data['id']}/publish/", {'title': 'Model exam', 'questions': [question]}, format='json',
        )
        self.assertEqual(publish.status_code, 409)
        self.assertIn('blueprint', publish.data['error'])

    def test_study_chat_injects_active_course_focus_notes_and_program(self):
        give_curriculum(self.user_a)
        session, _created = get_or_create_session(self.user_a, topic_context('database system', 'Normalization'))
        system = build_messages(session, [])[0]['content']
        self.assertIn('Computer Science (sample)', system)
        self.assertIn('Normalization up to BCNF', system)
        self.assertNotIn('Software Engineering', system)

        give_curriculum(self.user_a, PAGE_ONE)
        system = build_messages(session, [])[0]['content']
        self.assertIn('Civil Engineering', system)
        self.assertNotIn('Normalization up to BCNF', system)

    def test_match_course_is_fuzzy_but_not_ambiguous(self):
        names = ['Data Structures and Algorithms', 'Database Systems', 'Computer Networks', 'Network Security']
        self.assertEqual(match_course('data structure & algorithm', names), 'Data Structures and Algorithms')
        self.assertEqual(match_course('Fundamentals of Database Systems', names), 'Database Systems')
        self.assertEqual(match_course('Computer Networking', names), 'Computer Networks')
        self.assertEqual(match_course('network', names), '')
        self.assertEqual(match_course('Thermodynamics', names), '')
