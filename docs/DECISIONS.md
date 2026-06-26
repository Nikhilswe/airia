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
