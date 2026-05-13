import google.generativeai as genai
import json
import time
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
INPUT_FILE = "../data/scraped.json"
OUTPUT_FILE = "../data/cases.json"

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

PROMPT_TEMPLATE = """You are a senior legal expert and moot court coach. Analyze this Indian court judgment and return a JSON object with exactly these fields:

{{
  "case_title": "Full case name and year",
  "case_summary": "5-6 line summary covering: who the parties are, what happened, what was disputed, and what the court decided. Written clearly so a non-lawyer can understand.",
  "legal_issue": "One precise sentence — the exact constitutional or legal question the court had to answer. This is the question moot court participants will argue about.",
  "petitioner_stand": "2-3 lines on what the petitioner argued and what relief they sought.",
  "respondent_stand": "2-3 lines on what the respondent argued in defense.",
  "relevant_laws": ["List of specific Articles, Sections, or Acts cited — e.g. Article 21 Constitution of India, Section 330 IPC"],
}}

Return ONLY the JSON object. No preamble, no explanation, no markdown backticks.

JUDGMENT TEXT:
{text}"""


def extract_case(raw_case):
    text = raw_case.get("full_text", "")

    # Trim to avoid token overflow. First 12000 chars is usually enough
    text = text[:12000]

    prompt = PROMPT_TEMPLATE.format(text=text)

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Strip markdown fences if Gemini adds them anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        extracted = json.loads(raw)
        extracted["doc_id"] = raw_case.get("doc_id")
        extracted["url"] = raw_case.get("url")
        return extracted

    except json.JSONDecodeError as e:
        print(f"  [JSON ERROR] {e}")
        print(f"  Raw response: {response.text[:300]}")
        return None
    except Exception as e:
        print(f"  [API ERROR] {e}")
        return None


def main():
    # Load scraped cases
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        cases = json.load(f)
    print(f"Loaded {len(cases)} cases from {INPUT_FILE}")

    # Resume support
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            extracted_cases = json.load(f)
        done_ids = {c["doc_id"] for c in extracted_cases}
        print(f"Resuming — {len(extracted_cases)} already extracted.")
    else:
        extracted_cases = []
        done_ids = set()

    for i, case in enumerate(cases):
        doc_id = case.get("doc_id")
        title = case.get("title", "Unknown")[:60]

        if doc_id in done_ids:
            print(f"[{i+1}/{len(cases)}] Skipping: {title}")
            continue

        print(f"[{i+1}/{len(cases)}] Extracting: {title}")
        result = extract_case(case)

        if result:
            extracted_cases.append(result)
            print(f"  [OK] Issue: {result.get('legal_issue', '')[:80]}")
        else:
            print(f"  [FAILED] Skipping this case.")

        # Save after every case
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(extracted_cases, f, ensure_ascii=False, indent=2)

        # Rate limit safety
        time.sleep(3)

    print(f"\nDone. {len(extracted_cases)} cases saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()