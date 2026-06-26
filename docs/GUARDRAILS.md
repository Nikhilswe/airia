# AIrIA — Guardrail Specifications

> These are non-negotiable. If any guardrail fails, the chain stops.

---

## Level 1 — Pre-commit

**Tool:** Husky + lint-staged  
**Blocks:** Any commit that fails

- ESLint: zero errors (warnings allowed, errors block)
- Prettier: auto-format on staged files
- TypeScript: `tsc --noEmit` on changed files

---

## Level 2 — Pull Request

**Rule:** All Codex-generated code is treated as a PR. No self-merge. CTO reviews.

CTO checks:
- Business logic correctness
- No hardcoded values that should be config
- No direct DOM manipulation bypassing React
- No unhandled promise rejections
- Error boundaries present on critical components
- IndexedDB operations wrapped in try/catch

**CTO writes directly (no Codex):**
- `src/training/qualityValidator.ts`
- `src/training/regressionEval.ts`
- `src/services/AdapterRegistry.ts` (signature verification logic)
- `src/db/migrations.ts`

---

## Level 3 — CI Pipeline

**Runs on:** Every PR, every push to main  
**Blocks:** Merge if any step fails

```
lint → typecheck → unit tests → integration tests → build
```

- `npm run lint` — ESLint
- `npm run typecheck` — tsc --noEmit
- `npm run test:unit` — Vitest
- `npm run test:integration` — Vitest (IndexedDB, OllamaClient mock)
- `npm run build` — Vite production build

---

## Level 4 — Training Pipeline Guardrails

### Shared (all training tiers)

#### 4.1 Pair Collection Gate
- Minimum **50 preference pairs** before any training run is triggered
- Pairs must have both `chosen` and `rejected` fields populated
- `qualityValidator.ts` runs on every pair before it enters the pool

#### 4.2 Pair Quality Checks (qualityValidator.ts — CTO-owned)
Each pair must pass:
- [ ] `chosen` length > 20 tokens
- [ ] `rejected` length > 20 tokens
- [ ] `chosen` !== `rejected` (not identical)
- [ ] Signal source is a known type (thumb_up, thumb_down, retry, edit, copy)
- [ ] Timestamp is within last 30 days (stale pairs rejected)
- [ ] No PII patterns detected (basic regex: email, phone, SSN-like)

---

### Local tier

#### 4.3 Training Trigger
- Triggered manually OR when pair pool hits 50 pairs
- Training runs on a **separate process** (never blocks the UI)
- Training logs written to `~/.airia/training_log.jsonl`

#### 4.4 Post-Training Regression Eval (regressionEval.ts — CTO-owned)
After every fine-tune:
- Run MMLU subset eval (100 questions, 5 subjects)
- Compare against baseline (pre-tune score stored in `~/.airia/model_baseline.json`)
- **Accept model if:** score delta >= -2%
- **Reject model if:** score drops >2% — auto-rollback triggered

#### 4.5 Beta Smoke Test
- New model loaded into **beta namespace** only
- 5 conversations run manually by CEO
- CTO sign-off required before prod swap

#### 4.6 Production Swap
- Manual sign-off required (no auto-promotion to prod)
- Ollama modelfile updated atomically
- Previous model weights kept for 7 days (rollback window)

#### 4.7 Rollback
- Triggered automatically if regression eval fails
- Triggered manually via `scripts/swap_model.sh --rollback`
- Rollback restores previous Ollama modelfile
- Rollback event logged to `~/.airia/model_log.jsonl`

---

### Cloud tier

#### 4.8 Job Dispatch
- Job dispatch must be **idempotent** — safe to retry on network failure
- Job ID returned on dispatch; client polls for status
- Pairs are transmitted over TLS; deleted from transit storage after job starts

#### 4.9 Isolation
- Each user's training job runs in an isolated environment
- No cross-user data access at any point in the pipeline
- Trained weights stored in per-user S3 path, inaccessible to other users

#### 4.10 Cloud Regression Eval
- Same MMLU eval as local, runs server-side post-tune
- Result returned with job completion callback
- Auto-rollback to previous weights if regression detected
- User notified of rollback with reason

---

### Free tier

#### 4.11 Update Channel
- Updates are signed by AIrIA update keypair (Ed25519, separate from adapter key)
- Client verifies signature before applying any update
- User must explicitly consent (UI prompt) before update is applied
- Update is atomic — partial updates are rejected
- Rollback available for 7 days (previous base model kept locally)

---

## Level 5 — Adapter Security

- All adapters must be signed with Ed25519 private key
- `AdapterRegistry.ts` verifies signature before loading any adapter
- Dev adapters use a local dev keypair (never the prod key)
- Unsigned adapters are silently rejected + logged
- Adapter manifest (`adapters/registry.json`) is version-controlled

---

## Level 6 — Beta / Prod Isolation

- Beta: IndexedDB database name `airia-beta`
- Prod: IndexedDB database name `airia-prod`
- Feature flags stored per-namespace
- No data migration from beta to prod (intentional — beta is disposable)
- Model namespace: beta uses `gemma3-12b-airia-beta`, prod uses `gemma3-12b-airia`

---

## Escalation

If any guardrail is ambiguous or a new case isn't covered:
1. Stop
2. Log the case in `docs/DECISIONS.md` as a PENDING ADR
3. Discuss with CEO before proceeding
4. Never guess on security or training pipeline decisions
