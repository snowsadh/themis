import unittest
from fastapi.testclient import TestClient
from backend.cases import archive_cases
from backend.main import Case, app

class CaseTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)


    def test_archive_is_playable_and_sourced(self):
        items = archive_cases()
        self.assertEqual(len(items), 56)
        self.assertEqual(len({item['id'] for item in items}), len(items))
        for item in items:
            with self.subTest(case=item['title']):
                Case.model_validate(item)
                self.assertTrue(item['source_url'].startswith('https://indiankanoon.org/doc/'))
                self.assertTrue(item['petitioner_stand'])
                self.assertTrue(item['respondent_stand'])


    def test_search_pagination_and_category(self):
        first = self.client.get('/cases?limit=5').json()
        second = self.client.get('/cases?limit=5&offset=5').json()
        self.assertEqual(first['total'], 56)
        self.assertEqual(len(first['items']), 5)
        self.assertTrue(set(item['id'] for item in first['items']).isdisjoint(item['id'] for item in second['items']))
        found = self.client.get('/cases', params={'q': 'PUTTASWAMY privacy'}).json()
        self.assertEqual(found['items'][0]['id'], 'archive-91938676')
        found = self.client.get('/cases', params={'category': 'Education'}).json()
        self.assertGreater(found['total'], 1)
        self.assertTrue(all(item['category'] == 'Education' for item in found['items']))
        self.assertEqual(self.client.get('/cases?q=nothing-matches-xyz').json()['total'], 0)
        for url in ['/cases?offset=-1', '/cases?limit=9999', '/cases?q=' + 'a' * 201]:
            self.assertEqual(self.client.get(url).status_code, 422)


if __name__ == '__main__':
    unittest.main()
