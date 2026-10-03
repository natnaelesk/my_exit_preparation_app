import threading
from unittest import mock

from cursor_sdk import (
    AgentNotFoundError,
    AuthenticationError,
    ModelParameterDefinition,
    ModelParameterDefinitionValue,
    NetworkError,
    RateLimitError,
    RunResult,
    SDKModel,
)
from django.test import SimpleTestCase, override_settings

from . import ai_client

PIXEL = 'iVBORw0KGgo='

SMART = SDKModel(
    id='auto-smart',
    display_name='Auto (smart)',
    parameters=(ModelParameterDefinition(id='optimize_for', values=(
        ModelParameterDefinitionValue(value='intelligence'),
        ModelParameterDefinitionValue(value='balanced'),
    )),),
)


class FakeRun:
    def __init__(self, result='', status='finished', agent_id='bc-1', block=False):
        self.id = 'run-1'
        self._result = RunResult(id='run-1', agent_id=agent_id, status=status, result=result)
        self._block = block
        self._cancelled = threading.Event()

    def wait(self):
        if self._block:
            self._cancelled.wait(5)
            return RunResult(id='run-1', agent_id='bc-1', status='cancelled')
        return self._result

    def cancel(self):
        self._cancelled.set()


class FakeAgent:
    def __init__(self, agent_id='bc-1', run=None):
        self.agent_id = agent_id
        self.run = run or FakeRun('{"ok": true}')
        self.sent = []
        self.delete = mock.Mock()
        self.archive = mock.Mock()
        self.close = mock.Mock()

    def send(self, message):
        self.sent.append(message)
        return self.run


@override_settings(CURSOR_API_KEY='crsr_test-key', AI_API_KEY='', CURSOR_MODEL='', AI_TIMEOUT_SECONDS=600)
class CursorClientTests(SimpleTestCase):
    def setUp(self):
        ai_client._catalog.clear()
        patcher = mock.patch.object(ai_client.Cursor.models, 'list', return_value=[SMART])
        self.list_models = patcher.start()
        self.addCleanup(patcher.stop)

    def patch_agent(self, **kwargs):
        patcher = mock.patch.object(ai_client, 'Agent', **kwargs)
        agent_cls = patcher.start()
        self.addCleanup(patcher.stop)
        return agent_cls

    def test_complete_runs_a_no_repo_cloud_agent_and_deletes_it(self):
        agent = FakeAgent(run=FakeRun('```json\n{"title": "Model exam", "questions": []}\n```'))
        agent_cls = self.patch_agent()
        agent_cls.create.return_value = agent

        text = ai_client.complete([
            {'role': 'system', 'content': 'Extract questions.'},
            {'role': 'user', 'content': [
                {'type': 'text', 'text': 'Page 1:'},
                {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{PIXEL}', 'detail': 'high'}},
            ]},
        ])

        self.assertEqual(ai_client.parse_json_reply(text), {'title': 'Model exam', 'questions': []})
        kwargs = agent_cls.create.call_args.kwargs
        self.assertEqual(kwargs['api_key'], 'crsr_test-key')
        self.assertEqual(kwargs['cloud'].repos, [])
        self.assertEqual(kwargs['cloud'].env.type, 'cloud')
        self.assertEqual(kwargs['model'].id, 'auto-smart')
        self.assertEqual([(p.id, p.value) for p in kwargs['model'].params], [('optimize_for', 'intelligence')])
        self.list_models.assert_called_once_with(api_key='crsr_test-key')

        message = agent.sent[0]
        self.assertIn('Extract questions.', message.text)
        self.assertIn('Do not use tools', message.text)
        self.assertIn('[Image 1 attached]', message.text)
        self.assertEqual([(i.data, i.mime_type) for i in message.images], [(PIXEL, 'image/png')])
        agent.delete.assert_called_once()
        agent.close.assert_called_once()

    def test_cloud_options_survive_serialization(self):
        agent_cls = self.patch_agent()
        agent_cls.create.return_value = FakeAgent()
        ai_client.complete([{'role': 'user', 'content': 'hi'}])
        wire = agent_cls.create.call_args.kwargs['cloud'].to_json()
        self.assertTrue(wire, 'an empty cloud block makes the SDK start a local agent')

    def test_refuses_an_agent_that_is_not_a_cloud_agent(self):
        agent = FakeAgent(agent_id='agent-local-1')
        self.patch_agent().create.return_value = agent
        with self.assertRaises(ai_client.AIConfigError):
            ai_client.complete([{'role': 'user', 'content': 'hi'}])
        self.assertEqual(agent.sent, [])
        agent.close.assert_called_once()

    def test_maps_sdk_failures_to_app_errors(self):
        cases = [
            (AuthenticationError('bad key'), ai_client.AIConfigError),
            (RateLimitError('slow down'), ai_client.AIUnavailableError),
            (NetworkError('offline'), ai_client.AIUnavailableError),
        ]
        for error, expected in cases:
            with self.subTest(error=type(error).__name__):
                self.patch_agent().create.side_effect = error
                with self.assertRaises(expected):
                    ai_client.complete([{'role': 'user', 'content': 'hi'}])

    def test_empty_or_failed_runs(self):
        for run, expected in [
            (FakeRun('   '), ai_client.BadAIOutput),
            (FakeRun('partial', status='error'), ai_client.AIUnavailableError),
        ]:
            with self.subTest(status=run._result.status):
                agent = FakeAgent(run=run)
                self.patch_agent().create.return_value = agent
                with self.assertRaises(expected):
                    ai_client.complete([{'role': 'user', 'content': 'hi'}])
                agent.delete.assert_called_once()

    @override_settings(AI_TIMEOUT_SECONDS=0)
    def test_slow_run_is_cancelled_and_reported_as_timeout(self):
        agent = FakeAgent(run=FakeRun(block=True))
        self.patch_agent().create.return_value = agent
        with self.assertRaises(ai_client.AITimeoutError):
            ai_client.complete([{'role': 'user', 'content': 'hi'}])
        self.assertTrue(agent.run._cancelled.is_set())
        agent.delete.assert_called_once()

    def test_rejects_more_than_five_images(self):
        image = {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{PIXEL}'}}
        agent_cls = self.patch_agent()
        with self.assertRaises(ValueError):
            ai_client.complete([{'role': 'user', 'content': [image] * 6}])
        agent_cls.create.assert_not_called()

    def test_chat_turn_starts_agent_then_resumes_it(self):
        messages = [{'role': 'system', 'content': 'Teach in 4 chunks.'}, {'role': 'user', 'content': 'Start'}]
        first = FakeAgent(agent_id='bc-tutor', run=FakeRun('## Chunk 1 of 4'))
        agent_cls = self.patch_agent()
        agent_cls.create.return_value = first

        self.assertEqual(ai_client.chat_turn(None, messages), ('bc-tutor', '## Chunk 1 of 4'))
        kwargs = agent_cls.create.call_args.kwargs
        self.assertEqual(kwargs['cloud'].repos, [])
        self.assertEqual([(p.id, p.value) for p in kwargs['model'].params], [('optimize_for', 'balanced')])
        self.assertIn('Teach in 4 chunks.', first.sent[0])
        self.assertIn("## Student's message\nStart", first.sent[0])
        first.delete.assert_not_called()

        resumed = FakeAgent(agent_id='bc-tutor', run=FakeRun('## Chunk 2 of 4'))
        agent_cls.resume.return_value = resumed
        history = messages + [{'role': 'assistant', 'content': '## Chunk 1 of 4'}, {'role': 'user', 'content': 'continue'}]
        self.assertEqual(ai_client.chat_turn('bc-tutor', history), ('bc-tutor', '## Chunk 2 of 4'))
        self.assertEqual(agent_cls.resume.call_args.args[0], 'bc-tutor')
        self.assertEqual(agent_cls.resume.call_args.args[1].api_key, 'crsr_test-key')
        self.assertEqual(resumed.sent, ['continue'])
        resumed.delete.assert_not_called()
        resumed.close.assert_called_once()
        self.assertEqual(agent_cls.create.call_count, 1)

    def test_chat_turn_replaces_an_agent_cursor_no_longer_has(self):
        history = [
            {'role': 'system', 'content': 'Teach.'},
            {'role': 'user', 'content': 'Start'},
            {'role': 'assistant', 'content': '## Chunk 1 of 4'},
            {'role': 'user', 'content': 'continue'},
        ]
        fresh = FakeAgent(agent_id='bc-new', run=FakeRun('## Chunk 2 of 4'))
        agent_cls = self.patch_agent()
        agent_cls.resume.side_effect = AgentNotFoundError('gone')
        agent_cls.create.return_value = fresh

        self.assertEqual(ai_client.chat_turn('bc-old', history), ('bc-new', '## Chunk 2 of 4'))
        self.assertIn('Tutor: ## Chunk 1 of 4', fresh.sent[0])
        self.assertIn("## Student's message\ncontinue", fresh.sent[0])

    def test_failed_first_chat_turn_deletes_the_new_agent(self):
        agent = FakeAgent(agent_id='bc-tutor', run=FakeRun('', status='error'))
        self.patch_agent().create.return_value = agent
        with self.assertRaises(ai_client.AIUnavailableError):
            ai_client.chat_turn(None, [{'role': 'user', 'content': 'Start'}])
        agent.delete.assert_called_once()


@override_settings(CURSOR_MODEL='', AI_TIMEOUT_SECONDS=600)
class CursorSettingsTests(SimpleTestCase):
    def setUp(self):
        ai_client._catalog.clear()

    @override_settings(CURSOR_API_KEY='', AI_API_KEY='crsr_legacy')
    def test_legacy_ai_api_key_is_used_only_when_it_is_a_cursor_key(self):
        self.assertEqual(ai_client.api_key(), 'crsr_legacy')
        with self.settings(AI_API_KEY='xai-old-key'):
            self.assertFalse(ai_client.is_configured())
        with self.settings(CURSOR_API_KEY='crsr_new'):
            self.assertEqual(ai_client.api_key(), 'crsr_new')

    @override_settings(CURSOR_API_KEY='crsr_test-key', AI_API_KEY='')
    def test_model_fallbacks(self):
        with mock.patch.object(ai_client.Cursor.models, 'list', return_value=[
            SDKModel(id='composer-2.5', display_name='Composer'), SDKModel(id='auto', display_name='Auto'),
        ]):
            self.assertEqual(ai_client.resolve_model(ai_client.VISION).id, 'auto')

        ai_client._catalog.clear()
        with mock.patch.object(ai_client.Cursor.models, 'list', side_effect=NetworkError('offline')):
            model = ai_client.resolve_model(ai_client.CHAT)
        self.assertEqual((model.id, [(p.id, p.value) for p in model.params]), ('auto-smart', [('optimize_for', 'balanced')]))

        with self.settings(CURSOR_MODEL='claude-4-sonnet'), mock.patch.object(ai_client.Cursor.models, 'list') as listing:
            self.assertEqual(ai_client.resolve_model(ai_client.VISION).id, 'claude-4-sonnet')
        listing.assert_not_called()

    @override_settings(CURSOR_API_KEY='crsr_test-key', AI_API_KEY='')
    def test_chat_falls_back_to_intelligence_when_balanced_is_not_offered(self):
        smart = SDKModel(id='auto-smart', display_name='Auto', parameters=(ModelParameterDefinition(
            id='optimizeFor', values=(ModelParameterDefinitionValue(value='intelligence'),),
        ),))
        with mock.patch.object(ai_client.Cursor.models, 'list', return_value=[smart]):
            model = ai_client.resolve_model(ai_client.CHAT)
        self.assertEqual([(p.id, p.value) for p in model.params], [('optimizeFor', 'intelligence')])
