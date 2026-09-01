# AIrIA — Architecture Decisions Log

> Format: ADR (Architecture Decision Record)  
> Status options: ACCEPTED | PENDING | SUPERSEDED

---

## ADR-001 — Local-first over cloud
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** All inference, storage, and training runs locally. No cloud dependency in v1.  
**Reason:** Privacy, latency, cost. RTX 4080 is sufficient for Gemma 3 12B inference and QLoRA fine-tuning.  
**Consequences:** Cross-device sync deferred to v2 (WebRTC).

---

## ADR-002 — DPO over PPO for weight updates
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** Use DPO (Direct Preference Optimization) via preference pairs, not PPO with a reward model.  
**Reason:** PPO requires a separate reward model (doubles VRAM needs). DPO works directly on preference pairs — feasible on 16GB VRAM with QLoRA.  
**Consequences:** Need a robust pair quality validator. Pairs must be chosen/rejected format.

---

## ADR-003 — Unsloth for QLoRA training
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** Use Unsloth for fine-tuning, not HuggingFace Trainer directly.  
**Reason:** Unsloth is 2x faster and uses ~40% less VRAM than vanilla HF on the same hardware. Critical for RTX 4080.  
**Consequences:** Unsloth version pinning required — API changes between versions.

---

## ADR-004 — IndexedDB over SQLite for frontend persistence
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** Use IndexedDB (via idb library) for all frontend persistence.  
**Reason:** PWA-native, no server needed, works offline, good browser support.  
**Consequences:** No SQL queries — need to design access patterns upfront.

---

## ADR-005 — Ed25519 for adapter signing
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** All adapters must be signed with Ed25519 before loading.  
**Reason:** Prevent malicious plugin injection. Ed25519 is fast, small keys, widely supported.  
**Consequences:** Need key management UX. Dev adapters can use a local dev key (not prod key).

---

## ADR-006 — Skill gates are literal milestones
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** Skill unlocking is literal — features are gated behind conversation/feedback count thresholds, not architectural metaphors.  
**Reason:** CEO confirmed. Creates a real progression arc and incentivises usage for better training data.  
**Consequences:** SkillRegistry must persist milestone state in IndexedDB. UI must communicate progress.

---

## ADR-008 — Three-tier product model
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** AIrIA ships as three tiers — Local (on-device), Cloud (our GPU infra), Free (no training).  
**Reason:** Hardware is a barrier for most users. Cloud tier removes it. Free tier gets everyone in the door.  
**Key constraint:** Cloud training is isolated per user. No pooling of training data across users, ever.  
**Consequences:**
- TierRouter required in core service layer
- OllamaClient must support both local and remote endpoints
- Cloud training dispatch is async (user doesn't wait for job to complete)
- Pricing strategy needed for cloud tier (pending decision)
- S3-compatible storage needed for per-user model weights on cloud

---

## ADR-009 — Free tier updates are curator-only
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** Free tier users receive curated model updates pushed by our team. Updates are NOT derived from other users' training data.  
**Reason:** CEO confirmed. Crowd-sourced free updates would require consent/anonymisation pipeline and create quality control risk. Curator-only keeps quality high and avoids data governance complexity.  
**Consequences:**
- Free tier update channel is a signed model diff pushed by us, not aggregated from users
- No community flywheel for free tier (intentional for v1)
- Internal `push_update.sh` script needed to sign and publish updates
- Free users must consent before applying an update (UI prompt)
- Update key (Ed25519) is separate from adapter signing key

---

## ADR-007 — Codex writes, CTO reviews
**Date:** 2026-06-20  
**Status:** ACCEPTED  
**Decision:** Codex handles code generation. CTO (Claude) reviews all PRs. CTO writes quality validator, regression checks, and security-critical paths directly.  
**Reason:** Speed + safety. Codex is fast for boilerplate; correctness-critical paths need CTO ownership.  
**Consequences:** All Codex output treated as a PR, not final code. No self-merge.

---

## ADR-010 -- Buddy not brain positioning
**Date:** 2026-06-20
**Status:** ACCEPTED
**Decision:** AIrIA is positioned as a buddy who knows and understands you, not a second brain or productivity tool.
**Reason:** "Second brain" implies the user manages it. "Buddy" implies it shows up for you. The entire UX arc, copy, and interaction model flows from this distinction.
**Consequences:**
- All product copy audited against this -- "here are your notes" is tool language, "you seem to be in an intense stretch" is buddy language
- Interface expressiveness is adaptive and earned through trust, not present from day one
- Onboarding starts with one real question, not tier/plan selection
- Tier selection deferred until after first conversation

---

## ADR-011 -- Ambient companion deferred to post-traction
**Date:** 2026-06-20
**Status:** ACCEPTED
**Decision:** Concept 4 (spotlight-style ambient companion, OS-level shortcuts) is not built for launch.
**Reason:** Correct product instinct but requires traction first. Needs Electron/PWA OS integration. Build the relationship arc right first, then the ambient layer earns its place.
**Consequences:** v1 ships with the journal/dashboard home. Ambient mode planned for v2 once retention metrics justify the OS integration complexity.

---

## ADR-012 -- 6 preset themes, no custom colour picker for v1
**Date:** 2026-06-20
**Status:** ACCEPTED
**Decision:** Ship with 6 named mood presets (Dawn, Midnight, Forest, Ocean, Rose, Slate). No custom colour picker or font selector in v1.
**Reason:** Presets are faster to implement, easier to QA, and create shareable identity ("I use Midnight"). Custom picker is a v2 feature once we see which presets resonate.
**Consequences:** Theme tokens are CSS variables -- swapping presets is a one-line change, easy to extend to custom later.

---

## ADR-013 -- Personal memory layer as primary free-tier adaptation
**Date:** 2026-06-20
**Status:** ACCEPTED
**Decision:** All tiers (including Free) get a personal memory layer stored in IndexedDB. Facts, patterns, preferences, and recurring topics are extracted from conversations and silently injected into every prompt as context.
**Reason:** Context-layer adaptation delivers 80% of what fine-tuning delivers at zero compute cost. Works on any device. Immediate from conversation 1.
**Architecture:**
- MemoryStore in IndexedDB: entities (name, value, confidence, last_seen, source_convo_id)
- MemoryExtractor runs post-response: extracts facts and patterns using lightweight heuristics + model call
- MemoryRetriever: top-K relevant memories injected into system prompt per turn (token-budget aware)
- Memory decays: confidence drops if contradicted, entries expire after 90 days without reinforcement
**Consequences:**
- Adds ~200-500 tokens per prompt depending on memory depth (manageable)
- MemoryExtractor needs its own quality guardrail -- bad extractions pollute the memory store
- CTO owns MemoryRetriever relevance logic -- this is the correctness-critical path

---

## ADR-014 -- Skill adapter marketplace
**Date:** 2026-06-20
**Status:** ACCEPTED
**Decision:** Ship a skill adapter marketplace where we (and later community contributors) publish Ed25519-signed LoRA adapters for specific capabilities (e.g. Python tutor, creative writing coach, Socratic debate partner).
**Reason:** Gives free-tier users genuine capability expansion without personal fine-tuning. Adapters are trained once by us, downloaded by many. Marginal cost per user is essentially zero.
**Architecture:**
- Adapters are LoRA checkpoints compatible with Ollama modelfile ADAPTER directive
- Signed with a dedicated adapter signing keypair (separate from update channel key)
- registry.json in repo lists available adapters: name, version, hash, signature, download URL
- AdapterRegistry.ts verifies signature before loading any adapter
- Community submissions: PR to registry.json, CTO reviews and signs before merge
**Constraints:**
- Adapter size target: under 200MB per adapter
- Max 3 adapters loaded simultaneously (VRAM budget)
- Adapters combine with personal memory layer -- generic skill + personal context = feels personalised
**Consequences:**
- We bear the one-time training cost per adapter (~$5-20 on RunPod)
- Need a separate adapter signing key managed securely
- Community adapter review process needed before v2 opens submissions

---

## ADR-015 -- Mobile inference via on-device model, not Ollama
**Date:** 2026-06-26
**Status:** ACCEPTED
**Decision:** Mobile devices run a lightweight on-device model (Gemma 3 1B) via llama.cpp or MediaPipe's LLM Inference API, not Ollama. Ollama remains desktop/server-only (Local tier hardware, Cloud tier VMs).
**Reason:** Ollama has no iOS/Android runtime and assumes desktop-class RAM/compute. Phones need a model small enough to run in-browser (PWA-first, see ADR-016) or via a native on-device runtime.
**Architecture:**
- `OllamaClient` in `@airia/types` is already an interface (`ping`/`chat`/`listModels`/`loadModel`), implemented today only by `OllamaClient.ts` (HTTP calls to Ollama).
- Add a second implementation, e.g. `OnDeviceClient`, satisfying the same interface, backed by llama.cpp WASM or MediaPipe running Gemma 3 1B in-browser.
- `TierRouter` gains device-capability detection: desktop with Ollama reachable -> `OllamaClient`; mobile or no local Ollama -> `OnDeviceClient`. This is orthogonal to the existing local/cloud/free tier split — a "local" tier user can be running either backend depending on device.
- `ContextManager`, `MemoryService`, and the chat loop are unaffected — they depend only on the `OllamaClient` interface, not the concrete class.
**Consequences:**
- Need a device-capability probe (distinct from the existing Ollama health check) to pick the right client.
- Gemma 3 1B quality is materially lower than 12B — see ADR-017 for how this is surfaced to users.
- WASM model loading/caching strategy needed for PWA (model weights must be cached client-side, not re-downloaded every session).

---

## ADR-016 -- Mobile delivery is PWA-first, native app post-traction
**Date:** 2026-06-26
**Status:** ACCEPTED
**Decision:** Mobile AIrIA ships as a PWA first (same codebase as desktop, `@airia/fe`). A native app (iOS/Android) is a post-traction investment, not v1/v1.5 scope.
**Reason:** One frontend codebase for all platforms keeps the relationship-arc UX and theme system consistent without a parallel native build. Native wrapping (better background/notifications/on-device model APIs) only pays off once usage numbers justify it.
**Consequences:**
- PWA install prompts, offline support, and home-screen behavior need verification on iOS Safari and Android Chrome specifically (PWA support differs by platform).
- On-device model runtime must work in-browser (WASM), which constrains the mobile inference choice in ADR-015 — no native llama.cpp bindings until the native app exists.

---

## ADR-017 -- Model-tier transparency in the UI
**Date:** 2026-06-26
**Status:** ACCEPTED
**Decision:** The UI must clearly show users which model they're currently running on (e.g. "Gemma 3 12B — Local" vs "Gemma 3 1B — Mobile"), so the 1B/12B quality gap is an explicit, expected tradeoff rather than a silent surprise.
**Reason:** CEO confirmed — the 1B vs 12B gap is real and noticeable; hiding it erodes trust in the "buddy" relationship more than disclosing it does.
**Consequences:**
- Settings panel (and possibly the chat header) needs a model/tier indicator — extends the existing `tier-pill` UI in `ChatView.tsx`.
- Copy must stay in "buddy" voice per ADR-010 — avoid technical phrasing like "running on reduced model," prefer something that reads as an honest, low-drama disclosure.

---

## ADR-018 -- Cross-device memory sync is opt-in, default off
**Date:** 2026-06-26
**Status:** ACCEPTED
**Decision:** Personal memory layer sync across a user's own devices (e.g. phone + desktop sharing the same memory) is an explicit, user-facing opt-in toggle, defaulting to OFF. With it off, memory stays local-only per device (the existing behavior). This amends ADR-001's blanket "cross-device sync deferred to v2" — sync becomes an opt-in v1 feature rather than fully deferred, but the default experience is unchanged.
**Reason:** CEO confirmed: give the choice to the user rather than deciding for them; default to local-only if unspecified, since that's the simpler and more private default and requires no new sync infrastructure to ship v1.
**Consequences:**
- The local-only default needs zero new work — already true today via per-device IndexedDB.
- The opt-in sync path still needs the WebRTC (or equivalent) sync mechanism from ADR-001 — that implementation work is now a scoped v1.5/v2 feature behind a toggle, not fully deferred.
- Settings UI needs a "Sync memory across devices" toggle, off by default, with plain-language consequences shown before enabling (CEO/UX to define exact copy).
