"""Deterministic inference stand-in for browser tests ONLY. Never imported by the app."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"test fixture")

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        prompt = payload['messages'][-1]['content']
        if 'delta_scores' in payload['messages'][0]['content']:
            data = json.loads(prompt)
            followup = 'FOLLOWUP' in data['current_argument']
            score = 2 if data['side'] == 'petitioner' or 'TIE:' in data['current_argument'] else 1
            content = json.dumps({'delta_scores': {'legal_application': score, 'issue_relevance': score, 'argument_flow': score, 'bench_handling': score if data.get('judge_last_response') else None}, 'judge_response': 'Counsel, explain why the safeguard is insufficient.' if followup else 'The submission applies the issue to the facts. The bench will hear the other side.', 'speaker_switch': not followup, 'judge_notes': 'Test fixture: assessment for deterministic flow verification.'})
        else:
            content = 'The respondent submits that the measure must be considered alongside safeguards. The petitioner has not shown why targeted safeguards would be insufficient. The court should examine necessity on the supplied facts rather than presume every restriction invalid.'
        response = json.dumps({'choices': [{'message': {'content': content}}]}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(response)

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', int(os.getenv('THEMIS_FIXTURE_PORT', '8011'))), Handler).serve_forever()
