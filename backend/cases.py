"""The checked-in practice archive and bounded, memory-only document extraction."""

import io
import json
import re
import zipfile
from functools import lru_cache
from pathlib import Path
from xml.etree import ElementTree

from fastapi import HTTPException, Request
from pypdf import PdfReader
from python_multipart import create_form_parser
from python_multipart.exceptions import FormParserError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_CASE_CHARACTERS = 30000
MAX_EXTRACTED_CHARACTERS = 120000
MAX_PDF_PAGES = 100
MAX_XML_BYTES = 8 * 1024 * 1024
WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

CATEGORY_IDS = {
    "Criminal procedure": "501198 1857950 1830927 1353689 3966225 102741423 41420472 1288965 186425503 31336209 105430 131202146 57105555 14591172 193411084 1067991",
    "Courts & judicial review": "1152518 123456797 108920103 1292543 1069536",
    "Education": "1186368 101264378 1775396 154958944 4526047 40715 1235595 168982055",
    "Speech & media": "223504 110813550 125596 591481 539407 80997184",
    "Work & equality": "477313 1031794 9796957 1416283 1264252",
    "Commercial & property": "138264695 133647814 109788266 128108388 1513693 1703207 352854",
}


@lru_cache(maxsize=1)
def archive_cases():
    records = json.loads((Path(__file__).resolve().parents[1] / "utils/data/cases.json").read_text())
    categories = {case_id: category for category, ids in CATEGORY_IDS.items() for case_id in ids.split()}
    cases = []
    for record in records:
        case_id = str(record["case_id"])
        year = re.search(r"\b(?:19|20)\d{2}\b", record["case_title"])
        cases.append({
            "id": f"archive-{case_id}",
            "title": record["case_title"],
            "facts": record["case_summary"],
            "issues": [record["legal_issue"]],
            "precedents": record["relevant_laws"],
            "petitioner_stand": record.get("petitioner_stand", ""),
            "respondent_stand": record.get("respondent_stand", ""),
            "category": categories.get(case_id, "Constitutional rights"),
            "year": int(year.group()) if year else None,
            "source_url": record["url"],
            "source_label": "Indian Kanoon",
            "brief_note": "Archive practice summary. Check the linked judgment; summaries may contain inferred positions and the decided outcome.",
        })
    return cases


def search_cases(q="", category="", offset=0, limit=12):
    cases = archive_cases()
    words = q.casefold().split()
    matches = []
    for case in cases:
        if category and category != case["category"]:
            continue
        searchable = " ".join([case["title"], case["facts"], case["category"], *case["issues"], *case["precedents"], case["petitioner_stand"], case["respondent_stand"]]).casefold()
        if all(word in searchable for word in words):
            matches.append(case)
    return {"items": matches[offset:offset + limit], "total": len(matches), "offset": offset, "limit": limit, "categories": sorted({case["category"] for case in cases})}


async def read_upload(request: Request):
    """Use the streaming parser directly; framework UploadFile defaults spool to disk."""
    content_type = request.headers.get("content-type", "")
    if not content_type.lower().startswith("multipart/form-data;") or len(content_type) > 512:
        raise HTTPException(415, "Choose one PDF, DOCX or TXT file to import.")
    uploads = []
    complete = False

    def on_field(_field):
        raise HTTPException(422, "Send one document in the file field.")

    def on_file(file):
        try:
            if uploads or file.field_name != b"file" or not file.file_name:
                raise HTTPException(422, "Choose one document at a time.")
            if file.size > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "This document exceeds 10 MB. Upload a smaller file.")
            file.file_object.seek(0)
            uploads.append((file.file_name.decode("utf-8", errors="replace"), file.file_object.read()))
        finally:
            file.close()

    def on_end():
        nonlocal complete
        complete = True

    parser = None
    try:
        parser = create_form_parser({"Content-Type": content_type.encode("latin-1")}, on_field, on_file, config={"MAX_MEMORY_FILE_SIZE": float("inf"), "MAX_HEADER_SIZE": 8192})
        parser.parser.set_callback("end", on_end)
        received = 0
        async for chunk in request.stream():
            received += len(chunk)
            if received > MAX_UPLOAD_BYTES + 16384:
                raise HTTPException(413, "This document exceeds 10 MB. Upload a smaller file.")
            parser.write(chunk)
        parser.finalize()
        if not complete or len(uploads) != 1:
            raise HTTPException(422, "The upload did not finish. Choose the file and try again.")
        return uploads[0]
    except (FormParserError, ValueError, UnicodeError) as exc:
        raise HTTPException(422, "The upload could not be read. Choose the file and try again.") from exc
    finally:
        if parser:
            parser.close()


def _pdf_text(data):
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        raise HTTPException(422, "This PDF is password-protected. Upload an unlocked copy.")
    if len(reader.pages) > MAX_PDF_PAGES:
        raise HTTPException(413, "This PDF exceeds 100 pages. Upload the moot proposition or relevant pages.")
    parts, empty_pages, characters, decoded_bytes = [], [], 0, 0
    for number, page in enumerate(reader.pages, 1):
        contents = page.get_contents()
        content_size = len(contents.get_data()) if contents else 0
        decoded_bytes += content_size
        if content_size > 2 * 1024 * 1024 or decoded_bytes > 20 * 1024 * 1024:
            raise HTTPException(413, "This PDF is too complex to import. Export a simpler PDF or a text document.")
        text = page.extract_text() or ""
        characters += len(text)
        if characters > MAX_EXTRACTED_CHARACTERS:
            raise HTTPException(413, "This document exceeds 120,000 extracted characters. Upload the relevant sections as a smaller document.")
        if not text.strip():
            empty_pages.append(number)
        parts.append(text)
    warnings = ["Check the extracted text against your PDF, especially tables, equations and footnotes. Images are not imported."]
    if empty_pages:
        warnings.append("No text was found on page(s) " + ", ".join(map(str, empty_pages)) + ". These may be scans; their contents have not been imported.")
    return "\n\n".join(parts), len(reader.pages), warnings


def _docx_text(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > 1000 or sum(entry.file_size for entry in entries) > 30 * 1024 * 1024:
            raise HTTPException(413, "This DOCX expands beyond the import limit. Export the relevant text to a smaller document.")
        if "word/document.xml" not in archive.namelist():
            raise HTTPException(422, "This file is not a readable Word document. Export it as DOCX or TXT and try again.")
        sections = []
        warnings = ["Check tables and footnotes against your document. Images, comments, headers and footers are not imported."]
        for name in ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"]:
            if name not in archive.namelist():
                continue
            info = archive.getinfo(name)
            if info.file_size > MAX_XML_BYTES or info.file_size > max(info.compress_size, 1) * 200:
                raise HTTPException(413, "This DOCX is too complex to import. Export a simpler DOCX or TXT file.")
            xml = archive.read(name)
            declarations = xml.replace(b"\x00", b"").upper()
            if b"<!DOCTYPE" in declarations or b"<!ENTITY" in declarations:
                raise HTTPException(422, "This DOCX contains unsupported XML. Export it as a new DOCX or TXT file.")
            root = ElementTree.fromstring(xml)
            if any(node.tag in {WORD_NS + "ins", WORD_NS + "del"} for node in root.iter()):
                warnings.append("This document contains tracked changes. The extracted text includes insertions and excludes deletions; review the intended version.")
            paragraphs = []
            for paragraph in root.iter(WORD_NS + "p"):
                text = "".join((node.text or "") if node.tag == WORD_NS + "t" else "\t" if node.tag == WORD_NS + "tab" else "\n" if node.tag in {WORD_NS + "br", WORD_NS + "cr"} else "" for node in paragraph.iter())
                if text.strip():
                    paragraphs.append(text)
            if name != "word/document.xml" and paragraphs:
                sections.append("Footnotes" if "footnotes" in name else "Endnotes")
            sections.extend(paragraphs)
        return "\n\n".join(sections), None, list(dict.fromkeys(warnings))


def extract_document(filename, data):
    filename = re.sub(r"[\x00-\x1f\x7f]", "", filename.replace("\\", "/").rsplit("/", 1)[-1])[:240]
    suffix = Path(filename).suffix.lower()
    if suffix not in {".pdf", ".docx", ".txt"}:
        raise HTTPException(415, "Use a PDF, DOCX or TXT file. For a scanned document, export a searchable PDF first.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "This document exceeds 10 MB. Upload a smaller file.")
    if not data:
        raise HTTPException(422, "This file is empty. Choose a document containing your case.")
    try:
        if suffix == ".pdf":
            if not data.startswith(b"%PDF-"):
                raise ValueError("Invalid PDF signature")
            text, pages, warnings = _pdf_text(data)
        elif suffix == ".docx":
            text, pages, warnings = _docx_text(data)
        else:
            text = data.decode("utf-16" if data.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")
            if any(ord(char) < 32 and char not in "\t\r\n\f" for char in text):
                raise ValueError("Binary text")
            pages, warnings = None, []
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, "This document could not be read. It may be damaged or in an unsupported format. Export a new PDF, DOCX or UTF-8 TXT file and try again.") from exc
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        raise HTTPException(422, "No readable text was found. Scanned PDFs need text recognition first; upload a searchable PDF, DOCX or TXT file.")
    if len(text) > MAX_EXTRACTED_CHARACTERS:
        raise HTTPException(413, "This document exceeds 120,000 extracted characters. Upload the relevant sections as a smaller document.")
    if len(text) > MAX_CASE_CHARACTERS:
        warnings.append("All extracted text is shown. Shorten the hearing brief to 30,000 characters before entering court; nothing has been truncated.")
    return {"title": Path(filename).stem.replace("_", " ")[:200] or "My moot proposition", "text": text, "filename": filename, "characters": len(text), "pages": pages, "warnings": warnings, "max_case_characters": MAX_CASE_CHARACTERS}
