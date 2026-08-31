import json
import os
from dotenv import load_dotenv
import re
from urllib import error, request
from typing import Optional
from pathlib import Path
from http.client import HTTPException as HTTPClientException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, ValidationError

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

JUDGE_RESPONSE_FIELDS = (
    "feedback",
    "score",
    "logic_score",
    "clarity_score",
    "confidence_score",
    "interrupt",
    "evidence",
    "reasoning_breakdown",
)

SCORING_RUBRIC = {
    "logic": {
        "definition": "Measure legal relevance, precedent use, and factual consistency with the selected case.",
        "criteria": ["case_relevance", "precedent_use", "factual_consistency"],
    },
    "clarity": {
        "definition": "Measure structure, directness, and whether the submission answers the legal issue clearly.",
        "criteria": ["structure", "directness"],
    },
    "confidence": {
        "definition": "Measure courtroom tone, composure, and assertiveness without overclaiming.",
        "criteria": ["tone", "composure", "assertiveness"],
    },
}

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "from", "have", "has", "had",
    "were", "was", "are", "is", "be", "to", "of", "in", "on", "at", "by",
    "an", "a", "as", "it", "its", "or", "if", "can", "may", "will", "would",
    "should", "could", "do", "does", "did", "not", "but", "we", "they", "you",
    "your", "our", "their", "his", "her", "there", "here", "case", "court",
}

HEDGING_WORDS = {"maybe", "perhaps", "might", "possibly", "i think", "i guess", "probably"}
ASSERTIVE_WORDS = {"submit", "contend", "assert", "maintain", "demonstrates", "shows", "establishes"}
STRUCTURE_MARKERS = {"first", "second", "therefore", "because", "hence", "thus", "however", "finally"}


def clamp_score(value, minimum=0, maximum=10):
    return max(minimum, min(maximum, value))


def normalize_text(text: Optional[str]) -> str:
    return (text or "").strip().lower()


def tokenize(text: Optional[str]):
    return [token for token in TOKEN_RE.findall(normalize_text(text)) if token not in STOPWORDS]


def build_case_chunks(selected_case):
    if not selected_case:
        return []

    chunks = []
    case_title = selected_case.get("title", "Selected Case")

    facts = selected_case.get("facts")
    if facts:
        chunks.append({
            "case_title": case_title,
            "chunk_type": "facts",
            "label": "Facts",
            "text": str(facts).strip(),
        })

    for index, issue in enumerate(selected_case.get("issues", []) or [], start=1):
        issue_text = str(issue).strip()
        if issue_text:
            chunks.append({
                "case_title": case_title,
                "chunk_type": "issues",
                "label": f"Issue {index}",
                "text": issue_text,
            })

    for index, precedent in enumerate(selected_case.get("precedents", []) or [], start=1):
        precedent_text = str(precedent).strip()
        if precedent_text:
            chunks.append({
                "case_title": case_title,
                "chunk_type": "precedents",
                "label": f"Precedent {index}",
                "text": precedent_text,
            })

    return chunks


def build_retrieval_query(argument, history):
    query_parts = [argument or ""]
    for turn in (history or [])[-6:]:
        turn_text = turn.get("argument") or turn.get("text") or ""
        if turn_text:
            query_parts.append(turn_text)
    return " \n".join(part for part in query_parts if part).strip()


def match_chunk_terms(query_tokens, chunk_text):
    chunk_tokens = tokenize(chunk_text)
    if not query_tokens or not chunk_tokens:
        return []

    query_set = set(query_tokens)
    chunk_set = set(chunk_tokens)
    return sorted(query_set & chunk_set)


def retrieve_case_evidence(selected_case, argument, history, limit=4):
    case_chunks = build_case_chunks(selected_case)
    if not case_chunks:
        return []

    query_text = build_retrieval_query(argument, history)
    query_tokens = tokenize(query_text)
    scored_chunks = []

    for chunk in case_chunks:
        matched_terms = match_chunk_terms(query_tokens, chunk["text"])
        scored_chunks.append({
            "case_title": chunk["case_title"],
            "chunk_type": chunk["chunk_type"],
            "label": chunk["label"],
            "text": chunk["text"],
            "match_count": len(matched_terms),
            "matched_terms": matched_terms,
        })

    scored_chunks.sort(key=lambda item: (-item["match_count"], item["chunk_type"], item["label"]))

    top_chunks = scored_chunks[:limit]
    if top_chunks and all(item["match_count"] == 0 for item in top_chunks):
        return scored_chunks[:min(2, len(scored_chunks))]

    return top_chunks


def build_reasoning_breakdown(argument, retrieved_evidence):
    normalized_argument = normalize_text(argument)
    argument_tokens = tokenize(argument)
    token_count = len(argument_tokens)

    top_match_count = max((item.get("match_count", 0) for item in retrieved_evidence), default=0)
    precedent_hits = sum(1 for item in retrieved_evidence if item.get("chunk_type") == "precedents" and item.get("match_count", 0) > 0)
    has_citation_style = bool(re.search(r"\bv\.?\b|\barticle\b|\bsection\b|\bipc\b", normalized_argument))

    logic_relevance = clamp_score(4 + top_match_count)
    logic_precedent = clamp_score(5 + precedent_hits + (1 if has_citation_style else 0))
    logic_consistency = clamp_score(3 + top_match_count)

    sentence_count = max(1, len([segment for segment in re.split(r"[.?!]", argument or "") if segment.strip()]))
    structure_hits = sum(1 for marker in STRUCTURE_MARKERS if marker in normalized_argument)
    clarity_structure = clamp_score(4 + structure_hits + (1 if sentence_count >= 2 else 0))
    clarity_directness = clamp_score(7 if 25 <= token_count <= 170 else 5)

    hedge_hits = sum(1 for word in HEDGING_WORDS if word in normalized_argument)
    exclamation_overuse = (argument or "").count("!") >= 3
    all_caps_ratio = 0
    alpha_chars = [ch for ch in (argument or "") if ch.isalpha()]
    if alpha_chars:
        all_caps_ratio = sum(1 for ch in alpha_chars if ch.isupper()) / len(alpha_chars)

    confidence_tone = clamp_score(7 - hedge_hits)
    confidence_composure = clamp_score(7 - (2 if exclamation_overuse else 0) - (2 if all_caps_ratio > 0.35 else 0))
    assertive_hits = sum(1 for word in ASSERTIVE_WORDS if word in normalized_argument)
    confidence_assertiveness = clamp_score(5 + assertive_hits)

    return {
        "rubric": SCORING_RUBRIC,
        "diagnostics": {
            "logic": {
                "case_relevance": logic_relevance,
                "precedent_use": logic_precedent,
                "factual_consistency": logic_consistency,
            },
            "clarity": {
                "structure": clarity_structure,
                "directness": clarity_directness,
            },
            "confidence": {
                "tone": confidence_tone,
                "composure": confidence_composure,
                "assertiveness": confidence_assertiveness,
            },
        },
    }


def build_judge_response(*, feedback, logic_score, clarity_score, confidence_score, interrupt, evidence=None, reasoning_breakdown=None):
    overall_score = round((logic_score + clarity_score + confidence_score) / 3, 1)
    return {
        "feedback": feedback,
        "score": overall_score,
        "logic_score": logic_score,
        "clarity_score": clarity_score,
        "confidence_score": confidence_score,
        "interrupt": interrupt,
        "evidence": evidence or [],
        "reasoning_breakdown": reasoning_breakdown or {"rubric": SCORING_RUBRIC, "diagnostics": {}},
    }


class JudgeUnavailable(RuntimeError):
    pass


def providers(options=None, counsel=False):
    options = options or {}
    candidates = []
    prefix = "COUNSEL" if counsel else "THEMIS"
    url, model = os.getenv(f"{prefix}_BASE_URL"), os.getenv(f"{prefix}_MODEL")
    if url and model:
        candidates.append(("Fine-tuned judge" if not counsel else "AI counsel", url.rstrip("/") + "/chat/completions", model, os.getenv(f"{prefix}_API_KEY", "")))
    # Preserve compatibility with the original OpenRouter configuration.
    if not candidates and os.getenv("OPENROUTER_API_KEY"):
        candidates.append(("OpenRouter", os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1/chat/completions"), os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"), os.getenv("OPENROUTER_API_KEY")))
    key = options.get("openai_key") or os.getenv("OPENAI_API_KEY")
    if options.get("allow_fallback", True) and key:
        candidates.append(("OpenAI fallback", "https://api.openai.com/v1/chat/completions", options.get("openai_model") or os.getenv("OPENAI_MODEL", "gpt-4o-mini"), key))
    return candidates


def configuration_status():
    return {
        "judge_configured": bool(providers()),
        "counsel_configured": bool(providers(counsel=True)),
        "primary_judge_configured": bool(providers({"allow_fallback": False})),
        "primary_counsel_configured": bool(providers({"allow_fallback": False}, counsel=True)),
        "fine_tuned_configured": bool(os.getenv("THEMIS_BASE_URL") and os.getenv("THEMIS_MODEL")),
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    }


def completion(provider, messages):
    label, url, model, key = provider
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    payload = {"model": model, "messages": messages, "max_completion_tokens": 900} if label == "OpenAI fallback" else {"model": model, "messages": messages, "max_tokens": 900, "temperature": 0.2}
    try:
        req = request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
        try:
            configured_timeout = float(os.getenv("MODEL_TIMEOUT_SECONDS", "90"))
            timeout = max(5, min(120, configured_timeout))
        except ValueError:
            timeout = 90
        with request.urlopen(req, timeout=45 if label == "OpenAI fallback" else timeout) as response:
            data = json.loads(response.read(1_000_000))
        content = data["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Empty response")
        return content.strip()
    except (error.URLError, OSError, HTTPClientException, ValueError, KeyError, IndexError, TypeError) as exc:
        # Provider bodies can contain secrets or user submissions. Never expose them.
        raise JudgeUnavailable(f"{label} could not respond. Check its connection, model and credentials.") from exc



def call_openrouter(prompt, options=None):
    messages = [
        {"role": "system", "content": "You are a strict Supreme Court judge in a moot court. Return exactly the requested format with no extra text."},
        {"role": "user", "content": prompt},
    ]
    for provider in providers(options):
        try:
            return completion(provider, messages)
        except JudgeUnavailable:
            continue
    raise JudgeUnavailable("The judge is unavailable. Check its connection and retry. Your submission has not been scored.")
def evaluate_argument(role, argument, history, selected_case=None, options=None):
    """
    Evaluates a legal argument in a moot court setting.
    """
    
    # Build context from history
    context_str = ""
    if history:
        context_str = "\n".join([
            f"{turn.get('role', 'Unknown')}: {turn.get('argument', '')}"
            for turn in history[-6:]
        ])

    retrieved_evidence = retrieve_case_evidence(selected_case, argument, history)
    rubric_breakdown = build_reasoning_breakdown(argument, retrieved_evidence)
    evidence_str = "\n".join([
        f"- [{item['match_count']} matches] {item['label']} ({item['chunk_type']}): {item['text']}"
        for item in retrieved_evidence
    ]) if retrieved_evidence else "No case evidence matched strongly enough."

    rubric_str = "\n".join([
        f"- LOGIC: {SCORING_RUBRIC['logic']['definition']} (criteria: {', '.join(SCORING_RUBRIC['logic']['criteria'])})",
        f"- CLARITY: {SCORING_RUBRIC['clarity']['definition']} (criteria: {', '.join(SCORING_RUBRIC['clarity']['criteria'])})",
        f"- CONFIDENCE: {SCORING_RUBRIC['confidence']['definition']} (criteria: {', '.join(SCORING_RUBRIC['confidence']['criteria'])})",
    ])

    case_context = "No case selected."
    if selected_case:
        case_context = f"CASE: {selected_case.get('title', 'Selected Case')}\nSUBTITLE: {selected_case.get('subtitle', '')}\nFACTS: {selected_case.get('facts', '')}\nISSUES: {', '.join(selected_case.get('issues', []) or [])}\nPRECEDENTS: {', '.join(selected_case.get('precedents', []) or [])}"
    
    prompt = f"""You are a Supreme Court judge presiding over a moot court session. Your role is to evaluate arguments critically, ask probing questions, and maintain courtroom decorum.

CURRENT SPEAKER: {role}
CURRENT ARGUMENT: {argument}

SELECTED CASE:
{case_context}

PREVIOUS ARGUMENTS:
{context_str if context_str else "This is the opening statement."}

RETRIEVED CASE EVIDENCE:
{evidence_str}

RUBRIC YOU MUST APPLY:
{rubric_str}

YOUR TASK:
1. Evaluate this argument on:
   - Legal logic and precedent citation (0-10)
   - Clarity and structure (0-10)  
   - Confidence and delivery (0-10)

2. Provide brief, sharp feedback (2-3 sentences max). Be a real judge:
   - If the argument is weak, vague, or irrelevant, INTERRUPT and demand clarification
   - If it's substantive, acknowledge it and probe deeper with a pointed question
   - If it's off-topic or nonsensical, call it out directly

3. Decide if you need to interrupt (if argument is unclear, off-topic, or needs immediate clarification)

RESPOND IN EXACTLY THIS FORMAT (no extra text):
FEEDBACK: [your 2-3 sentence response as a judge]
LOGIC: [score 0-10]
CLARITY: [score 0-10]
CONFIDENCE: [score 0-10]
INTERRUPT: [YES or NO]
"""
    
    try:
        text = call_openrouter(prompt, options)

        # Parse response with regex
        feedback_match = re.search(r'FEEDBACK:\s*(.+?)(?=\n[A-Z]+:|$)', text, re.DOTALL)
        logic_match = re.search(r'LOGIC:\s*(\d+)', text)
        clarity_match = re.search(r'CLARITY:\s*(\d+)', text)
        confidence_match = re.search(r'CONFIDENCE:\s*(\d+)', text)
        interrupt_match = re.search(r'INTERRUPT:\s*(YES|NO)', text, re.IGNORECASE)
        
        feedback = feedback_match.group(1).strip() if feedback_match else "The court acknowledges your submission."
        logic_score = int(logic_match.group(1)) if logic_match else 5
        clarity_score = int(clarity_match.group(1)) if clarity_match else 5
        confidence_score = int(confidence_match.group(1)) if confidence_match else 5
        logic_score = clamp_score(logic_score)
        clarity_score = clamp_score(clarity_score)
        confidence_score = clamp_score(confidence_score)
        interrupt = interrupt_match.group(1).upper() == "YES" if interrupt_match else False

        return build_judge_response(
            feedback=feedback,
            logic_score=logic_score,
            clarity_score=clarity_score,
            confidence_score=confidence_score,
            interrupt=interrupt,
            evidence=retrieved_evidence,
            reasoning_breakdown=rubric_breakdown,
        )
        
    except Exception as exc:
        raise JudgeUnavailable("The judge is unavailable. Check its connection and retry. Your submission has not been scored.") from exc
