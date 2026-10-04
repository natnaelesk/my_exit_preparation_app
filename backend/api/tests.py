from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Attempt, DailyPlan, Exam, Question, SubjectPriority
from .test_helpers import give_curriculum


QUESTION = {
    'question': 'What does SQL stand for?',
    'choices': ['Structured Query Language', 'Simple Query Language'],
    'correctAnswer': 'Structured Query Language',
    'subject': 'Database Systems',
    'topic': 'SQL',
    'explanation': '',
}


class AuthTestCase(APITestCase):
    def setUp(self):
        cache.clear()

    def signup(self, username, password='study-hard-2026'):
        response = self.client.post('/api/auth/signup/', {'username': username, 'password': password}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['token']

    def as_user(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    def anonymous(self):
        self.client.credentials()


class SignupLoginLogoutTests(AuthTestCase):
    def test_signup_login_me_logout(self):
        self.signup('abebe')
        self.anonymous()

        response = self.client.post('/api/auth/login/', {'username': 'ABEBE', 'password': 'study-hard-2026'}, format='json')
        self.assertEqual(response.status_code, 200)
        token = response.data['token']

        self.as_user(token)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'abebe')

        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_login_rejects_bad_password(self):
        self.signup('abebe')
        self.anonymous()
        response = self.client.post('/api/auth/login/', {'username': 'abebe', 'password': 'wrong'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('token', response.data)

    def test_signup_rejects_duplicate_username_and_weak_password(self):
        self.signup('abebe')
        self.anonymous()
        response = self.client.post('/api/auth/signup/', {'username': 'Abebe', 'password': 'study-hard-2026'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('username', response.data)

        response = self.client.post('/api/auth/signup/', {'username': 'kebede', 'password': '123'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)


class UnauthenticatedAccessTests(AuthTestCase):
    def test_private_endpoints_require_auth(self):
        endpoints = [
            ('get', '/api/questions/'),
            ('post', '/api/questions/bulk/'),
            ('get', '/api/exams/'),
            ('post', '/api/exams/'),
            ('get', '/api/attempts/'),
            ('get', '/api/attempts/answered_ids/'),
            ('get', '/api/sessions/'),
            ('get', '/api/sessions/incomplete/'),
            ('get', '/api/plans/recent/'),
            ('post', '/api/plans/'),
            ('get', '/api/settings/theme/'),
            ('get', '/api/subject-priorities/'),
            ('get', '/api/analytics/subjects/'),
            ('get', '/api/analytics/trend/'),
            ('get', '/api/debug/stats/'),
            ('get', '/api/auth/me/'),
            ('post', '/api/auth/logout/'),
        ]
        for method, url in endpoints:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(url, {}, format='json')
                self.assertEqual(response.status_code, 401)

    def test_api_root_stays_public_for_health_checks(self):
        self.assertEqual(self.client.get('/api/').status_code, 200)


class OwnershipIsolationTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.token_a = self.signup('user_a')
        self.token_b = self.signup('user_b')

    def create_data_as_a(self):
        give_curriculum(get_user_model().objects.get(username='user_a'))
        self.as_user(self.token_a)
        response = self.client.post('/api/questions/bulk/', {'questions': [QUESTION, QUESTION]}, format='json')
        self.assertEqual(response.data['created'], 2)
        question_ids = [q['questionId'] for q in response.data['questions']]

        exam = self.client.post('/api/exams/', {'title': 'A exam', 'questionIds': question_ids}, format='json').data
        session = self.client.post('/api/sessions/', {
            'examId': exam['examId'], 'mode': 'exam', 'config': {}, 'currentIndex': 0,
            'questionIds': question_ids, 'answers': {}, 'timeSpent': {}, 'isComplete': False, 'isPaused': False,
        }, format='json').data
        attempt = self.client.post('/api/attempts/', {
            'questionId': question_ids[0], 'selectedAnswer': QUESTION['correctAnswer'], 'isCorrect': True,
            'timeSpent': 5, 'subject': QUESTION['subject'], 'topic': QUESTION['topic'],
            'examId': exam['examId'], 'mode': 'exam', 'planDateKey': '2026-10-03',
        }, format='json').data
        plan = self.client.post('/api/plans/', {
            'dateKey': '2026-10-03', 'focusSubject': QUESTION['subject'], 'totalAvailableInSubject': 2,
            'maxPlannedQuestions': 35, 'questionIds': question_ids, 'answeredCount': 0, 'correctCount': 0,
            'wrongCount': 0, 'accuracy': 0, 'isComplete': False,
        }, format='json')
        self.assertEqual(plan.status_code, 201)
        self.client.get('/api/subject-priorities/')
        self.client.put('/api/settings/theme/', {
            'favoriteLightTheme': 'solarized-light', 'favoriteDarkTheme': 'dracula', 'autoMode': True,
        }, format='json')
        return question_ids, exam, session, attempt

    def test_new_user_has_empty_canvas(self):
        self.create_data_as_a()
        self.as_user(self.token_b)
        for url in ['/api/questions/', '/api/exams/', '/api/attempts/', '/api/sessions/']:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).data['count'], 0)
        self.assertEqual(self.client.get('/api/plans/recent/').data, [])
        self.assertEqual(self.client.get('/api/attempts/answered_ids/').data, [])
        self.assertEqual(self.client.get('/api/sessions/incomplete/').data, [])
        self.assertEqual(self.client.get('/api/analytics/subjects/').data, {})
        self.assertEqual(self.client.get('/api/subject-priorities/').data, [])
        self.assertEqual(self.client.get('/api/subjects/').data, [])
        self.assertEqual(self.client.get('/api/blueprint/').status_code, 404)
        self.assertEqual(self.client.get('/api/blueprints/').data, [])
        self.assertEqual(self.client.get('/api/analytics/trend/').data, [])
        self.assertEqual(self.client.get('/api/debug/stats/').data['tables'], {'exam': 0, 'attempt': 0, 'daily_plan': 0})
        self.assertEqual(self.client.get('/api/settings/theme/').data['favoriteDarkTheme'], 'dark')

    def test_user_b_cannot_read_or_mutate_user_a_rows(self):
        question_ids, exam, session, attempt = self.create_data_as_a()
        self.as_user(self.token_b)

        self.assertEqual(self.client.get(f'/api/questions/{question_ids[0]}/').status_code, 404)
        self.assertEqual(self.client.post('/api/questions/bulk/', {'questionIds': question_ids}, format='json').data, [])
        self.assertEqual(self.client.get(f"/api/exams/{exam['examId']}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/sessions/{session['sessionId']}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/attempts/{attempt['attemptId']}/").status_code, 404)
        self.assertEqual(self.client.get('/api/plans/2026-10-03/').status_code, 404)

        self.assertEqual(self.client.patch(f'/api/questions/{question_ids[0]}/', {'subject': 'x'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(f"/api/exams/{exam['examId']}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/sessions/{session['sessionId']}/progress/", {'currentIndex': 1}, format='json').status_code, 404)
        self.assertEqual(self.client.post('/api/plans/2026-10-03/recompute/').status_code, 404)
        self.assertEqual(self.client.patch('/api/plans/2026-10-03/complete/').status_code, 404)
        self.assertEqual(self.client.patch('/api/subject-priorities/Database Systems/toggle/').status_code, 404)

        self.assertEqual(Question.objects.filter(subject='x').count(), 0)
        self.assertTrue(Exam.objects.filter(exam_id=exam['examId']).exists())
        self.assertFalse(DailyPlan.objects.get(date_key='2026-10-03').is_complete)

    def test_users_have_independent_per_day_and_per_subject_rows(self):
        self.create_data_as_a()
        self.as_user(self.token_b)
        response = self.client.post('/api/plans/', {
            'dateKey': '2026-10-03', 'focusSubject': 'Compiler Design', 'totalAvailableInSubject': 0,
            'maxPlannedQuestions': 35, 'questionIds': [], 'answeredCount': 0, 'correctCount': 0,
            'wrongCount': 0, 'accuracy': 0, 'isComplete': False,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['focusSubject'], 'Compiler Design')
        self.assertEqual(DailyPlan.objects.filter(date_key='2026-10-03').count(), 2)

        give_curriculum(get_user_model().objects.get(username='user_b'))
        self.assertEqual(self.client.patch('/api/subject-priorities/Database Systems/toggle/').status_code, 200)
        self.assertEqual(SubjectPriority.objects.filter(subject='Database Systems', is_completed=True).count(), 1)

    def test_practice_loop_for_logged_in_user(self):
        question_ids, exam, session, attempt = self.create_data_as_a()

        bulk = self.client.post('/api/questions/bulk/', {'questionIds': question_ids}, format='json').data
        self.assertEqual(len(bulk), 2)
        progress = self.client.patch(f"/api/sessions/{session['sessionId']}/progress/", {
            'currentIndex': 1, 'isComplete': True,
        }, format='json')
        self.assertEqual(progress.status_code, 200)
        self.assertTrue(progress.data['isComplete'])

        recomputed = self.client.post('/api/plans/2026-10-03/recompute/').data
        self.assertEqual(recomputed['answeredCount'], 1)
        self.assertEqual(recomputed['correctCount'], 1)
        self.assertEqual(self.client.get('/api/attempts/answered_ids/').data, [question_ids[0]])
        self.assertEqual(self.client.get('/api/analytics/subjects/').data['Database Systems']['totalAttempted'], 1)
        self.assertEqual(self.client.get('/api/settings/theme/').data['favoriteDarkTheme'], 'dracula')
        self.assertTrue(Attempt.objects.filter(owner__username='user_a').exists())

    def test_client_supplied_question_ids_are_ignored(self):
        self.as_user(self.token_a)
        payload = {'questions': [{**QUESTION, 'questionId': 'shared-id'}]}
        id_a = self.client.post('/api/questions/bulk/', payload, format='json').data['questions'][0]['questionId']
        self.as_user(self.token_b)
        id_b = self.client.post('/api/questions/bulk/', payload, format='json').data['questions'][0]['questionId']
        self.assertNotEqual(id_a, 'shared-id')
        self.assertNotEqual(id_a, id_b)
