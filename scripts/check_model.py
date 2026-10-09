"""Check the configured fine-tuned judge directly, with no fallback or paid OpenAI call.

Run from the repository root: python -m scripts.check_model
"""

import json
import os
import sys
import time

from backend.judge import JUDGE_SYSTEM, JudgeUnavailable, completion, parse_evaluation
from pydantic import ValidationError


def main():
    base_url = os.getenv("THEMIS_BASE_URL", "").strip()
    model = os.getenv("THEMIS_MODEL", "").strip()
    if not base_url or not model:
        print("Set THEMIS_BASE_URL and THEMIS_MODEL in the root .env first.")
        return 2
    provider = ("Fine-tuned judge", base_url.rstrip("/") + "/chat/completions",
                model, os.getenv("THEMIS_API_KEY", ""))
    submission = {
        "case_summary": "Fictional moot: a university prohibits all student meetings for one semester after one disruption. The order gives no individual reasons or appeal.",
        "legal_issue": "Whether the blanket restriction is proportionate and procedurally fair.",
        "relevant_laws": "The moot proposition requires reasons, a hearing, and consideration of less restrictive measures.",
        "side": "petitioner",
        "opposing_last_argument": "The university says the restriction is necessary to protect students.",
        "current_argument": "Safety is a legitimate objective, but the order covers peaceful groups without assessing their conduct. Targeted conditions and an opportunity to respond could address the disruption with less interference. The university has not explained why those measures would fail.",
    }
    for label, pending in (("opening", False), ("bench answer", True)):
        if pending:
            submission["judge_last_response"] = "What narrower measure would protect students?"
            submission["current_argument"] = "Require advance notice, separate groups where a specific conflict is evidenced, and permit a prompt appeal. These safeguards address the identified disruption while allowing peaceful meetings."
        start = time.monotonic()
        try:
            result = parse_evaluation(completion(provider, [
                {"role": "system", "content": JUDGE_SYSTEM},
                {"role": "user", "content": json.dumps(submission)},
            ]))
            bench_score = result["delta_scores"]["bench_handling"]
            if (pending and bench_score is None) or (not pending and bench_score is not None):
                print(f"FAIL {label}: bench_handling must be null only when no question is pending.")
                return 1
        except (JudgeUnavailable, ValidationError, ValueError):
            print(f"FAIL {label}: check the connection, loaded adapter, chat template and JSON output. No fallback was used.")
            return 1
        print(f"PASS {label}: valid assessment in {time.monotonic() - start:.1f}s")
    print("Connection and schema passed. Complete a hearing and evaluate held-out examples before relying on scores.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
