import io
import unittest
import zipfile
from unittest.mock import patch

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from backend.cases import MAX_CASE_CHARACTERS, MAX_UPLOAD_BYTES, archive_cases
from backend.main import Case, app


def pdf_bytes(text=None, encrypted=False, blank_page=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    if text:
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    if blank_page:
        writer.add_blank_page(width=612, height=792)
    if encrypted:
        writer.encrypt("test-password")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def docx_bytes(xml=None):
    output = io.BytesIO()
    namespace = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", xml or f'<w:document {namespace}><w:body><w:p><w:r><w:t>Moot proposition</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Evidence in a table</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
        archive.writestr("word/footnotes.xml", f'<w:footnotes {namespace}><w:footnote w:id="1"><w:p><w:r><w:t>Important footnote</w:t></w:r></w:p></w:footnote></w:footnotes>')
    return output.getvalue()


class CaseTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def upload(self, filename, data):
        return self.client.post("/cases/import", files={"file": (filename, data)})

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

    def test_text_unicode_and_filename(self):
        response = self.upload('../my_moot.txt', 'The petitioner seeks ₹500 in relief.\nArticle 21.'.encode())
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['filename'], 'my_moot.txt')
        self.assertEqual(data['title'], 'my moot')
        self.assertIn('₹500', data['text'])
        self.assertEqual(data['characters'], len(data['text']))
        self.assertIsNone(data['pages'])
        self.assertEqual(self.upload('moot.txt', 'Indian moot proposition'.encode('utf-16')).status_code, 200)

    def test_long_import_is_complete_and_requires_review(self):
        text = 'a' * (MAX_CASE_CHARACTERS + 1)
        response = self.upload('long.txt', text.encode())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['text'], text)
        self.assertIn('nothing has been truncated', ' '.join(response.json()['warnings']))
        self.assertEqual(response.json()['max_case_characters'], MAX_CASE_CHARACTERS)
        self.assertEqual(self.upload('huge.txt', b'a' * 120001).status_code, 413)

    def test_pdf_extracts_text_and_reports_missing_pages(self):
        response = self.upload('brief.pdf', pdf_bytes('Counsel must address proportionality.', blank_page=True))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn('proportionality', response.json()['text'])
        self.assertEqual(response.json()['pages'], 2)
        self.assertIn('page(s) 2', ' '.join(response.json()['warnings']))

    def test_pdf_scanned_encrypted_and_corrupt(self):
        for data, phrase in [(pdf_bytes(), 'No readable text'), (pdf_bytes(encrypted=True), 'password-protected'), (b'%PDF-corrupt', 'could not be read')]:
            response = self.upload('case.pdf', data)
            self.assertEqual(response.status_code, 422)
            self.assertIn(phrase, response.json()['detail'])
        with patch('backend.cases.MAX_PDF_PAGES', 1):
            self.assertEqual(self.upload('case.pdf', pdf_bytes('Case', blank_page=True)).status_code, 413)

    def test_docx_includes_table_and_footnote(self):
        response = self.upload('case.docx', docx_bytes())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn('Evidence in a table', response.json()['text'])
        self.assertIn('Important footnote', response.json()['text'])
        self.assertTrue(response.json()['warnings'])

    def test_docx_rejects_entity_expansion_and_zip_bomb(self):
        xml = '<!DOCTYPE document [<!ENTITY unsafe "secret">]><document>&unsafe;</document>'
        response = self.upload('case.docx', docx_bytes(xml))
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('secret', response.text)
        self.assertEqual(self.upload('case.docx', docx_bytes(xml.encode('utf-16'))).status_code, 422)
        self.assertEqual(self.upload('case.docx', docx_bytes('a' * 100000)).status_code, 413)

    def test_upload_limits_and_formats(self):
        for filename, data, code in [('empty.txt', b'', 422), ('binary.txt', b'\x00\x01data', 422), ('case.exe', b'fake', 415), ('broken.docx', b'not-a-zip', 422), ('huge.txt', b'a' * (MAX_UPLOAD_BYTES + 1), 413)]:
            self.assertEqual(self.upload(filename, data).status_code, code)
        self.assertEqual(self.client.post('/cases/import', json={'file': 'not a file'}).status_code, 415)
        response = self.client.post('/cases/import', files=[('file', ('one.txt', b'case')), ('file', ('two.txt', b'case'))])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.post('/cases/import', files={'other': ('case.txt', b'case')}).status_code, 422)

    def test_multipart_truncation_and_no_disk_spooling(self):
        response = self.client.post('/cases/import', content=b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="case.txt"\r\n\r\nTruncated', headers={'content-type': 'multipart/form-data; boundary=boundary'})
        self.assertEqual(response.status_code, 422)
        with patch('python_multipart.multipart.File.flush_to_disk', side_effect=AssertionError('must remain in memory')):
            self.assertEqual(self.upload('large.txt', b'x' * (1024 * 1024 + 1)).status_code, 413)

    def test_case_context_limits(self):
        case = {'title': 'My moot', 'facts': 'a' * MAX_CASE_CHARACTERS, 'issues': ['Issue?']}
        Case.model_validate(case)
        for update in [{'facts': 'a' * (MAX_CASE_CHARACTERS + 1)}, {'issues': ['a' * 1001]}, {'facts': '  '}, {'precedents': ['a' * 1000] * 50}]:
            with self.assertRaises(ValueError):
                Case.model_validate({**case, **update})


if __name__ == '__main__':
    unittest.main()
