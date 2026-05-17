import json
import time
import os
import random
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
INPUT_FILE = "../data/cases.json"
OUTPUT_FILE = "../data/dataset.json"
MODEL = "deepseek-v4-flash"

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

# ============================================================
# 9 BEHAVIORAL PROFILES
# Scorer never sees these labels — only the raw argument.
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
- Sounds confident but is completely off-target"""
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
- OR argues something inconsistent with their side's stated stand
- Uses confident formal language so it's not immediately obvious — sounds plausible until you think about it"""
    },
    {
        "id": "citation_drop_no_ratio",
        "instruction": """Generate an argument where the counsel:
- Name-drops multiple famous cases (DK Basu, Maneka Gandhi, Olga Tellis, Vishaka, etc.) confidently
- But never explains what those cases actually held — just cites them as if the name alone proves the point
- Does not explain HOW the ratio of any case applies to the current facts
- Sounds authoritative but is legally hollow"""
    },
    {
        "id": "sharp_hypothetical_handler",
        "instruction": """Generate an argument where the counsel is responding to a tough hypothetical or question from the bench:
- Start with: "My Lords, in response to the question posed by the Hon'ble bench..."
- Acknowledges the hypothetical directly without dodging it
- Explains clearly why their position still holds despite the hypothetical
- Draws a precise legal distinction to answer the challenge
- Shows genuine legal reasoning under pressure — solid and composed"""
    },
    {
        "id": "procedurally_correct_legally_empty",
        "instruction": """Generate an argument where the counsel:
- Uses perfect moot court etiquette and formal language throughout
- Has excellent structure — clear issue identification, logical flow, proper transitions
- But the actual legal content is empty — just restating facts in legal-sounding language
- No legal principle, no citation, no application — just dressed-up facts
- Sounds very polished and professional but says nothing of legal substance"""
    }
]

NON_HYPOTHETICAL_PROFILES = [p for p in PROFILES if p["id"] != "sharp_hypothetical_handler"]
HYPOTHETICAL_PROFILE = next(p for p in PROFILES if p["id"] == "sharp_hypothetical_handler")

# ============================================================
# API CALL
# ============================================================

def call_llm(system_prompt, user_prompt, temperature=0.8):
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"  [ERROR attempt {attempt+1}] {e}")
            time.sleep(6 * (attempt + 1))
    raise Exception("All 3 attempts failed")


def parse_json(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ============================================================
# PROMPTS
# ============================================================

ARG_SYSTEM = "You are a moot court coach generating realistic oral arguments for a Supreme Court moot court simulation. Follow instructions precisely."

ARG_USER = """CASE:
Title: {case_title}
Summary: {case_summary}
Legal Issue: {legal_issue}
Petitioner's Stand: {petitioner_stand}
Respondent's Stand: {respondent_stand}
Relevant Laws: {relevant_laws}

SIDE: {side}

CONTEXT FROM PREVIOUS TURN:
{previous_context}

BEHAVIORAL INSTRUCTION (follow this precisely — this defines HOW the counsel argues):
{instruction}

ALL arguments must use formal moot court language:
- "My Lords, the counsel humbly submits that..."
- "If Your Lordships are satisfied, the counsel seeks to proceed..."
- "My Lords, the counsel draws the attention of the Hon'ble bench to..."
- "Much obliged, My Lords."

Length: 4-7 sentences. ONE legal point only.

Return ONLY the argument text as a plain string. No JSON, no preamble, no backticks."""


SCORE_SYSTEM = "You are a sharp, experienced Supreme Court judge presiding over a moot court competition. You have been silently taking notes. Evaluate arguments strictly and independently per criterion."

SCORE_USER = """CASE CONTEXT:
Title: {case_title}
Legal Issue: {legal_issue}
Petitioner's Stand: {petitioner_stand}
Respondent's Stand: {respondent_stand}
Relevant Laws: {relevant_laws}

CURRENT SUBMISSION:
Side: {side}
{context_block}
Argument just made:
\"{current_argument}\"

{bench_handling_note}

SCORING RULES — read carefully:
Evaluate each criterion COMPLETELY INDEPENDENTLY. One argument can score +3 on one and -3 on another — this is expected and correct.

- legal_application (-3 to +3):
  +3 = correctly identified AND precisely applied specific law/precedent to these exact facts
  0 = vague or partially correct
  -3 = wrong law, completely misapplied, or cited without any application
  MUST be negative if law is misapplied or absent.

- issue_relevance (-3 to +3):
  +3 = directly addresses the core legal issue of this case
  0 = loosely related
  -3 = argued something entirely tangential to the actual issue
  MUST be negative if argument misses the issue entirely.

- argument_flow (-3 to +3):
  +3 = perfectly structured, logical sequence, coherent
  0 = somewhat structured
  -3 = incoherent, jumps around, no logical sequence
  Score this REGARDLESS of legal accuracy.

- bench_handling (-3 to +3 or null):
  Score ONLY if counsel was responding to a judge question.
  +3 = directly addressed question, sharp reasoning under pressure
  -3 = dodged question, gave generic answer, fell apart
  null if unprompted submission.

STRICT: Weak, off-topic, or legally hollow arguments MUST receive negative scores. Never give benefit of the doubt.

JUDGE RESPONSE — pick ONE after counsel yields:
A) Ask one sharp focused question about a gap, inconsistency, or specific point
B) Challenge with a precise hypothetical — "If X, does your argument still hold?"
C) Transfer to opposing counsel with a brief remark

IMPORTANT: speaker_switch must be true roughly 40% of the time. If last 2+ turns had speaker_switch=false, strongly prefer true now.

Style: One line only. "Counsel, what is your submission on...", "Can you take the bench to...", "The bench will now hear..."

speaker_switch:
- false → asked a question, same counsel answers next
- true → transferring to other side

judge_notes: One raw honest private observation. Not formal.

GOOD judge_response examples:
- "Counsel, you rely on Article 21 but have not addressed procedure established by law — what is your submission?"
- "The bench notes your reliance on Maneka Gandhi — that dealt with passport seizure, how does its ratio apply here?"
- "If the State had given 24 hours notice before detention, would your arbitrariness argument still hold?"
- "The bench will now hear the respondent."

GOOD judge_notes examples:
- "Petitioner keeps citing DK Basu but hasn't touched sovereign immunity at all"
- "Strong — knows the Maneka Gandhi ratio cold, watch cross on procedure"
- "Structurally clean but said absolutely nothing of legal substance"
- "Cited three cases, explained none — classic citation bluff"
- "Completely off-topic — argued criminal liability in a constitutional matter"

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

    for i, case in enumerate(cases):
        doc_id = case.get("doc_id")
        title = case.get("case_title", "Unknown")[:60]
        relevant_laws_str = ", ".join(case["relevant_laws"])

        if doc_id in done_ids:
            print(f"[{i+1}/{len(cases)}] Skipping: {title}")
            continue

        print(f"\n[{i+1}/{len(cases)}] {title}")

        # Profile pool setup
        non_hyp_pool = NON_HYPOTHETICAL_PROFILES.copy()
        random.shuffle(non_hyp_pool)
        hyp_used = False

        history = []
        case_turns = []
        current_side = "petitioner"
        petitioner_first_done = False
        respondent_first_done = False
        turn = 0

        while turn < 9:
            prev_was_question = bool(history) and not history[-1].get("speaker_switch", True)

            # Profile selection
            if prev_was_question and not hyp_used:
                profile = HYPOTHETICAL_PROFILE
                hyp_used = True
            elif not non_hyp_pool and not hyp_used:
                # Pool exhausted, hyp never triggered — use it now
                profile = HYPOTHETICAL_PROFILE
                hyp_used = True
            elif not non_hyp_pool:
                # Both exhausted — refill non-hyp
                non_hyp_pool = NON_HYPOTHETICAL_PROFILES.copy()
                random.shuffle(non_hyp_pool)
                profile = non_hyp_pool.pop(0)
            else:
                profile = non_hyp_pool.pop(0)

            print(f"  Turn {turn+1}/9 — {current_side} | {profile['id']}")

            # Build generation context
            if prev_was_question:
                previous_context = f"The judge just asked: \"{history[-1]['judge_response']}\"\nYou are responding to this question directly."
            elif history:
                last_opposing = next((h["argument"] for h in reversed(history) if h["side"] != current_side), None)
                previous_context = f"Opposing counsel last argued: \"{last_opposing}\"" if last_opposing else "This is your opening submission."
            else:
                previous_context = "This is the opening submission of the case."

            # GENERATE
            arg_user = ARG_USER.format(
                case_title=case["case_title"],
                case_summary=case["case_summary"],
                legal_issue=case["legal_issue"],
                petitioner_stand=case["petitioner_stand"],
                respondent_stand=case["respondent_stand"],
                relevant_laws=relevant_laws_str,
                side=current_side.upper(),
                previous_context=previous_context,
                instruction=profile["instruction"]
            )

            try:
                argument_text = call_llm(ARG_SYSTEM, arg_user, temperature=0.85)
            except Exception as e:
                print(f"  [GEN FAILED] {e} — skipping case")
                case_turns = []
                break

            time.sleep(3)

            # Build scoring context
            is_first_of_side = (
                (current_side == "petitioner" and not petitioner_first_done) or
                (current_side == "respondent" and not respondent_first_done)
            )

            if is_first_of_side:
                context_block = ""
                bench_handling_note = "Note: This is the first submission of this side. Set bench_handling to null."
            elif prev_was_question:
                context_block = f"Judge's question counsel is responding to:\n\"{history[-1]['judge_response']}\"\n"
                bench_handling_note = "Note: This counsel is RESPONDING to the judge's question. Score bench_handling."
            else:
                last_opposing = next((h["argument"] for h in reversed(history) if h["side"] != current_side), None)
                context_block = f"Opposing counsel last argued:\n\"{last_opposing}\"\n" if last_opposing else ""
                bench_handling_note = "Note: This is an unprompted submission. Set bench_handling to null."

            score_user = SCORE_USER.format(
                case_title=case["case_title"],
                legal_issue=case["legal_issue"],
                petitioner_stand=case["petitioner_stand"],
                respondent_stand=case["respondent_stand"],
                relevant_laws=relevant_laws_str,
                side=current_side.upper(),
                context_block=context_block,
                current_argument=argument_text,
                bench_handling_note=bench_handling_note
            )

            # SCORE
            try:
                raw_score = call_llm(SCORE_SYSTEM, score_user, temperature=0.7)
                scored = parse_json(raw_score)
            except Exception as e:
                print(f"  [SCORE FAILED] {e} — skipping turn")
                # Put profile back so it's not wasted
                if profile["id"] != "sharp_hypothetical_handler":
                    non_hyp_pool.insert(0, profile)
                else:
                    hyp_used = False
                time.sleep(10)
                turn += 1
                continue

            # Force null bench_handling on first turn of each side
            if is_first_of_side:
                scored["delta_scores"]["bench_handling"] = None
                if current_side == "petitioner":
                    petitioner_first_done = True
                else:
                    respondent_first_done = True

            # Build training input
            if prev_was_question and not is_first_of_side:
                input_context = {"judge_last_response": history[-1]["judge_response"]}
            else:
                last_opposing = next((h["argument"] for h in reversed(history) if h["side"] != current_side), None)
                input_context = {"opposing_last_argument": last_opposing}

            training_example = {
                "doc_id": doc_id,
                "turn": turn + 1,
                "profile_id": profile["id"],
                "input": {
                    "case_summary": case["case_summary"],
                    "legal_issue": case["legal_issue"],
                    "relevant_laws": relevant_laws_str,
                    "side": current_side,
                    **input_context,
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
                "side": current_side,
                "argument": argument_text,
                "judge_response": scored["judge_response"],
                "speaker_switch": scored["speaker_switch"],
                "judge_notes": scored["judge_notes"]
            })

            # Next side from speaker_switch
            if scored["speaker_switch"]:
                current_side = "respondent" if current_side == "petitioner" else "petitioner"

            turn += 1
            time.sleep(4)

        if case_turns:
            dataset.extend(case_turns)
            done_ids.add(doc_id)
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(dataset, f, ensure_ascii=False, indent=2)
            print(f"  [OK] {len(case_turns)} turns saved. Total: {len(dataset)}")
        else:
            print(f"  [SKIPPED] No turns saved for this case.")

        time.sleep(8)

    print(f"\nDone. {len(dataset)} total training examples in {OUTPUT_FILE}")


if __name__ == "__main__":
    main()