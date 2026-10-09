# Themis

An illustrated Indian courtroom simulation. Bring a moot proposition or choose an archive brief, take a side, and argue three rounds against a friend on the same device or computer-controlled counsel.

The essential journey is **find/import a case → review the brief → choose players and sides → argue and review each ruling → three rounds → scorecard and downloadable hearing**. A finished hearing gives both sides an opening, rebuttal and closing, permits up to two bench follow-ups per side per round, and never invents scores when a model request fails. The interface supports keyboard use, mobile layouts, reduced motion, optional dictation and optional spoken feedback.

## Run locally

Prerequisites: Python 3.11+ and Node.js 22.12+ (tested with Python 3.14 and Node 26). Commands below use a POSIX shell, from the repository root.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cp .env.example .env
npm --prefix frontend ci --include=dev
```

Edit `.env` to connect a model (see below). If `.env` already exists, preserve it and copy only the missing settings. The backend loads the root `.env` regardless of the working directory; environment variables take precedence. Restart it after changing server settings.

Start the backend:

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

In another terminal, start the frontend:

```bash
NODE_ENV=development npm --prefix frontend run dev -- --host 127.0.0.1
```

Open [Themis](http://127.0.0.1:5173). Vite proxies `/api` to the backend, so the browser does not contain a hard-coded localhost WebSocket address. The API's [health endpoint](http://127.0.0.1:8000/health) reports configuration, **not a successful model inference**. Use the small settings button in the lobby, or pause the hearing and choose “Connection settings,” to inspect configuration or override the fallback key. The main game keeps these advanced controls out of the way.

## Connect your fine-tuned judge

**Not hosted yet? Start with [the model setup guide](docs/model-setup.md).** It explains how to identify your saved checkpoint, serve a full GGUF locally or a LoRA adapter with vLLM, preserve the training template, and verify the actual model with `python -m scripts.check_model`. Hosting is optional for local play. The exact route depends on your model files and RAM/GPU.

The app expects an **OpenAI-compatible Chat Completions server** serving your trained model or LoRA adapter. Model weights and a hosted endpoint are **not included in this repository**. Set:

```dotenv
THEMIS_BASE_URL=http://127.0.0.1:8080/v1
THEMIS_MODEL=themis
THEMIS_API_KEY=
```

Use the model name advertised by your inference server; an adapter must actually be loaded there. `THEMIS_BASE_URL` ends with `/v1` (or the provider's equivalent API root), not `/chat/completions`. Hosted services may require an API key. The server must support a system message and the model's correct chat template.

For a GPU host, vLLM supports preloading LoRA adapters and addressing them by their served name. Follow the [official LoRA serving instructions](https://docs.vllm.ai/en/stable/features/lora/) for your base model, adapter and hardware. A base Llama model without the trained adapter is not the fine-tuned Themis judge.

The request follows the checked-in training data: `case_summary`, `legal_issue`, `relevant_laws`, `side`, `opposing_last_argument`, `current_argument`, and `judge_last_response` when answering a pending bench question. The model must return:

```json
{
  "delta_scores": {
    "legal_application": 2,
    "issue_relevance": 1,
    "argument_flow": 2,
    "bench_handling": null
  },
  "judge_response": "Counsel, explain why a narrower safeguard would not suffice.",
  "speaker_switch": false,
  "judge_notes": "Relevant submission, but necessity needs closer analysis."
}
```

Scores are integers from −3 to +3. `bench_handling` is null for unprompted submissions. `speaker_switch: false` requests a follow-up; the app caps consecutive follow-ups at two to keep the hearing finite. Missing, out-of-range, non-integer or otherwise malformed model responses trigger the fallback or a retryable error; they never become made-up scores. The exact training chat template is not present and must be checked against the actual deployed checkpoint.

### OpenAI fallback and opposing counsel

To use OpenAI when the judge is absent or fails, set:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o-mini
```

Alternatively, enter a key and model in the advanced connection settings. The override stays only in React memory, is sent to the backend with the request, and is erased on reload or with “Clear override.” It is never written to local storage or a file. “Clear override” returns to any server-configured key; uncheck “Allow OpenAI fallback” to disable fallback entirely. The provider used is shown in the score breakdown and transcript assessment details. Calls use your API balance. The API uses the [Chat Completions contract](https://developers.openai.com/api/reference/typescript/resources/chat/subresources/completions/subresources/messages).

**Keep keys on the server, never in `VITE_` environment variables.** Browser overrides should only be used with a trusted backend over localhost or HTTPS. `.env` is ignored by Git. Neither health responses nor validation errors echo keys.

The fine-tuned judge is a scoring model, so generated opposing arguments use a separate general instruction model:

```dotenv
COUNSEL_BASE_URL=http://127.0.0.1:8080/v1
COUNSEL_MODEL=your-general-instruction-model
COUNSEL_API_KEY=
```

If no counsel model is configured, the enabled OpenAI fallback can generate opposing arguments. Two local players need only a judge. The original `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and optional full `OPENROUTER_BASE_URL` remain supported when the corresponding primary model is absent.

Arguments and brief context go to the configured provider; using a fallback means they may go to OpenAI. No application database or transcript logging is used.

## How hearings work

- Search the archive, inspect a brief’s facts, questions, side positions and authorities, then choose “Take this case.” Or import your own proposition and review the extracted text.
- Choose “Two players” on this device, or “Solo practice.” Solo players may take either side. The petitioner always opens.
- Submit with the button or Ctrl/⌘+Enter. Enter alone inserts a line break. The active side has one writing area; the brief and court record remain available from the sidebar. Arguments are limited to 6,000 characters.
- The judge scores each submission and either asks a question or hands over. Read the response, inspect the opposing submission or scores, then press the continue button. Solo counsel never races through multiple rulings. Every round includes both sides. There is no countdown.
- Failed requests pause the hearing, preserve drafts and scores, and let you retry. A failed assessment of opposing counsel preserves its generated argument for retry. “Withdraw request” cancels waiting in the browser and preserves the turn; an inference already running on a provider may still finish and be billed.
- At the end of round three, read the scorecard, expand assessments in the transcript, download the hearing, or print it. Equal rounded overall scores produce a draw.

Four criteria match the dataset: legal application, issue relevance, argument flow, and bench handling. For each side, the app averages each criterion over its assessed submissions (excluding nulls), then takes the mean of those criterion averages. Overall = `(mean + 3) / 6 * 100`, rounded. Scores therefore compare average quality rather than rewarding extra follow-up turns. They are practice feedback, not calibrated marks or judicial findings. Related brief passages use keyword overlap and are labelled accordingly; they are not verified retrieved authorities.

## Case library and bring your own case

The searchable archive loads **56 case summaries from the existing `utils/data/cases.json` training collection**. Search covers case names, facts, legal issues and authorities; subject filters and pagination keep the list manageable. Each brief links to its original Indian Kanoon judgment and includes both positions where available. These are generated summaries, not independently reviewed moot propositions. They may mention historical outcomes and infer positions. The extraction script originally capped source text at 25,000 characters; consult the linked judgment. Five clearly labelled fictional quick drills remain available when the archive backend is offline.

“Bring your own case” accepts up to four PDF, DOCX or UTF-8 TXT files, or pasted text. Files are sent to this backend for extraction, held in memory and not saved. The review step shows the complete extraction for explicit editing before any model call. Add the title and questions for the bench; authorities are optional. Only the reviewed case goes to the configured inference provider when playing.

Limits and expected edges:

- Each upload: 10 MiB; PDF: 100 pages; extracted text: 120,000 characters. Larger extractions are rejected, not silently truncated.
- Playable facts: 30,000 characters. All case fields together: 60,000 characters. Issues: 1–20; authorities: up to 50; each list entry: 1,000 characters. The UI asks you to narrow oversized material before play.
- Text-based PDFs work; scanned PDFs need OCR beforehand. Encrypted, corrupt and unsupported files receive recoverable errors. Pages with no extracted text are called out.
- DOCX includes body paragraphs, tables, footnotes and endnotes. Images, comments, headers and footers are not imported and are called out for review. Complex formatting is flattened to plain text.
- Multiple documents retain filename separators. Review clarifications and annexures carefully; Themis does not silently summarise or select them for you.

There is no live Indian Kanoon API integration. Empty search results offer an external Kanoon search link; sourced briefs offer judgment links. This keeps the core journey independent of an additional API account.

## Verification

With the Python virtual environment activated:

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
npm --prefix frontend run lint
npm --prefix frontend run build
cd frontend
npx playwright install chromium
npm run test:e2e
```

Playwright starts isolated frontend, backend and deterministic inference servers on ports **5175, 8013 and 8012**. These tests exercise real browser → backend → inference HTTP requests, including local/solo hearings and recovery. They spend no API credit and **do not validate live model quality or credentials**. Keep those ports free. `tests/inference_fixture.py` is test-only and is never imported by application code.

## Deployment and current limits

`npm --prefix frontend run build` produces `frontend/dist`. Serve it over HTTPS and reverse-proxy `/api/*` to FastAPI, stripping `/api`. The Vite proxy is development-only. For a separate API origin, set `VITE_API_BASE` at build time and `ALLOWED_ORIGINS` on the backend. Never put keys in either frontend setting. The legacy `/ws` endpoint remains available and uses the same assessment schema; the UI uses HTTP for independent, cancellable submissions.

This is a local/private practice application. Before offering a public endpoint backed by a shared paid key, add authenticated access, quotas/rate limits and deployment monitoring. There is no online multiplayer, login, saved account history or server-side match authority. Reloading/leaving clears the current hearing; download it first. Dictation and voice depend on browser support and permissions, with typing always available.

Remaining project work:

1. Supply the actual fine-tuned endpoint/checkpoint, verify its chat template, and run a live hearing. No live fine-tuned result is claimed by the fixture tests.
2. Evaluate judge quality and score calibration on held-out data; the earlier README's loss claims were not backed by a checkpoint/evaluation artifact here.
3. Independently review the archive summaries and authorities. Scanned-document OCR, live Kanoon search and persistent saved hearings are not implemented.

The original illustrated courtroom, cast and CSS transitions take visual-novel inspiration from Ace Attorney without using its characters or assets. See [art direction and generation prompts](docs/art-direction.md). Existing training scripts and source data are preserved.
