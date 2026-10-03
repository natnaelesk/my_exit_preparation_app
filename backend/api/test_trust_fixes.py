from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import Attempt, Question, SubjectPriority


class TrustFixTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.token_a = self.signup('trust_a')
        self.token_b = self.signup('trust_b')
        self.user_a = get_user_model().objects.get(username='trust_a')

    def signup(self, username):
        response = self.client.post('/api/auth/signup/', {'username': username, 'password': 'study-hard-2026'}, format='json')
        return response.data['token']

    def as_user(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')


class RoundTwoTests(TrustFixTestCase):
    def test_round_two_path_used_by_frontend_resets_only_own_priorities(self):
        for token in (self.token_a, self.token_b):
            self.as_user(token)
            self.assertEqual(self.client.get('/api/subject-priorities/').status_code, 200)
        SubjectPriority.objects.update(is_completed=True)

        self.as_user(self.token_a)
        response = self.client.post('/api/subject-priorities/round-two/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data)
        self.assertTrue(all(not p['isCompleted'] and p['roundNumber'] == 2 for p in response.data))
        others = SubjectPriority.objects.exclude(owner=self.user_a)
        self.assertTrue(others.exists())
        self.assertTrue(all(p.is_completed and p.round_number == 1 for p in others))


class AttemptDedupeTests(TrustFixTestCase):
    def attempt(self, question_id='q1', answer='A', correct=True, session_id='session_1'):
        payload = {
            'questionId': question_id, 'selectedAnswer': answer, 'isCorrect': correct, 'timeSpent': 5,
            'subject': 'Database Systems', 'topic': 'Normalization', 'mode': 'random',
        }
        if session_id is not None:
            payload['sessionId'] = session_id
        return self.client.post('/api/attempts/', payload, format='json')

    def test_pause_then_finish_does_not_double_count(self):
        self.as_user(self.token_a)
        # Pause submits the answers given so far...
        self.assertEqual(self.attempt('q1').status_code, 201)
        self.assertEqual(self.attempt('q2', answer='B', correct=False).status_code, 201)
        # ...then finish (after resume) submits every answer again, with q2 changed.
        self.assertEqual(self.attempt('q1').status_code, 200)
        again = self.attempt('q2', answer='C', correct=True)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(self.attempt('q3').status_code, 201)

        attempts = Attempt.objects.filter(owner=self.user_a)
        self.assertEqual(attempts.count(), 3)
        q2 = attempts.get(question_id='q2')
        self.assertEqual((q2.selected_answer, q2.is_correct, q2.session_id), ('C', True, 'session_1'))
        self.assertEqual(again.data['sessionId'], 'session_1')

        stats = self.client.get('/api/analytics/subjects/').data['Database Systems']
        self.assertEqual((stats['totalAttempted'], stats['correctCount']), (3, 3))

    def test_new_session_or_no_session_still_records_new_attempts(self):
        self.as_user(self.token_a)
        self.attempt('q1', session_id='session_1')
        self.attempt('q1', session_id='session_2')
        self.attempt('q1', session_id=None)
        self.attempt('q1', session_id=None)
        self.assertEqual(Attempt.objects.filter(owner=self.user_a, question_id='q1').count(), 4)

    def test_same_session_id_is_scoped_per_user(self):
        self.as_user(self.token_a)
        self.attempt('q1')
        self.as_user(self.token_b)
        self.assertEqual(self.attempt('q1', answer='B', correct=False).status_code, 201)
        self.assertEqual(Attempt.objects.filter(question_id='q1').count(), 2)
        self.assertEqual(Attempt.objects.get(owner=self.user_a).selected_answer, 'A')


class PaginationTests(TrustFixTestCase):
    def test_lists_page_at_100_and_allow_larger_pages_up_to_1000(self):
        Question.objects.bulk_create([
            Question(question_id=f'q_page_{i}', owner=self.user_a, question=f'Q{i}?', choices=['A', 'B'],
                     correct_answer='A', subject='Database Systems', topic='Paging')
            for i in range(150)
        ])
        self.as_user(self.token_a)

        first = self.client.get('/api/questions/').data
        self.assertEqual((first['count'], len(first['results'])), (150, 100))
        self.assertIsNotNone(first['next'])
        second = self.client.get('/api/questions/', {'page': 2}).data
        self.assertEqual(len(second['results']), 50)
        self.assertIsNone(second['next'])

        everything = self.client.get('/api/questions/', {'page_size': 5000}).data
        self.assertEqual(len(everything['results']), 150)
        self.assertIsNone(everything['next'])

        self.as_user(self.token_b)
        self.assertEqual(self.client.get('/api/questions/', {'page_size': 1000}).data['count'], 0)
