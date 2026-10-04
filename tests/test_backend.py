import json
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.judge import parse_evaluation, JudgeUnavailable, providers, completion, counsel_history

CASE = {"title": "Practice case", "facts": "A blanket surveillance measure is challenged.", "issues": ["Is it proportionate?"], "precedents": ["Puttaswamy"]}
RESULT = {"delta_scores": {"legal_application": 2, "issue_relevance": 3, "argument_flow": 1, "bench_handling": None}, "judge_response": "Counsel, address necessity.", "speaker_switch": False, "judge_notes": "Apply the test to the facts."}
PAYLOAD = {"role": "Petitioner", "text": "The measure is disproportionate.", "selectedCase": CASE}

class BackendTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.environment = patch.dict(os.environ, {"THEMIS_BASE_URL": "http://127.0.0.1:9999/v1", "THEMIS_MODEL": "themis-adapter", "OPENAI_API_KEY": "test-secret"}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_primary_uses_training_schema(self):
        with patch('backend.judge.completion', return_value=json.dumps(RESULT)) as call:
            response = self.client.post('/argue', json=PAYLOAD)
        self.assertEqual(response.status_code, 200)
        body = response.json()['response']
        self.assertEqual(body['provider'], 'Fine-tuned judge')
        self.assertFalse(body['fallback_used'])
        self.assertIsNone(body['delta_scores']['bench_handling'])
        data = json.loads(call.call_args.args[1][1]['content'])
        self.assertEqual(data['current_argument'], PAYLOAD['text'])
        self.assertNotIn('judge_last_response', data)

    def test_followup_and_history(self):
        result = {**RESULT, 'delta_scores': {**RESULT['delta_scores'], 'bench_handling': 3}}
        history = [{'role': 'Judge', 'argument': 'Why?', 'speaker': 'petitioner', 'interrupt': True}]
        with patch('backend.judge.completion', return_value=json.dumps(result)) as call:
            response = self.client.post('/argue', json={**PAYLOAD, 'history': history})
        self.assertEqual(response.json()['response']['delta_scores']['bench_handling'], 3)
        self.assertEqual(json.loads(call.call_args.args[1][1]['content'])['judge_last_response'], 'Why?')

    def test_malformed_primary_falls_back(self):
        with patch('backend.judge.completion', side_effect=['not JSON', json.dumps(RESULT)]) as call:
            body = self.client.post('/argue', json=PAYLOAD).json()['response']
        self.assertEqual(call.call_count, 2)
        self.assertEqual(body['provider'], 'OpenAI fallback')
        self.assertTrue(body['fallback_used'])

    def test_failure_never_scores_or_leaks(self):
        with patch('backend.judge.completion', side_effect=JudgeUnavailable('test-secret')):
            response = self.client.post('/argue', json=PAYLOAD)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('delta_scores', response.text)
        self.assertNotIn('test-secret', response.text)

    def test_invalid_endpoint_is_recoverable(self):
        with self.assertRaises(JudgeUnavailable):
            completion(("Fine-tuned judge", "not-a-url", "themis", "secret"), [])

    def test_disable_fallback(self):
        with patch('backend.judge.completion', side_effect=JudgeUnavailable('offline')) as call:
            response = self.client.post('/argue', json={**PAYLOAD, 'options': {'allow_fallback': False}})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(call.call_count, 1)

    def test_override_is_request_scoped(self):
        with patch('backend.judge.completion', side_effect=['invalid', json.dumps(RESULT)]) as call:
            self.client.post('/argue', json={**PAYLOAD, 'options': {'openai_key': 'override', 'openai_model': 'custom-model'}})
        self.assertEqual(call.call_args.args[0][2:], ('custom-model', 'override'))
        self.assertEqual(providers()[-1][3], 'test-secret')
        self.assertNotIn('test-secret', self.client.get('/health').text)
        self.assertNotIn('override', self.client.get('/health').text)

    def test_validation(self):
        for text in ['', '   ', 'x' * 6001]:
            self.assertEqual(self.client.post('/argue', json={**PAYLOAD, 'text': text}).status_code, 422)
        response = self.client.post('/argue', json={**PAYLOAD, 'role': 'Invalid', 'options': {'openai_key': 'secret-sentinel'}})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('secret-sentinel', response.text)
        for value in [4, -4, 2.5, True, '2']:
            with self.assertRaises(ValueError):
                parse_evaluation(json.dumps({**RESULT, 'delta_scores': {**RESULT['delta_scores'], 'legal_application': value}}))

    def test_counsel_and_websocket(self):
        with patch('backend.judge.completion', return_value='The respondent submits that safeguards address the issue.'):
            response = self.client.post('/counsel', json={'role': 'Respondent', 'selectedCase': CASE})
        self.assertEqual(response.status_code, 200)
        self.assertIn('respondent', response.json()['text'])
        with self.client.websocket_connect('/ws') as ws:
            ws.send_text('invalid')
            self.assertIn('error', ws.receive_json())
            with patch('backend.judge.completion', return_value=json.dumps(RESULT)):
                ws.send_json(PAYLOAD)
                self.assertIn('delta_scores', ws.receive_json())

    def test_counsel_history_keeps_complete_recent_turns(self):
        turns = [{"role": "Petitioner", "argument": "a" * 6000}, {"role": "Judge", "argument": "Question?"}, {"role": "Respondent", "argument": "b" * 6000}]
        self.assertEqual(counsel_history(turns), turns[1:])
        self.assertEqual(counsel_history(turns, budget=12009), turns)

    def test_health_distinguishes_primary_from_fallback(self):
        with patch.dict(os.environ, {"THEMIS_BASE_URL": "", "THEMIS_MODEL": ""}):
            status = self.client.get('/health').json()
        self.assertTrue(status['judge_configured'])
        self.assertFalse(status['primary_judge_configured'])
        self.assertTrue(status['openai_configured'])

if __name__ == '__main__':
    unittest.main()
