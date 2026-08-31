import json
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.judge import JudgeUnavailable, providers, completion

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






    def test_health_distinguishes_primary_from_fallback(self):
        with patch.dict(os.environ, {"THEMIS_BASE_URL": "", "THEMIS_MODEL": ""}):
            status = self.client.get('/health').json()
        self.assertTrue(status['judge_configured'])
        self.assertFalse(status['primary_judge_configured'])
        self.assertTrue(status['openai_configured'])

if __name__ == '__main__':
    unittest.main()
