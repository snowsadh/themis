# GPU access and capped hosting for Themis

Checked against official sources on 5 November 2026. Snow has GitHub Education approval, uses free molab/Kaggle/Colab GPUs, and accepts a payment card if spending can be capped. No signup, redemption, application, payment-method change or provisioning was performed. Published offers are not verified account balances, and international card acceptance, geography checks and GPU inventory still require account-level confirmation.

Use an existing free notebook for the first real Themis generation. For repeatable hosting, **Modal is the strongest documented fit for the stated spending constraint**, conditional on account access and setting both its usage and net-spend limits. Camber's student benefit is worth checking for experiments. Keep a local llama.cpp path available if its measured latency is acceptable. See the [implementation checklist](themis-inference-audit-2026-11-05.md).

## What the credit must buy

A **GPU**, or graphics processing unit, runs numerical operations and has its own memory, commonly called VRAM. A GPU allowance lets you run your own code and weights only if the product permits it. A provider's model-catalogue API credit may buy requests to supported models without allowing an arbitrary Themis checkpoint.

A notebook session gives temporary interactive compute. A rented machine gives an operating system and hardware you manage. A custom serverless function runs your inference code while the platform manages worker allocation. A managed endpoint packages more serving operations. These are different products, even when sold by the same company.

The merged Themis weights alone are about 6.43 GB; the runtime also needs temporary buffers and an attention cache holding information about the input. A single 16 GB T4 is a reasonable reference candidate using 16-bit floating-point (FP16) at short context and batch size one, subject to actual loading/memory checks. An L4 has more memory and is a useful serving candidate. Choosing an expensive accelerator or multiple GPUs is unnecessary for the first test. The published weights use brain floating-point 16 (BF16), a different number format; loading should select a precision supported by the actual GPU.

## Existing access and realistic student benefits

| Route | Public offer and conditions | Best Themis use | What still needs checking |
| --- | --- | --- | --- |
| **molab**, already used | Free marimo notebooks; current docs describe attachable RTX Pro 6000 Blackwell GPU, 96 GB VRAM; sessions up to 12 hours, idle shutdown after 90 minutes. Notebooks are public but undiscoverable by default. [Official guide](https://docs.marimo.io/guides/molab/) | First merged-model generation, prompt comparisons, evaluation and optional conversion | Current GPU allocation and persistence. Keep secrets/private submissions out of notebook source/output. Its session lifetime does not establish an always-available courtroom API. |
| **Kaggle**, already used | Free notebook accelerators subject to account availability and quota. [Official notebook documentation](https://www.kaggle.com/docs/notebooks) | Historical base-plus-adapter reconstruction and short reference/evaluation jobs | Read the actual accelerator/quota panel. No fixed weekly balance was verified for Snow here. Download results before the session ends. |
| **Colab**, already used | Free accelerator access is dynamic and not guaranteed. Free managed runtimes restrict service-like use, including certain web-UI workloads outside the notebook interface. [Official FAQ](https://research.google.com/colaboratory/faq.html) | Interactive generation and conversion/evaluation when available | Accelerator assignment and session limits. Do not build the app around a free Colab runtime as a persistent tunneled inference host. |
| **Camber via GitHub Education** | Student plan while enrolled: **5 GPU hours, 40 CPU hours, 50 GB storage per month**. [Student Pack offer](https://education.github.com/pack#camber) | A relevant extra experiment allowance given Snow's approved student status | Redeem the student product and verify custom Python/model execution, GPU type, restrictions and billing terms. Existing GitHub approval does not prove redemption or a current Camber balance. |
| **Own laptop** | No provider compute charge; Ryzen 7 CPU and around 14 GiB physical RAM observed | Compact GGUF, offline demo and repeatable API-client learning | Verify third-party conversion provenance or create an export; measure RAM, warm speed and swap. The newly discovered Q4_K_M file is about 2.02 GB, not a measured process-memory figure. |

Camber's ordinary free plan explicitly has **no GPU usage**. Its separate Pro/Teams 14-day trial says the card is billed at trial end. Do not accidentally redeem that instead of the student benefit. [Camber pricing](https://www.cambercloud.com/pricing)

## Trials and custom-model hosting credits

| Provider | Verified public offer | Payment, expiry and cap evidence | Assessment for Snow |
| --- | --- | --- | --- |
| **Modal** | Starter: **$30/month eligible compute**. GPU access requires a valid payment method. [Pricing](https://modal.com/pricing), [GPU requirement](https://modal.com/docs/guide/gpu) | Documented workspace usage cap and separate net-spend limit, enforced by stopping workloads that would incur more out-of-pocket charges. [Budget behavior](https://modal.com/docs/guide/budgets) | First hosting candidate. Runs custom weights/code and can scale to zero. Verify limits in the actual account before using a card; compute credit does not cover every product or charge. |
| **Lightning AI** | **5 signup credits + 25 after adding a card**; pricing FAQ says unused credits expire in 12 months. One credit equals US$1 in its billing guide. [Pricing](https://lightning.ai/pricing), [billing](https://lightning.ai/docs/platform/overview/faq/billing/) | Billing guide says it warns and attempts to gracefully stop workloads as credit runs low. Promotional eligibility can change. Check credit auto-reload settings before adding a card. This is less explicit than Modal's separate net-spend cap. | Good interactive fallback for reference inference or conversion. Treat advertised “up to” GPU-hour headlines as machine-dependent, not a balance. Free CPU Studio requires a restart every four hours. |
| **Cerebrium** | Official ASGI tutorial advertises **$30** and no card for signup; tutorial is dated October 2024. Current pricing lists Hobby with no fixed platform fee plus compute. [Offer](https://cerebrium.ai/blog/asgi-support-now-available-on-cerebrium), [pricing](https://cerebrium.ai/pricing) | Current grant, expiry, GPU activation requirements and an enforceable spend cap are unverified. “No card for signup” does not prove no card for GPU deployment. | Relevant smaller custom-serving provider, but conditional until the dashboard confirms terms. Its custom web-server support could keep adaptation small. |
| **Hugging Face ZeroGPU** | Free personal accounts in good standing, verified email and age over 30 days can host up to two Spaces. Free users have **5 GPU minutes/day** under current docs, with queueing. [Official ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu) | A daily GPU-time quota, not a dollar credit. Currently Gradio-only; free tier does not establish unattended capacity for all app users through one account. | Useful free demo route if eligible. Requires a Gradio API adapter and quota/authentication investigation; pointing `THEMIS_BASE_URL` at a Space page will not work. |
| **OVHcloud Public Cloud, Asia offer** | **US$200 for one month**, first Public Cloud project only; official examples include GPU notebooks/training. [Offer and FAQ](https://www.ovhcloud.com/asia/public-cloud/free-trial/) | FAQ requires a payment method and says later use is automatically billed. A hard stop satisfying Snow's constraint was not verified. GPU capacity/quota and the precise chosen product must be checked. | Useful full-stack trial, but lower priority than capped/free routes. The larger headline credit does not compensate for unclear overage prevention. |
| **Anyscale** | **$100 initial credits** and hosted monthly card billing. [Official pricing](https://www.anyscale.com/pricing) | Grant expiry, small-GPU access and a hard spending cap were not established by that page. | A valid custom-model/Ray learning option, with more platform machinery than the first 3B service needs. Conditional, not counted as already accessible. |
| **Inferless** | Same pricing page advertises both **10 free hours without a card** and **$30 credit**, and includes private-beta/selective-onboarding language. [Official page](https://www.inferless.com/pricing) | FAQ mentions a project/workspace upper limit without clear enforcement details. Confirm the allowance, expiry and actual stopping policy. | Consider only after onboarding confirms exact credit and GPU access. Do not add the hours and dollars together. |
| **Baseten** | Current pricing URL returned a JavaScript-only page to this audit. [Official pricing](https://www.baseten.co/pricing) | Current grant amount, cap, expiry and card conditions could not be reverified. | Preserve as an alternative from the handoff; assign no guaranteed free balance. Separate custom deployment from catalogue inference promotions. |

These services are candidates for an Indian undergraduate, not a promise that each will accept the same Indian card or grant the same GPU quota. No official source reviewed established those account-specific outcomes. The initial reference job can proceed using Snow's existing notebook access while eligibility checks happen separately.

## Why Modal currently ranks first for capped hosting

Modal documents a **workspace budget** for usage before credits and a separate **spend limit** for net charges after credits. Reaching the latter stops workloads that would add out-of-pocket charges; credit-covered work may continue. The default spend limit is usage limit minus credits, so adding a card without changing it can allow paid usage. [Exact semantics](https://modal.com/docs/guide/budgets)

For the first authorized deployment, aim for an explicit **$0 out-of-pocket spend limit**, if the dashboard permits it, and a usage limit comfortably within confirmed applicable compute credit. Verify both values, the billing cycle and treatment of non-compute resources. Use workspace controls: environment budgets require higher plans and exclude some workspace charges.

Use one worker at most, zero minimum warm workers, bounded input/output and concurrency, no automatic retry storm, and explicit startup/inference/idle limits. Cache the pinned model so repeated cold starts do not repeatedly download gigabytes. A **cold start** includes starting a container and loading the model; a **warm request** reuses an initialized process. Modal bills loading, processing and the configured warm waiting period, so scaling to zero and warm retention must be measured. [Billing details](https://modal.com/pricing)

Illustrative arithmetic using listed rates: one L4 is `$0.000222/second`; two physical CPU cores add `$0.0000262/second`; 16 GiB memory adds `$0.00003552/second`. Together that is about **$1.02 per allocated hour**, assuming those resource amounts determine billing. This excludes other charges and is not measured Themis speed. If startup, generation and warm waiting total 180 seconds, the same resource arithmetic is about **$0.051**. A $30 credit is therefore not a fixed number of requests. [Rate source](https://modal.com/pricing)

Snow has accepted considering a card under a cap, not authorized paid usage. Actual provisioning should follow the known-good model/protocol and confirmed account controls. A first low-cost learning session can remain inside free compute.

## Offers that should not become assumed GPU balances

- **E2E Networks:** the handoff's institutional education URL now redirects to the TIR platform page. That page describes custom model execution and endpoints in India, but the old seven-day education trial was not re-established. Treat it as an inquiry through the college or provider, not a verified individual allocation. [Current destination](https://www.e2enetworks.com/ai-labs-as-a-service-education)
- **Thunder Compute:** its $20 student grant explicitly requires enrollment at a US university. It does not fit the stated Indian enrollment. [Eligibility](https://www.thundercompute.com/students)
- **JarvisLabs:** its FAQ says it currently offers no free credits; a small paid deposit is different from a signup grant. [FAQ](https://docs.jarvislabs.ai/faqs)
- **Google Cloud:** the $300/90-day free-trial balance does not make GPUs available in non-billable trial status. Upgrading changes billing exposure; GPU quota/capacity still need approval. Do not call it instant free GPU access. [Restrictions](https://docs.cloud.google.com/free/docs/free-cloud-features)
- **Beam/Vultr/Runpod/Vast.ai:** no universal signup credit usable for this custom model was verified in this audit. A rental quote, creator award, startup award or catalogue API promotion is a separate offer. Revisit only with exact product, grant and stopping terms.
- **Research/startup programs from the handoff:** reviewed applications are not account balances. GitHub student status alone does not establish startup incorporation, funding or postgraduate/research eligibility. They can be considered for a finite faculty-supported experiment later.

## Decision and preflight checklist

1. **Reference inference now:** existing molab or Kaggle session; use Colab if that is available. Save results and environment immediately. No new billing setup is needed for this phase.
2. **Student benefit next:** inspect Camber's redeemed student plan and actual custom-code/GPU access. Keep this useful even if hosting moves elsewhere.
3. **Local repeatability:** test a pinned/checksummed compact GGUF against the reference when memory permits. Keep original merged weights/adapter provenance distinct from the conversion.
4. **Hosted demo:** Modal after the account's GPU access and usage/net-spend controls are confirmed. Lightning/Cerebrium are alternatives if their actual account terms are better; ZeroGPU is appropriate when a Gradio adapter and daily queue/quota suit the demo.

Before any remote deployment:

- [ ] Confirm the balance exists, its issue/reset date, expiry and eligible products. Do not activate a short-lived grant while still debugging packaging.
- [ ] Confirm custom weights and the exact prompt protocol work on the assigned GPU and runtime version.
- [ ] Record region, GPU type/count, available VRAM, required host memory and cache storage.
- [ ] Check card/deposit requirements and disable credit auto-reload where present. A bank card limit is not a substitute for the provider's billing control.
- [ ] Set and verify a stopping control; distinguish net spending, gross usage, compute-only budget and notification alerts.
- [ ] Set bounded worker count, concurrency, output length, startup/runtime deadlines and idle retention. An open browser is not the billing lifecycle.
- [ ] Keep the endpoint private/authenticated initially; disable judge fallback while gathering Themis evidence.
- [ ] Estimate `startup + inference + billed warm waiting + CPU/RAM + retained storage + transfer + app hosting + applicable taxes/fees`.
- [ ] Record the provider's stop/delete operation and what persists. Confirm idle compute reaches zero and inspect any storage or endpoint charges after the demo.
- [ ] Export raw responses, metrics and configuration before expiry, and retain a usable local or notebook reproduction path.

No request-per-month promise is justified yet. Measure a complete hearing, follow-ups and startup frequency before estimating sustainable free-tier capacity. A six-submission hearing is the minimum flow; allowed follow-ups can increase it to eighteen judge requests, and solo mode adds separate counsel generation.
