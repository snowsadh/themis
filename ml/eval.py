import json
import torch
import numpy as np
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
from huggingface_hub import login
import os

# ============================================================
# CONFIG
# ============================================================
HF_TOKEN = os.getenv("HF_TOKEN")
DATASET_REPO = "YOUR_HF_USERNAME/themis-judge-sft"
LORA_REPO = "YOUR_HF_USERNAME/themis-judge-lora"
BASE_MODEL = "unsloth/Llama-3.2-3B-Instruct"
SEED = 69
MAX_NEW_TOKENS = 200
OUTPUT_FILE = "eval_results.json"
# ============================================================

login(token=HF_TOKEN)

PROMPT_TEMPLATE = """### Case Summary:
{case_summary}

### Legal Issue:
{legal_issue}

### Relevant Laws:
{relevant_laws}

### Side:
{side}

### Context:
{context}

### Argument:
{current_argument}

### Judge Response:
"""


def format_prompt(example):
    inp = example["input"]

    if "judge_last_response" in inp and inp["judge_last_response"]:
        context = f"Judge asked: {inp['judge_last_response']}"
    elif "opposing_last_argument" in inp and inp["opposing_last_argument"]:
        context = f"Opposing counsel argued: {inp['opposing_last_argument']}"
    else:
        context = "Opening submission."

    return PROMPT_TEMPLATE.format(
        case_summary=inp["case_summary"],
        legal_issue=inp["legal_issue"],
        relevant_laws=inp["relevant_laws"] if isinstance(inp["relevant_laws"], str) else ", ".join(inp["relevant_laws"]),
        side=inp["side"].upper(),
        context=context,
        current_argument=inp["current_argument"]
    )


def parse_model_output(raw):
    raw = raw.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        return None
    try:
        return json.loads(raw[start:end])
    except json.JSONDecodeError:
        return None


def compute_mae(gold_scores, pred_scores, criteria):
    maes = {}
    for c in criteria:
        gold_vals, pred_vals = [], []
        for g, p in zip(gold_scores, pred_scores):
            gv = g.get(c)
            pv = p.get(c) if p else None
            if gv is not None and pv is not None:
                try:
                    gold_vals.append(float(gv))
                    pred_vals.append(float(pv))
                except (TypeError, ValueError):
                    continue
        if gold_vals:
            maes[c] = round(float(np.mean(np.abs(np.array(gold_vals) - np.array(pred_vals)))), 4)
        else:
            maes[c] = None
    return maes


def run_inference(model, tokenizer, eval_set, criteria, label):
    print(f"\n── Running inference: {label} ──")
    gold_scores, pred_scores, results = [], [], []
    parse_failures = 0

    for i, example in enumerate(eval_set):
        print(f"  [{i+1}/{len(eval_set)}] {example.get('argument_type', '?')}")

        prompt = format_prompt(example)
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                temperature=0.1,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id
            )

        generated = tokenizer.decode(
            output_ids[0][inputs["input_ids"].shape[1]:],
            skip_special_tokens=True
        )

        parsed = parse_model_output(generated)
        gold = example["output"]["delta_scores"]

        if parsed and "delta_scores" in parsed:
            pred = parsed["delta_scores"]
        else:
            pred = {c: None for c in criteria}
            parse_failures += 1
            print(f"    [PARSE FAILED] {generated[:150]}")

        gold_scores.append(gold)
        pred_scores.append(pred)
        results.append({
            "case_id": example.get("case_id"),
            "argument_type": example.get("argument_type"),
            "turn": example.get("turn"),
            "gold_scores": gold,
            "pred_scores": pred,
            "pred_raw": generated
        })

    maes = compute_mae(gold_scores, pred_scores, criteria)
    valid_maes = [v for v in maes.values() if v is not None]
    avg_mae = round(float(np.mean(valid_maes)), 4) if valid_maes else None

    print(f"\n  Parse failures: {parse_failures}/{len(eval_set)}")
    print(f"  Per-criterion MAE:")
    for c, mae in maes.items():
        print(f"    {c}: {mae}")
    print(f"  Average MAE: {avg_mae}")

    return {
        "label": label,
        "parse_failures": parse_failures,
        "per_criterion_mae": maes,
        "average_mae": avg_mae,
        "examples": results
    }


def print_comparison(base_result, finetuned_result, criteria):
    print("\n" + "="*60)
    print("COMPARISON: Base Llama vs Fine-tuned Themis Judge")
    print("="*60)
    print(f"{'Criterion':<25} {'Base MAE':>10} {'Fine-tuned MAE':>15} {'Improvement':>12}")
    print("-"*60)
    for c in criteria:
        base_mae = base_result["per_criterion_mae"].get(c)
        ft_mae = finetuned_result["per_criterion_mae"].get(c)
        if base_mae is not None and ft_mae is not None:
            improvement = round(base_mae - ft_mae, 4)
            print(f"{c:<25} {base_mae:>10} {ft_mae:>15} {improvement:>+12}")
        else:
            print(f"{c:<25} {'N/A':>10} {'N/A':>15} {'N/A':>12}")
    print("-"*60)
    base_avg = base_result["average_mae"]
    ft_avg = finetuned_result["average_mae"]
    if base_avg and ft_avg:
        print(f"{'AVERAGE':<25} {base_avg:>10} {ft_avg:>15} {round(base_avg - ft_avg, 4):>+12}")
    print("="*60)
    print("\nPositive improvement = fine-tuned model is closer to gold standard.")


def main():
    criteria = ["legal_application", "issue_relevance", "argument_flow", "bench_handling"]

    # Load dataset — same split as training
    print("Loading dataset...")
    raw = load_dataset(DATASET_REPO, split="train")
    split = raw.train_test_split(test_size=0.1, seed=SEED)
    eval_set = split["test"]
    print(f"Eval examples: {len(eval_set)}")

    # Load tokenizer
    print("\nLoading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, token=HF_TOKEN)

    # ── EVAL 1: Base model ──
    print("\nLoading base model...")
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="auto",
        token=HF_TOKEN
    )
    base_model.eval()

    base_result = run_inference(base_model, tokenizer, eval_set, criteria, label="Base Llama 3.2-3B")

    # Free base model memory
    del base_model
    torch.cuda.empty_cache()

    # ── EVAL 2: Fine-tuned model ──
    print("\nLoading fine-tuned model...")
    base_for_lora = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="auto",
        token=HF_TOKEN
    )
    finetuned_model = PeftModel.from_pretrained(base_for_lora, LORA_REPO, token=HF_TOKEN)
    finetuned_model.eval()

    finetuned_result = run_inference(finetuned_model, tokenizer, eval_set, criteria, label="Fine-tuned Themis Judge")

    # ── Print comparison ──
    print_comparison(base_result, finetuned_result, criteria)

    # ── Save full results ──
    summary = {
        "eval_examples": len(eval_set),
        "seed": SEED,
        "base_model": base_result,
        "finetuned_model": finetuned_result,
        "improvement": {
            c: round((base_result["per_criterion_mae"][c] or 0) - (finetuned_result["per_criterion_mae"][c] or 0), 4)
            for c in criteria
        },
        "average_mae_improvement": round(
            (base_result["average_mae"] or 0) - (finetuned_result["average_mae"] or 0), 4
        )
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\nFull results saved to {OUTPUT_FILE}")

    import random

    # Pick 10 random examples from eval set
    showcase_indices = random.sample(range(len(eval_set)), 10)
    showcase = []

    for idx in showcase_indices:
        example = eval_set[idx]
        base_ex = base_result["examples"][idx]
        ft_ex = finetuned_result["examples"][idx]

        showcase.append({
            "case_id": example.get("case_id"),
            "argument_type": example.get("argument_type"),
            "prompt": {
                "side": example["input"]["side"],
                "argument": example["input"]["current_argument"],
                "context": base_ex.get("pred_raw", "")  # reuse formatted prompt
            },
            "gold_output": example["output"],
            "base_output": base_ex["pred_raw"],
            "finetuned_output": ft_ex["pred_raw"]
        })

    with open("showcase.json", "w", encoding="utf-8") as f:
        json.dump(showcase, f, ensure_ascii=False, indent=2)

    print("\n10 showcase examples saved to showcase.json")
    print("Use these for HF model card, portfolio, and presentation.")

if __name__ == "__main__":
    main()
