# AIrIA — Project Master File
> Last updated: 2026-06-20 (Session 4)
> CTO: Claude (Sonnet 4.6) | Codex: Code generation | CEO: Nikhil

---

## 1. Vision

AIrIA is a **personal AI that learns from you** — available to anyone, regardless of whether they own hardware.  
It learns through real interaction, not just inference. The more you use it, the better it gets for you specifically.

**Three tiers, one product:**

| Tier | Who it's for | Training | Cost |
|---|---|---|---|
| **Local** | Users with capable hardware (RTX 4080+) | On-device via QLoRA, full privacy | Hardware only |
| **Cloud** | Users without hardware | On our infra, isolated per-user | Paid (compute cost) |
| **Free/Web** | Everyone | No personal training — receives curated general updates we push | Free |

**Key principle:** All three tiers run the same AIrIA frontend. The training backend is what differs. A user can start on Free, upgrade to Cloud, and migrate to Local if they get hardware — same conversation history, same skill progression.

**Core properties:**
- Accessible: no hardware required to get started
- Private by default: cloud training is isolated per user, never pooled
- Self-improving: local or cloud users fine-tune on their own interaction data
- Curated free tier: general updates pushed from our own research/testing (not crowd-sourced)
- Skill-gated: capabilities unlock literally as usage milestones are hit
- Extensible: Ed25519-signed adapter registry for plugins
- Cross-device: WebRTC sync (post-v1)

---

## 2. V1 Scope (what we're building now)

**In scope:**
- Core chat loop (streaming, markdown, conversation history)
- Feedback signal capture (thumbs, retry, edit, copy)
- Preference pair builder → DPO format
- **Local tier:** QLoRA fine-tune trigger (Unsloth, RTX 4080) + hot model swap via Ollama
- **Cloud tier:** Training job dispatch API + isolated per-user fine-tune on cloud GPU
- **Free tier:** Update channel — curated model pushes from our research pipeline
- Tier detection + switching logic (same frontend, different training backend)
- Literal skill unlocking (usage milestones gate features, consistent across all tiers)
- Ed25519-signed adapter registry (basic)
- Local beta environment (isolated from prod)

**Free tier adaptation (no GPU needed) — two layers:**
- Layer 1: Personal memory layer -- IndexedDB-stored facts, patterns, preferences injected silently into every prompt. Works on any device, zero cost, immediate.
- Layer 2: Skill adapter marketplace -- we train + sign general-purpose LoRA adapters (e.g. "Python tutor", "creative writing"). Users download (~100MB), Ollama loads on top of base model. Free, no personal data used.

**Mobile (PWA-first, see ADR-015/016/017/018):**
- Mobile inference runs Gemma 3 1B on-device via llama.cpp/MediaPipe (WASM), not Ollama — Ollama stays desktop/Cloud-VM only
- Memory layer works the same on mobile (per-device IndexedDB), with an opt-in (default off) cross-device sync toggle
- UI shows which model/tier a user is currently on, so the 1B/12B quality gap is disclosed, not hidden
- Native app is post-traction; v1/v1.5 ships PWA only

**Out of scope for v1:**
- Cross-device memory sync enabled by default (opt-in toggle exists per ADR-018, but default stays local-only)
- Federated/pooled community training
- WebGPU micro fine-tuning (prototype branch in v2)
- Multi-user accounts on Local tier
- Umbra shadow deployment integration (future)
- Billing/payment integration for Cloud tier (API-key based for now)
- Native mobile app

---

## 3. Tech Stack

**Frontend (all tiers)**

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Vite + React + TypeScript | Fast dev, type safety, PWA support |
| Persistence | IndexedDB | Local-first, no server needed |
| Adapter security | Ed25519 signatures | Cryptographic plugin verification |
| Testing | Vitest (unit) + Playwright (E2E) | Standard, fast |
| CI | GitHub Actions | Lint → type-check → test → build |
| Code gen | Codex (OpenAI) | CTO reviews all PRs |

**Local tier**

| Layer | Choice | Reason |
|---|---|---|
| Inference | Ollama + Gemma 3 12B | RTX 4080 runs it comfortably |
| Fine-tuning | Unsloth + QLoRA | Efficient on 16GB VRAM |
| Training format | DPO preference pairs | Lightweight RLHF-lite |

**Cloud tier**

| Layer | Choice | Reason |
|---|---|---|
| Inference | Ollama on cloud VM (same stack) | Identical to local, easier to reason about |
| GPU | A100 40GB (RunPod / Lambda Labs) | Cost-effective for QLoRA |
| Training dispatch | REST API → job queue | Async — user doesn't wait |
| Isolation | One model namespace per user | Private fine-tunes, never pooled |
| Storage | S3-compatible (user's trained weights) | Portable, deletable |

**Free tier**

| Layer | Choice | Reason |
|---|---|---|
| Inference | Ollama + base Gemma 3 12B | Same model, no personal fine-tune |
| Updates | Signed model diff pushed via update channel | We control quality, users don't train |

**Model:** Gemma 3 12B across all tiers. Dev iteration may use 4B for speed (pending CEO decision).

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AIrIA PWA                            │
│   (same frontend for all tiers — tier detected at runtime)  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Chat UI     │  │ Skill Gate   │  │ Adapter UI   │      │
│  │  (streaming) │  │ (milestones) │  │ (registry)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│  ┌──────▼─────────────────▼──────────────────▼───────────┐  │
│  │                  Core Service Layer                    │  │
│  │  OllamaClient | ContextManager | FeedbackStore        │  │
│  │  SkillRegistry | AdapterRegistry | ModelManager       │  │
│  │  TierRouter (decides: local / cloud / free path)      │  │
│  └──────┬────────────────────────────────────┬───────────┘  │
│         │                                    │              │
│  ┌──────▼──────────┐                ┌────────▼───────────┐  │
│  │   IndexedDB     │                │  Inference Client  │  │
│  │  conversations  │                │  (Ollama adapter)  │  │
│  │  feedback pairs │                └────────┬───────────┘  │
│  │  skill state    │                         │              │
│  └─────────────────┘              ┌──────────┴──────────┐   │
└─────────────────────────────────  │   TierRouter        │   │
                                    └──┬──────────┬────┬──┘   
                                       │          │    │
                         ┌─────────────▼─┐  ┌────▼──┐ ▼──────────────┐
                         │  LOCAL TIER   │  │ FREE  │ │  CLOUD TIER   │
                         │               │  │ TIER  │ │               │
                         │ Ollama local  │  │       │ │ Ollama on GPU │
                         │ Gemma 3 12B   │  │ Base  │ │ VM (RunPod /  │
                         │ RTX 4080      │  │ model │ │ Lambda Labs)  │
                         │               │  │ only  │ │               │
                         └──────┬────────┘  └───┬───┘ └──────┬────────┘
                                │               │             │
                         ┌──────▼────────┐      │    ┌────────▼────────┐
                         │   Training    │  Curated  │  Training Job   │
                         │   Pipeline    │  updates  │  Queue (async)  │
                         │  (on-device)  │  ←we push │  (isolated per  │
                         │  Unsloth/     │           │   user, S3)     │
                         │  QLoRA        │           │  Unsloth/QLoRA  │
                         └───────────────┘           └─────────────────┘
```

**TierRouter logic:**
- Checks `~/.airia/config.json` (local) or `AIRIA_TIER` env var
- Local: Ollama at `localhost:11434`
- Cloud: Ollama at cloud endpoint + auth token
- Free: Ollama at `localhost:11434`, training pipeline disabled, update channel active

---

## 5. Build Phases

### Phase 0 — Scaffold & Contracts (Day 1)
**Goal:** Repo is set up, everyone knows the interfaces before writing business logic.

Tasks:
- [ ] Vite + React + TS init with ESLint, Prettier, Husky pre-commit
- [ ] TypeScript interface definitions: `OllamaClient`, `FeedbackStore`, `SkillRegistry`, `AdapterRegistry`, `TierRouter`
- [ ] Ollama connectivity health check utility
- [ ] GitHub Actions CI pipeline (lint → typecheck → test → build)

Codex role: boilerplate generation (tsconfig, vite config, component shells)  
CTO review: all interface contracts before Codex touches business logic

---

### Phase 1 — Core Chat Loop (Days 2–4)
**Goal:** Working chat with Gemma, streaming, history persisted. Tier-agnostic.

Tasks:
- [ ] Ollama streaming client (SSE-based, abort control) — works for both local + cloud endpoints
- [ ] TierRouter: detect and configure tier at startup
- [ ] IndexedDB persistence layer (conversations, messages)
- [ ] Chat UI (streaming tokens, markdown render, input)
- [ ] Context window manager (token budget, rolling summary truncation)

Guardrails:
- Unit tests: OllamaClient (mock Ollama, both local + cloud endpoint paths)
- Integration test: IndexedDB read/write/delete
- Streaming abort test (cancel mid-stream, no corruption)
- TierRouter unit test (correct tier detection, correct endpoint routing)
- All Codex PRs reviewed by CTO before merge

---

### Phase 2 — Feedback + Weight Updates (Days 5–8)
**Goal:** All three tiers handle training their own way.

Tasks:
- [ ] Implicit signal capture (thumbs, retry, edit, copy events) — all tiers
- [ ] Preference pair builder (chosen/rejected → DPO format JSONL) — all tiers
- [ ] Pair quality validator (CTO-owned — no Codex here) — shared
- [ ] **Local:** QLoRA fine-tune trigger (Unsloth wrapper, batch threshold)
- [ ] **Local:** Hot model swap (Ollama modelfile update, zero downtime)
- [ ] **Local:** Rollback mechanism
- [ ] **Cloud:** Training job dispatch API (POST pairs → job queue → async callback)
- [ ] **Cloud:** Job status polling + user notification on completion
- [ ] **Cloud:** Model pull on job completion (swap to user's fine-tuned weights)
- [ ] **Free:** Update channel client (poll for signed model updates, apply on consent)
- [ ] Regression eval (MMLU delta check post-tune) — local + cloud

Guardrails:
- **Min 50 preference pairs before any training run (all tiers)**
- Pair quality validator runs before every training trigger
- MMLU delta check: reject model if score drops >2%
- Cloud: job dispatch must be idempotent (safe to retry)
- Free: update must be signed by AIrIA update key before applying
- Beta test: 5 conversations on new model before swap
- Automatic rollback if regression detected
- CTO writes quality validator + regression checks (not Codex)

---

### Phase 3 — Skill Unlocking + Beta (Days 9–12)
**Goal:** Features gate on usage, adapters verified, beta/prod isolated, all tiers stable.

Tasks:
- [ ] SkillRegistry with literal milestone gates (tier-aware — cloud/free may have different unlock rates)
- [ ] Ed25519 adapter signature verification
- [ ] Local beta environment (separate IndexedDB namespace, feature flags)
- [ ] Observability layer (latency, error rates, model version log, tier label)
- [ ] Beta → prod promotion checklist
- [ ] Manual smoke test sign-off process

Guardrails:
- Adapter signature verify test (reject unsigned adapters)
- Skill gate E2E test (Playwright, run against all three tiers)
- Beta → prod promotion checklist (must be signed off manually)
- Manual smoke test required before every production model swap

---

## 6. Skill Unlock Milestones (v1)

Milestones track usage, not tier. All tiers progress through the same gates.  
Training-dependent skills are unavailable on Free tier (shown as locked with upgrade prompt).

| Milestone | Skill Unlocked | Free tier |
|---|---|---|
| 10 conversations | Conversation search | ✅ |
| 25 conversations | Custom system prompt | ✅ |
| 50 feedback signals | First fine-tune run | ⛔ (Cloud/Local only) |
| 100 conversations | Adapter registry (load external plugins) | ✅ |
| 3 fine-tune cycles | Advanced context management | ⛔ (Cloud/Local only) |
| 200 conversations | WebRTC sync (v2 preview) | ✅ |

---

## 7. Guardrail Hierarchy (non-negotiable)

```
1. Pre-commit: ESLint + Prettier (blocks bad code at commit)
2. PR: Codex code → CTO review (no self-merge)
3. CI: lint → typecheck → test → build (blocks bad PRs)
4. Training: pair quality check → min 50 pairs → train
5. Post-train: MMLU eval → accept/reject
6. Beta: 5 conversation smoke test on new model
7. Production: manual sign-off required
8. Live: automatic rollback on regression
```

**Rule:** If any guardrail fails, the chain stops. No exceptions.

---

## 8. File Structure (target)

```
airia/
├── docs/
│   ├── PROJECT.md          ← this file
│   ├── DECISIONS.md        ← architecture decisions log
│   └── GUARDRAILS.md       ← full guardrail specs
├── src/
│   ├── types/              ← all TS interfaces (contracts)
│   │   ├── tier.ts         ← TierRouter, TierConfig
│   │   ├── training.ts     ← TrainingJob, PairStore, EvalResult
│   │   └── ...
│   ├── services/
│   │   ├── OllamaClient.ts
│   │   ├── FeedbackStore.ts
│   │   ├── TierRouter.ts   ← detects + routes local/cloud/free
│   │   ├── UpdateChannel.ts ← free tier: polls + applies curated updates
│   │   └── ...
│   ├── components/
│   ├── hooks/
│   ├── db/                 ← IndexedDB layer
│   └── training/
│       ├── PairBuilder.ts
│       ├── qualityValidator.ts   ← CTO-owned
│       ├── localTrainer.ts       ← triggers Unsloth on-device
│       ├── cloudDispatcher.ts    ← sends job to cloud API
│       └── regressionEval.ts     ← CTO-owned
├── scripts/
│   ├── train.py            ← Unsloth QLoRA training script
│   ├── eval.py             ← MMLU regression eval
│   ├── swap_model.sh       ← Ollama model swap + rollback
│   └── push_update.sh      ← (internal) push signed update to free tier channel
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── adapters/
│   └── registry.json       ← signed adapter manifest
├── .github/
│   └── workflows/
│       └── ci.yml
└── README.md
```

---

## 9. Design System

### Visual direction
Warm and personal. Adaptive expressiveness — starts clean and quiet, earns personality as trust builds. Amber (`#BA7517`) is the signature accent throughout.

### The relationship arc (core UX principle)
AIrIA is a buddy, not a tool. The entire interface is designed around a trust arc:

| Trust level | Who AIrIA is to you | Interface personality |
|---|---|---|
| 0 - Stranger | Just met | Quiet orb, one question, no chrome |
| 1 - Acquaintance | Paying attention | Asks about you, not just the task. "AIrIA is paying attention" chip appears once. |
| 2 - Familiar | Remembers you | Opens the session itself. References yesterday. Orb border thickens. |
| 3 - Knows you | Understands you | Proactive insights. "Can I share something I noticed?" Orb pulses. |

### Key design principles locked
- Tier selection happens AFTER first conversation -- onboarding opens with one real question, not a pricing page
- The orb earns expressiveness -- quiet at trust 0, pulsing at trust 3. Never decorative from day one
- AIrIA always opens the return session -- never "Welcome back! How can I help?" which resets the relationship to zero
- Insights ask permission -- "Can I share something I noticed?" before surfacing a personal observation
- Insight reactions are conversation starters, not ratings -- "That's true" / "Not quite right" / "Tell me more" become training data AND deepen the relationship
- "Second brain" language is banned -- all copy must feel like a buddy, not a productivity tool

### Themes (6 presets)
Dawn (amber, default), Midnight (purple dark), Forest (green), Ocean (blue), Rose (pink), Slate (neutral gray)

### Design assets
All mocks at `design/mocks/` -- 800x600px PNG, 144dpi, Figma-ready.

| File | Screen |
|---|---|
| `01_onboarding.png` | Tier selection -- onboarding flow |
| `02_chat.png` | Core chat interface with feedback signals |
| `03_settings.png` | Settings -- model status, training controls |
| `04_arc.png` | Relationship arc -- all 4 trust levels |
| `05_themes.png` | Theme picker -- 6 preset moods |

---

## 10. Open Decisions

| # | Decision | Status | Notes |
|---|---|---|---|
| 1 | Repo location | ⏳ PENDING | Local via Claude Code, or scaffold here first? |
| 2 | Dev model | ⏳ PENDING | Gemma 3 12B vs 4B for faster dev iteration |
| 3 | Cloud GPU provider | ⏳ PENDING | RunPod vs Lambda Labs vs Modal for training jobs |
| 4 | Cloud pricing model | ⏳ PENDING | Per-training-run vs monthly subscription |
| 5 | Umbra integration | 🔜 FUTURE | AIrIA feeds Umbra's shadow loop post-v1 |
| 6 | WebRTC sync | 🔜 FUTURE | v2 scope |

---

## 10. Session Log

### 2026-06-20 — Session 1
- Vision aligned: local-first PWA, core chat loop + weight updates for v1
- Codex assigned: code generation, CTO (Claude) reviews all PRs
- Guardrail hierarchy defined
- Skill unlocking confirmed as literal (milestone-gated features)
- Workspace created at `/home/claude/airia/`
- PROJECT.md, DECISIONS.md, GUARDRAILS.md created

### 2026-06-20 -- Session 3
- Product positioning shifted: AIrIA is a buddy, not a second brain. "Second brain" language banned from all copy.
- Relationship arc defined as the core UX principle: 4 trust levels (Stranger, Acquaintance, Familiar, Knows you)
- Orb expressiveness is earned -- quiet at trust 0, pulsing at trust 3
- Tier selection deferred to AFTER first conversation -- onboarding is a single real question
- Insights surface with "Can I share something I noticed?" -- permission before introspection
- Insight reactions ("That's true" / "Not quite right" / "Tell me more") become training data
- Concept 4 (ambient companion) deferred to post-traction -- right call, right timing
- 6 preset themes locked: Dawn, Midnight, Forest, Ocean, Rose, Slate
- 5 design mocks generated as PNG at design/mocks/ (Figma-ready, 144dpi)
- ADR-010 (buddy not brain positioning) to be logged in DECISIONS.md
- **Product expanded to three-tier model:**
  - Local tier: on-device training, full privacy, hardware required
  - Cloud tier: our infra, isolated per-user fine-tune (not pooled), paid
  - Free tier: curated updates we push from our own research — not crowd-sourced, not user-trained
- TierRouter added to architecture and contracts
- Cloud training job dispatch + async callback pattern decided
- Free tier update channel: signed model diffs, applied on user consent
- Skill milestones updated: training-gated skills locked on Free tier with upgrade prompt
- ADR-008 (three-tier model) and ADR-009 (free tier is curator-only) logged
- **Pending from CEO:** Repo location (Q1), dev model (Q2), cloud GPU provider (Q3), pricing model (Q4)

### 2026-06-20 -- Session 4
- Training brainstorm completed. 5 strategies evaluated.
- LOCKED: Free tier gets two adaptation layers (no GPU required, zero cost):
  - Layer 1: Personal memory layer -- context injection via IndexedDB. Immediate, any device.
  - Layer 2: Skill adapter marketplace -- we train/sign LoRA adapters, users download and apply.
- DEFERRED: Federated training (post-traction), WebGPU micro fine-tuning (v2 prototype branch)
- REJECTED for v1: Community pooled training (privacy perception risk)
- ADR-013 (memory layer as primary free-tier adaptation) logged in DECISIONS.md
- ADR-014 (skill adapter marketplace) logged in DECISIONS.md
- Phase 0 implementation starts today
- Codex assigned to: boilerplate, tsconfig, vite config, component shells, IndexedDB CRUD
- CTO owns: all TS interface contracts, MemoryLayer retrieval logic, qualityValidator, regressionEval

### 2026-06-20 -- Phase 0 Implementation
**Status: COMPLETE**

CTO delivered:
- src/types/core.ts -- all interfaces (OllamaClient, TierRouter, FeedbackStore, SkillRegistry, AdapterRegistry, MemoryLayer, TrainingJob, UpdateChannel)
- src/services/TierRouter.ts -- tier detection logic (localStorage > env > Ollama probe)
- tests/unit/tierRouter.test.ts -- 7 unit tests covering all tier paths

Codex delivered (CTO reviewed):
- package.json, vite.config.ts, tsconfig.json
- .eslintrc.cjs, .prettierrc
- .github/workflows/ci.yml -- lint > typecheck > test > build pipeline
- src/db/schema.ts -- IndexedDB schema (6 stores, all indexes)
- src/db/client.ts -- typed CRUD wrappers + cascade delete
- src/services/OllamaHealth.ts -- ping + model list, no throws
- src/components/index.tsx -- ChatWindow, MessageBubble, InputBar, OrbAvatar shells
- src/styles/themes.css -- 6 theme token sets (Dawn, Midnight, Forest, Ocean, Rose, Slate)

CTO review findings: PASS
- No business logic in component shells
- No types/ folder touched by Codex
- TierRouter throws correctly before detect() called
- DB cascade delete uses single transaction

NEXT: Phase 1 -- Core chat loop (Days 2-4)

### 2026-06-26 -- Phase 1.5 monorepo restructure + mobile inference decisions

Phase 1.5 complete: pnpm workspaces + Turborepo, split into `@airia/types`, `@airia/db`, `@airia/service`, `@airia/fe`. All builds/typecheck/lint/tests pass clean. 40 tests total (29 service unit + 11 db integration, db integration tests new this session).

Verified the local inference path is real, not just code review: installed Ollama, pulled Gemma 3 4B, ran AIrIA's actual `OllamaClient` against it (ping/listModels/chat all confirmed working).

Mobile inference architecture locked:
- ADR-015: mobile uses on-device Gemma 3 1B via llama.cpp/MediaPipe (WASM), not Ollama -- `OllamaClient` interface gets a second implementation (`OnDeviceClient`), `TierRouter` adds device-capability detection orthogonal to the local/cloud/free split
- ADR-016: PWA-first for mobile, native app deferred to post-traction
- ADR-017: UI must show which model/tier a user is on -- 1B vs 12B gap is disclosed, not hidden
- ADR-018: cross-device memory sync is opt-in, default off (amends ADR-001's blanket v2 deferral -- sync becomes a v1 toggle, but default behavior is unchanged and needs no new infra)

NEXT: Build `OnDeviceClient`, device-capability detection in TierRouter, model-tier UI indicator. Then continue into Phase 2 (feedback signals, DPO pairs, local QLoRA training loop -- the actual personalization moat).
