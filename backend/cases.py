"""The checked-in practice archive."""

import json
import re
from functools import lru_cache
from pathlib import Path

MAX_CASE_CHARACTERS = 30000

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
