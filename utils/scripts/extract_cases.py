from openai import OpenAI
import json
import time
import os
from dotenv import load_dotenv
import re

load_dotenv()
INPUT_FILE = "../data/scraped.json"
OUTPUT_FILE = "../data/cases.json"
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)
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

def clean_judgment_text(text: str) -> str:
    if not text:
        return ""

    # Normalize line endings
    text = text.replace("\r", "\n")

    # Remove excessive escaped newlines/tabs from scraping
    text = text.replace("\\n", "\n")
    text = text.replace("\\t", " ")

    # Remove repeated spaces
    text = re.sub(r"[ \t]+", " ", text)

    # Remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove citation clutter at top
    text = re.sub(
        r"Equivalent citations:.*?(?=\nAuthor:|\nBench:|\nPETITIONER:)",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Remove kanoon cite metadata
    text = re.sub(
        r"\[Cites.*?Cited by.*?\]",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Remove excessive weird spacing between letters
    text = re.sub(r"([a-zA-Z])\s{2,}([a-zA-Z])", r"\1 \2", text)

    # Collapse broken OCR spacing
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"\n\s+", "\n", text)

    # Trim
    text = text.strip()

    return text

def extract_case(raw_case):
    text = raw_case.get("full_text", "")

    # Clean the judgment text
    text = clean_judgment_text(text)

    # Trim to avoid token overflow. First 12000 chars is usually enough
    text = text[:25000]

    prompt = PROMPT_TEMPLATE.format(text=text)

    try:
        response = client.chat.completions.create(
            model="google/gemini-2.0-flash-001",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if Gemini adds them anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        extracted = json.loads(raw)
        extracted["case_id"] = raw_case.get("case_id")
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
        done_ids = {c["case_id"] for c in extracted_cases}
        print(f"Resuming — {len(extracted_cases)} already extracted.")
    else:
        extracted_cases = []
        done_ids = set()

    for i, case in enumerate(cases):
        case_id = case.get("case_id")
        title = case.get("title", "Unknown")[:60]

        if case_id in done_ids:
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

        # Avoid API rate limit
        time.sleep(40)

    print(f"\nDone. {len(extracted_cases)} cases saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()