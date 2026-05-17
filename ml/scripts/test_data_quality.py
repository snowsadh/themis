import json
from collections import defaultdict

with open("../data/dataset.json") as f:
    data = json.load(f)

print(f"Total examples: {len(data)}")
print(f"Unique cases: {len(set(d['doc_id'] for d in data))}")
print(f"Avg turns per case: {len(data)/len(set(d['doc_id'] for d in data)):.1f}")

# 1. Score distribution per criterion
print("\n--- SCORE DISTRIBUTION ---")
criteria = ["legal_application", "issue_relevance", "argument_flow", "bench_handling"]
for c in criteria:
    scores = [d["output"]["delta_scores"][c] for d in data if d["output"]["delta_scores"][c] is not None]
    from collections import Counter
    dist = dict(sorted(Counter(scores).items()))
    print(f"{c}: min={min(scores)} max={max(scores)} avg={sum(scores)/len(scores):.2f}")
    print(f"  distribution: {dist}")

# 2. Profile distribution
print("\n--- PROFILE DISTRIBUTION ---")
profile_counts = defaultdict(int)
for d in data:
    profile_counts[d.get("profile_id", "unknown")] += 1
for k, v in sorted(profile_counts.items()):
    print(f"  {k}: {v}")

# 3. speaker_switch distribution
switches = [d["output"]["speaker_switch"] for d in data]
print(f"\n--- SPEAKER SWITCH ---")
print(f"True: {sum(switches)} ({sum(switches)/len(switches)*100:.1f}%)")
print(f"False: {len(switches)-sum(switches)} ({(len(switches)-sum(switches))/len(switches)*100:.1f}%)")

# 4. Input key variety — judge_last_response vs opposing_last_argument
print("\n--- INPUT CONTEXT TYPE ---")
judge_q = sum(1 for d in data if "judge_last_response" in d["input"])
opposing = sum(1 for d in data if "opposing_last_argument" in d["input"])
print(f"judge_last_response: {judge_q}")
print(f"opposing_last_argument: {opposing}")

# 5. Score independence check — flag examples where all 3 non-null criteria move same direction
print("\n--- SCORE INDEPENDENCE CHECK ---")
all_same = 0
for d in data:
    s = d["output"]["delta_scores"]
    vals = [s["legal_application"], s["issue_relevance"], s["argument_flow"]]
    if all(v > 0 for v in vals) or all(v < 0 for v in vals) or all(v == 0 for v in vals):
        all_same += 1
print(f"Examples where all 3 main criteria same direction: {all_same}/{len(data)} ({all_same/len(data)*100:.1f}%)")
print(f"(ideally below 40%)")

# 6. Sample 3 random examples for manual review
print("\n--- 3 RANDOM EXAMPLES ---")
import random
for ex in random.sample(data, min(3, len(data))):
    print(f"\nProfile: {ex['profile_id']} | Side: {ex['input']['side']} | Turn: {ex['turn']}")
    print(f"Argument: {ex['input']['current_argument'][:200]}...")
    print(f"Scores: {ex['output']['delta_scores']}")
    print(f"Judge: {ex['output']['judge_response']}")
    print(f"Switch: {ex['output']['speaker_switch']}")