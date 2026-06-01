<h1 align="center">Themis</h1>

Themis is a browser-based moot court simulator where two players argue opposite sides of real Indian Court cases based on constitutional and fundamental rights issues. Players present arguments, rebut opposing claims, and respond to judicial questioning. Every action you take can and will affect your scoreboard matrix in realtime, based on : Legal Accuracy, Case Relevance, Logical Reasoning, and Rebuttal Quality.

## Is this for me?

If you're a law student or just someone who is curious to experience courtroom drama, then yess!

## How to Setup?

> Coming soon

## How to use?

1. Pick a case from the carousel and read its informational report
2. Choose your side - petitioner or respondent
3. Argue your case, rebut the opponent, watch your scores update live
4. Verdict delivered. The better arguer wins. (Does not bias towards the verdict of the original case)

## Instructions

> Coming soon

## Tech Stack

- **Frontend** - React + Vite
- **Backend** - FastAPI + WebSocket
- **AI Judge** - Supervised Fine-tuned Llama 3.2 (Unsloth + QLoRA)
- **Case Data** - Indian Kanoon (50+ constitutional and fundamental rights cases)

## Model Performance 

Fine-tuned **Llama 3.2-3B** on 504 moot court argument-scoring examples 
using Unsloth + LoRA (r=16) on Kaggle T4x2.

| Metric | Value |
|--------|-------|
| Final Training Loss | 0.85 |
| Final Eval Loss | 0.89 |
| Train/Eval Gap | 0.04 (no overfitting) |

### Scoring Criteria MAE

| Criterion | MAE |
|-----------|-----|
| Legal Application | X.XX |
| Issue Relevance | X.XX |
| Argument Flow | X.XX |
| Bench Handling | X.XX |

## Graphics Inspired By

Ace Attorney

## Credits

> Coming soon
