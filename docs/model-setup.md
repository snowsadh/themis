# Connect your trained judge

**Start locally if you can recover a GGUF export.** Themis needs an inference server, but that server can run on your own machine. Rent a GPU only after identifying the saved files and checking local response speed. No checkpoint is included in this repository, so no live fine-tuned result has been verified.

## 1. Recover the training output

Download the complete saved model folder from your training environment, including tokenizer files. Keep the original notebook and its package versions. Store weights outside this Git repository.

| What you have | Next step |
| --- | --- |
| A full fine-tuned `.gguf` file | Use route A. An adapter-only GGUF is insufficient for that command. |
| `adapter_config.json` and `adapter_model.safetensors` | These are a LoRA adapter. Recover its exact base model and tokenizer; export in the original Unsloth environment, or use route B. |
| Full model `.safetensors` shards, `config.json`, tokenizer files | These may be merged weights. Confirm the adapter was merged; export to GGUF or serve the merged directory with vLLM without LoRA flags. |
| Only a notebook, logs or dataset | Locate the saved checkpoint/output first. Training code and loss charts cannot reconstruct learned weights. |

Read `base_model_name_or_path`, `revision`, `r`, and `target_modules` in `adapter_config.json`. Match the base weights and tokenizer used in training. Do not replace a base model with an Instruct variant just because the size matches. A training reference to an Unsloth 4-bit model needs a verified compatible deployment base; removing `bnb-4bit` from a name is not verification.

If the trained `model` and `tokenizer` are still loaded in your Unsloth notebook, preserve the adapter and export a compact merged model:

```python
model.save_pretrained("themis-adapter")
tokenizer.save_pretrained("themis-adapter")
model.save_pretrained_gguf("themis-gguf", tokenizer, quantization_method="q4_k_m")
```

Run this in the training environment with its compatible dependencies. Export can require substantially more memory and disk than serving the final file. Preserve the training chat template, beginning/end tokens and tokenizer: incorrect formatting can turn a good checkpoint into repeated or malformed output. For full-precision merged export, Unsloth provides `model.save_pretrained_merged("themis-merged", tokenizer, save_method="merged_16bit")`. [Unsloth export documentation](https://unsloth.ai/docs/basics/inference-and-deployment/saving-to-gguf)

## 2A. Serve a full GGUF locally

Install a matching `llama-server` binary from the [official llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases). Pick a build for your operating system and available accelerator. With it on your PATH:

```bash
llama-server \
  --model /absolute/path/to/themis-Q4_K_M.gguf \
  --alias themis \
  --host 127.0.0.1 --port 8080 \
  --ctx-size 32768 --parallel 1
```

Use at least a 32K-token context as a starting point for full imported briefs, provided your checkpoint and available memory support it. This is not a validated training limit or a guarantee that every document fits: token counts depend on language and formatting. The app accepts up to 30,000 characters of facts and 60,000 characters across the case fields, then adds submission context and reserves up to 900 output tokens. Measure your longest custom case with the actual tokenizer. A smaller context requires explicitly narrowing and reviewing the brief before the hearing; do not silently truncate the proposition. For a supported GPU build, configure layer offloading to fit available memory.

The server normally reads the chat template from the GGUF. If it is absent or wrong, use the actual training template with `--jinja --chat-template-file /absolute/path/to/training-template.jinja`. Do not guess a replacement. Confirm the model has loaded:

```bash
curl --fail http://127.0.0.1:8080/v1/models
```

The model list should contain `themis`. Keep the server on loopback; it has no password in this local example. [llama.cpp server options and API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)

## 2B. Serve a LoRA adapter on a GPU

Use a compatible vLLM environment on a Linux GPU machine you control. Follow the [official GPU installation guide](https://docs.vllm.ai/en/stable/getting_started/installation/gpu/) for the GPU and driver; do not install this heavy runtime into Themis's application environment. Hardware sizing depends on the confirmed base model, precision, context and concurrency.

Set these values on that machine after inspecting the actual adapter. The tokenizer directory must contain the tokenizer saved during training, including its chat template.

```bash
THEMIS_BASE_MODEL='REPLACE_WITH_VERIFIED_BASE_MODEL_ID_OR_PATH'
THEMIS_ADAPTER='/absolute/path/to/themis-adapter'
THEMIS_TOKENIZER='/absolute/path/to/saved-tokenizer'
THEMIS_LORA_RANK='REPLACE_WITH_ADAPTER_RANK'
read -rsp 'Inference API key: ' THEMIS_SERVING_KEY
export THEMIS_SERVING_KEY

vllm serve "$THEMIS_BASE_MODEL" \
  --tokenizer "$THEMIS_TOKENIZER" \
  --served-model-name counsel-base \
  --enable-lora --lora-modules "themis=$THEMIS_ADAPTER" \
  --max-lora-rank "$THEMIS_LORA_RANK" \
  --max-model-len 32768 \
  --host 127.0.0.1 --port 8080 \
  --api-key "$THEMIS_SERVING_KEY"
```

Use the adapter's rank (or the smallest supported limit covering all its ranks). vLLM exposes the base and adapter separately; `themis` selects the trained adapter. Confirm compatibility for adapters with modified embeddings, vocabulary, or extra saved modules. If your saved tokenizer lacks the training template, recover it and pass vLLM's `--chat-template` file. [vLLM LoRA serving](https://docs.vllm.ai/en/stable/features/lora/), [server arguments](https://docs.vllm.ai/en/stable/cli/serve/)

For a remote machine, keep inference private and forward it over SSH. Replace the host, username, port and key with the actual connection details:

```bash
ssh -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:8080:127.0.0.1:8080 \
  -p 22 -i /absolute/path/to/ssh_key user@gpu-host
```

Keep that terminal open while using Themis. With Runpod, use the direct **SSH over exposed TCP** connection from the Pod's Connect tab; copy its real IP and SSH port into the command. Do not expose inference port 8080 publicly. [Runpod SSH setup](https://docs.runpod.io/pods/configuration/use-ssh)

If the app backend also runs remotely, the tunnel must terminate on that backend host. For a lasting hosted deployment, use a trusted authenticated HTTPS gateway; a vLLM API key alone does not secure every server endpoint. Keep model-hub access tokens and inference keys in the host's secret configuration. [vLLM security](https://docs.vllm.ai/en/stable/usage/security/)

## 3. Point Themis at the server

Add or update these entries in the repository-root `.env`, preserving existing settings:

```dotenv
THEMIS_BASE_URL=http://127.0.0.1:8080/v1
THEMIS_MODEL=themis
THEMIS_API_KEY=
MODEL_TIMEOUT_SECONDS=90
```

For route B, set `THEMIS_API_KEY` to the same private inference key. Restart the FastAPI backend. Never put a key in a `VITE_` setting.

Non-OpenAI model requests default to a 90-second timeout. `MODEL_TIMEOUT_SECONDS` is constrained to 5–120 seconds; OpenAI fallback requests allow 45 seconds, and the browser allows 180 seconds for the combined request. Measure cold and warm local inference before choosing hardware. Raising a timeout does not fix insufficient context or memory. Solo counsel receives the full case and recent conversation within a 12,000-character history budget; older exchanges can be omitted, so the model does not retain an unlimited hearing history.

Two players sharing a device need only the judge. Solo play also needs a general instruction model. If route B's base is an instruction model and the saved template works for it, you can use its separate alias:

```dotenv
COUNSEL_BASE_URL=http://127.0.0.1:8080/v1
COUNSEL_MODEL=counsel-base
COUNSEL_API_KEY=your-inference-key
```

A scorer GGUF in route A is not general counsel. Use a separately served instruction model, or the optional OpenAI fallback. The fallback can also keep practice available when the trained judge is unavailable:

```dotenv
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
```

The discreet court connection controls can override the fallback key for the current browser session. Calls use that provider's balance and send it the selected brief and submissions. Disable fallback when checking the trained model so a successful fallback does not hide a failed deployment.

## 4. Verify the actual checkpoint

With Themis's Python environment active, from the repository root:

```bash
python -m scripts.check_model
```

This sends two small fictional submissions directly to `THEMIS_BASE_URL`, checks the same strict assessment schema as the app, checks bench-question scoring and reports latency. It never selects OpenAI or another fallback and never prints credentials or provider response bodies. A paid primary host may charge for these two inference calls.

Then complete a three-round, two-player hearing with fallback disabled. Check follow-ups, a respondent submission, retry after disconnecting the server, and the downloaded transcript. Repeat with your longest custom brief. Run solo separately if counsel is configured. `/health` reports configuration only; the fixture-based browser tests do not validate your checkpoint.

Before relying on the marks, evaluate held-out submissions for legal accuracy, invented authorities, valid JSON rate, treatment of both sides, bench handling, and warm/cold latency. Compare with the base model and retain the exact checkpoint, tokenizer, template, runtime version and evaluation results. Passing the smoke check proves connection and output shape, not legal quality or calibrated scores.

**Still needed to choose the exact route:** the saved output path or model repository, file format, training notebook/template, and your machine's RAM/GPU/VRAM. No cloud instance or paid service has been provisioned.
