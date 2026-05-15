import json
import time
import os
import random
import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")
INPUT_FILE = "../data/cases.json"
OUTPUT_FILE = "../data/dataset.json"
MODEL = "google/gemini-2.0-flash-001"

# ============================================================
# 9 BEHAVIORAL PROFILES
# One per turn. Each produces a distinct score pattern.
# Scorer never sees these labels — only the argument.
# ============================================================

PROFILES = [
    {
        "id": "precise_complete",
        "instruction": """Generate an argument where the counsel:
- Identifies the exact constitutional provision or statute relevant to the issue
- Correctly states the ratio of a real precedent and applies it directly to the facts of THIS case
- Addresses the core legal issue being argued — not a tangent
- Preemptively addresses the obvious counterargument in one line
The argument sounds confident, structured, and well-prepared."""
    },
    {
        "id": "right_law_wrong_facts",
        "instruction": """Generate an argument where the counsel:
- Cites a correct and relevant legal provision or precedent
- But applies it to facts that don't quite match — stretches the ratio beyond what the case actually held
- The argument sounds plausible on the surface but collapses under scrutiny
- The structure is okay but the factual application is clearly off"""
    },
    {
        "id": "tangential_issue",
        "instruction": """Generate an argument where the counsel:
- Is very well-structured and fluent — clear logical flow, good moot court language
- But is arguing a legal point that is tangential to the core issue framed in this case
- The argument would be valid in a different context but simply doesn't address what this case is about
- Sounds confident but is off-target"""
    },
    {
        "id": "vague_but_correct",
        "instruction": """Generate an argument where the counsel:
- Makes a legally correct general point — points in the right direction
- But is vague — no specific citations, no precise ratio, no case names
- Uses phrases like "it is well settled that..." or "the law recognizes..." without backing it up
- Sounds like someone who understands the area but hasn't prepared deeply enough"""
    },
    {
        "id": "strong_rebuttal_weak_substance",
        "instruction": """Generate an argument where the counsel:
- Directly and sharply addresses what the opposing counsel just argued — good rebuttal instinct
- But the counter-argument itself is legally thin or unsupported
- They identify the right target but don't land the punch with legal precision
- Sounds reactive and engaged but substantively weak"""
    },
    {
        "id": "contradicts_own_side",
        "instruction": """Generate an argument where the counsel:
- Makes a point that inadvertently undermines their own side's position
- OR concedes something they absolutely should not concede
- OR argues something that is inconsistent with their side's stated stand
- Uses confident formal language so it's not immediately obvious — sounds plausible until you think about it"""
    },
    {
        "id": "citation_drop_no_ratio",
        "instruction": """Generate an argument where the counsel:
- Name-drops multiple famous cases (DK Basu, Maneka Gandhi, Olga Tellis, etc.) confidently
- But never explains what those cases actually held — just cites them as if the name alone proves the point
- Does not explain HOW the ratio of any case applies to the current facts
- Sounds authoritative but is legally hollow"""
    },
    {
        "id": "sharp_hypothetical_handler",
        "instruction": """Generate an argument where the counsel:
- Is responding to a tough hypothetical or question from the bench
- Handles it cleanly — acknowledges the hypothetical, explains why their position still holds, draws a clear distinction
- Shows genuine legal reasoning under pressure
- This argument IS a response to a judge question — write it as such, starting with "My Lords, in response to the question posed by the Hon'ble bench..."
- The substance should be solid even if the overall case position is complex"""
    },
    {
        "id": "procedurally_correct_legally_empty",
        "instruction": """Generate an argument where the counsel:
- Uses perfect moot court etiquette and formal language throughout
- Has excellent structure — clear issue identification, logical flow, proper transitions
- But the actual legal content is empty — no real argument, just restating facts in legal-sounding language
- Sounds very polished and professional but says nothing of legal substance
- Like someone who memorized the format but not the law"""
    }
]

# ============================================================

def call_llm(prompt, temperature=0.8):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "model": MODEL,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}]
    }
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=body,
        timeout=60
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


def parse_json(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ============================================================
# ARGUMENT GENERATION — one call per profile
# ============================================================

ARG_PROMPT = """You are a moot court coach generating a single oral argument for a Supreme Court moot court simulation.

CASE:
Title: {case_title}
Summary: {case_summary}
Legal Issue: {legal_issue}
Petitioner's Stand: {petitioner_stand}
Respondent's Stand: {respondent_stand}
Relevant Laws: {relevant_laws}

SIDE: {side}

BEHAVIORAL INSTRUCTION (follow this precisely — this defines HOW the counsel argues):
{instruction}

ALL arguments must use formal moot court language:
- "My Lords, the counsel humbly submits that..."
- "If Your Lordships are satisfied, the counsel seeks to proceed..."
- "My Lords, the counsel draws the attention of the Hon'ble bench to..."
- "Much obliged, My Lords."

Length: 4-7 sentences. ONE legal point only.

Return ONLY the argument text as a plain string. No JSON, no preamble, no backticks."""


# ============================================================
# SCORING — scorer never sees profile labels
# ============================================================

SCORING_PROMPT = """You are a sharp, experienced Supreme Court judge presiding over a moot court competition. You have been silently taking notes. The counsel has just finished their submission and yielded the floor.

CASE CONTEXT:
Title: {case_title}
Legal Issue: {legal_issue}
Petitioner's Stand: {petitioner_stand}
Respondent's Stand: {respondent_stand}
Relevant Laws: {relevant_laws}

CURRENT SUBMISSION:
Side: {side}
{opposing_context}
Argument just made:
\"{current_argument}\"

{bench_handling_note}

SCORING RULES:
Evaluate each criterion COMPLETELY INDEPENDENTLY. A single argument can score high on one criterion and low on another — this is expected and correct.

- legal_application (-3 to +3): Did they correctly identify AND apply the specific law/precedent to these exact facts? +3 = precise and correct. -3 = wrong law or completely misapplied.
- issue_relevance (-3 to +3): Did this argument address the actual legal issue being argued in this case? +3 = directly on point. -3 = argued something entirely tangential.
- argument_flow (-3 to +3): Was the argument logically structured, coherent, and well-sequenced? Score this REGARDLESS of legal accuracy — a wrong argument can still be well-structured.
- bench_handling (-3 to +3 or null): ONLY if this is a response to a judge's question — how well did they handle the pressure? null if unprompted submission.

DO NOT move all four scores in the same direction. Each criterion is independent.

JUDGE RESPONSE — after counsel yields floor, pick ONE:
A) Ask one sharp question about a specific gap, inconsistency, or interesting point
B) Challenge with a precise hypothetical ("If X, does your argument still hold?")
C) Transfer to opposing counsel if nothing meaningful to probe

Rules:
- One line only. Judges do not lecture.
- Use: "Counsel, what is your submission on...", "Can you take the bench to...", "The bench will now hear..."

speaker_switch:
- false → you asked a question (same counsel answers next)
- true → transferring to other side

judge_notes: One raw honest private observation. What you actually think. Not formal.

GOOD judge_response examples:
- "Counsel, you rely on Article 21 but have not addressed the procedure established by law — what is your submission on that?"
- "The bench notes your reliance on Maneka Gandhi — that case dealt with passport seizure, how does its ratio apply here?"
- "If the State had given 24 hours notice before detention, would your argument on arbitrariness still hold?"
- "The bench will now hear the respondent."

GOOD judge_notes examples:
- "Petitioner keeps citing DK Basu but hasn't touched sovereign immunity at all"
- "Strong — knows the Maneka Gandhi ratio cold, watch how they handle cross on procedure"
- "Structurally clean but said absolutely nothing of legal substance"
- "Dodged the Article 22(2) question entirely, flagging for later"
- "Cited three cases, explained none of them — classic citation bluff"

Return ONLY a JSON object, no preamble, no backticks:
{{
  "delta_scores": {{
    "legal_application": <integer -3 to +3>,
    "issue_relevance": <integer -3 to +3>,
    "argument_flow": <integer -3 to +3>,
    "bench_handling": <integer -3 to +3 or null>
  }},
  "judge_response": "...",
  "speaker_switch": <true or false>,
  "judge_notes": "..."
}}"""


def build_scoring_prompt(case, history, current_argument, side):
    opposing_last = None
    for turn in reversed(history):
        if turn["side"] != side:
            opposing_last = turn["argument"]
            break

    opposing_context = (
        f"What opposing counsel last argued:\n\"{opposing_last}\"\n"
        if opposing_last else ""
    )

    prev_was_question = bool(history) and not history[-1].get("speaker_switch", True)
    bench_handling_note = (
        "Note: This counsel is RESPONDING to the judge's previous question. Score bench_handling based on how well they handled it."
        if prev_was_question else
        "Note: This is an unprompted submission, NOT a response to a judge question. Set bench_handling to null."
    )

    return SCORING_PROMPT.format(
        case_title=case["case_title"],
        legal_issue=case["legal_issue"],
        petitioner_stand=case["petitioner_stand"],
        respondent_stand=case["respondent_stand"],
        relevant_laws=", ".join(case["relevant_laws"]),
        side=side.upper(),
        opposing_context=opposing_context,
        current_argument=current_argument,
        bench_handling_note=bench_handling_note
    )


# ============================================================
# MAIN
# ============================================================

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        cases = json.load(f)
    print(f"Loaded {len(cases)} cases")

    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            dataset = json.load(f)
        done_ids = {entry["doc_id"] for entry in dataset}
        print(f"Resuming — {len(done_ids)} cases already done")
    else:
        dataset = []
        done_ids = set()

    # Alternate sides — petitioner odd turns, respondent even
    sides = ["petitioner", "respondent"] * 5  # 10 elements, take 9

    for i, case in enumerate(cases):
        doc_id = case.get("doc_id")
        title = case.get("case_title", "Unknown")[:60]

        if doc_id in done_ids:
            print(f"[{i+1}/{len(cases)}] Skipping: {title}")
            continue

        print(f"\n[{i+1}/{len(cases)}] {title}")

        # Shuffle profiles — guaranteed all 9 used exactly once
        shuffled_profiles = PROFILES.copy()
        random.shuffle(shuffled_profiles)

        # Assign sides — shuffle side order too for variety but keep alternating base
        side_order = sides[:9]
        random.shuffle(side_order)

        # Generate all 9 arguments first
        arguments = []
        failed = False
        for j, profile in enumerate(shuffled_profiles):
            side = side_order[j]
            print(f"  Generating turn {j+1}/9 — profile: {profile['id']} ({side})")

            prompt = ARG_PROMPT.format(
                case_title=case["case_title"],
                case_summary=case["case_summary"],
                legal_issue=case["legal_issue"],
                petitioner_stand=case["petitioner_stand"],
                respondent_stand=case["respondent_stand"],
                relevant_laws=", ".join(case["relevant_laws"]),
                side=side.upper(),
                instruction=profile["instruction"]
            )

            try:
                argument_text = call_llm(prompt, temperature=0.85)
                arguments.append({
                    "side": side,
                    "argument": argument_text,
                    "profile_id": profile["id"]
                })
            except Exception as e:
                print(f"  [GEN FAILED] {e}")
                failed = True
                break

            time.sleep(3)

        if failed or len(arguments) < 9:
            print(f"  Skipping — only got {len(arguments)} arguments")
            continue

        # Score each turn with growing history
        history = []
        case_turns = []
        petitioner_first_done = False
        respondent_first_done = False

        for j, arg in enumerate(arguments):
            side = arg["side"]
            argument_text = arg["argument"]
            profile_id = arg["profile_id"]

            is_first_of_side = (
                (side == "petitioner" and not petitioner_first_done) or
                (side == "respondent" and not respondent_first_done)
            )

            print(f"  Scoring turn {j+1}/9 ({side}, {profile_id})")

            scoring_prompt = build_scoring_prompt(case, history, argument_text, side)

            try:
                raw_score = call_llm(scoring_prompt, temperature=0.7)
                scored = parse_json(raw_score)
            except Exception as e:
                print(f"  [SCORE FAILED] {e}")
                time.sleep(10)
                continue

            # Force null bench_handling on first turn of each side
            if is_first_of_side:
                scored["delta_scores"]["bench_handling"] = None
                if side == "petitioner":
                    petitioner_first_done = True
                else:
                    respondent_first_done = True

            # Get opposing last argument for training input
            opposing_last = None
            for turn in reversed(history):
                if turn["side"] != side:
                    opposing_last = turn["argument"]
                    break

            training_example = {
                "doc_id": doc_id,
                "turn": j + 1,
                "profile_id": profile_id,  # for analysis — strip before training if needed
                "input": {
                    "case_summary": case["case_summary"],
                    "legal_issue": case["legal_issue"],
                    "relevant_laws": case["relevant_laws"],
                    "side": side,
                    "opposing_last_argument": opposing_last,
                    "current_argument": argument_text
                },
                "output": {
                    "delta_scores": scored["delta_scores"],
                    "judge_response": scored["judge_response"],
                    "speaker_switch": scored["speaker_switch"],
                    "judge_notes": scored["judge_notes"]
                }
            }

            case_turns.append(training_example)

            history.append({
                "side": side,
                "argument": argument_text,
                "speaker_switch": scored.get("speaker_switch", True),
                "judge_notes": scored.get("judge_notes", "")
            })

            time.sleep(4)

        dataset.extend(case_turns)
        done_ids.add(doc_id)

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)

        print(f"  [OK] {len(case_turns)} turns saved. Total dataset: {len(dataset)}")
        time.sleep(8)

    print(f"\nDone. {len(dataset)} total training examples in {OUTPUT_FILE}")


if __name__ == "__main__":
    main()