import json
from collections import defaultdict

with open("../data/dataset.json") as f:
    data = json.load(f)

print(f"Total examples: {len(data)}")
print(f"Unique cases: {len(set(d['doc_id'] for d in data))}")

# Score distribution per criterion
criteria = ["legal_application", "issue_relevance", "argument_flow", "bench_handling"]
for c in criteria:
    scores = [d["output"]["delta_scores"][c] for d in data if d["output"]["delta_scores"][c] is not None]
    print(f"\n{c}: min={min(scores)} max={max(scores)} avg={sum(scores)/len(scores):.2f} count={len(scores)}")

# Profile distribution
profile_counts = defaultdict(int)
for d in data:
    profile_counts[d.get("profile_id", "unknown")] += 1
for k, v in sorted(profile_counts.items()):
    print(f"  {k}: {v}")

# speaker_switch distribution
switches = [d["output"]["speaker_switch"] for d in data]
print(f"\nspeaker_switch True: {sum(switches)} False: {len(switches)-sum(switches)}")