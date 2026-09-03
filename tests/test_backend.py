import json
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.judge import JudgeUnavailable, providers, completion, parse_evaluation, counsel_history

CASE = {"title": "Practice case", "facts": "A blanket surveillance measure is challenged.", "issues": ["Is it proportionate?"], "precedents": ["Puttaswamy"]}
RESULT = {"delta_scores": {"legal_application": 2, "issue_relevance": 3, "argument_flow": 1, "bench_handling": None}, "judge_response": "Counsel, address necessity.", "speaker_switch": False, "judge_notes": "Apply the test to the facts."}
PAYLOAD = {"role": "Petitioner", "text": "The measure is disproportionate.", "selectedCase": CASE}

class BackendTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.environment = patch.dict(os.environ, {"THEMIS_BASE_URL": "http://127.0.0.1:9999/v1", "THEMIS_MODEL": "themis-adapter", "OPENAI_API_KEY": "test-secret"}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)





    def test_invalid_endpoint_is_recoverable(self):
        with self.assertRaises(JudgeUnavailable):
            completion(("Fine-tuned judge", "not-a-url", "themis", "secret"), [])



    def test_validation(self):
        for text in ['', '   ', 'x' * 6001]:
            self.assertEqual(self.client.post('/argue', json={**PAYLOAD, 'text': text}).status_code, 422)
        response = self.client.post('/argue', json={**PAYLOAD, 'role': 'Invalid', 'options': {'openai_key': 'secret-sentinel'}})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('secret-sentinel', response.text)
        for value in [4, -4, 2.5, True, '2']:
            with self.assertRaises(ValueError):
                parse_evaluation(json.dumps({**RESULT, 'delta_scores': {**RESULT['delta_scores'], 'legal_application': value}}))


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
