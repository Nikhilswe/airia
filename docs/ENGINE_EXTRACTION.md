# AIrIA as an engine — extraction sketch

**Status:** proposal, no code changed
**Question:** what would it mean for AIrIA to be embedded by other apps, the way
Hermes is embedded by React Native apps — and is it worth doing?

This document describes where the codebase actually is today, what AIrIA solves
that nothing below it solves, what an engine would unlock, and what it would
cost. It ends with a first step small enough to be reversible.

The product vision is fixed and this proposal is measured against it:
**AI that is free for everyone and works offline.** Anything that would put the
capability behind a paywall, or make it depend on a network round-trip, is out of
scope regardless of its commercial appeal.

---

## 1. Where we are

### The stack, accurately

```
React components  (JS, on Hermes)
        │  JSI
rnllama (C++)
        │
llama.cpp  →  GGUF weights  →  tokens
```

Hermes runs the app's JavaScript. It has nothing to do with inference — no
tensor, token or model file ever passes through it. The inference engine is
**llama.cpp**, reached via `llama.rn`. We did not write it and should not claim
to.

### Package layout

| Package | Size | Platform-bound? |
|---|---|---|
| `@airia/types` | 369 lines | No |
| `@airia/service` | 2,244 lines, 21 modules | **No** — see below |
| `@airia/db` | 251 lines | No |
| `@airia/ui` | 1,027 lines | React Native / React |
| `@airia/fe` | 1,579 lines | Web |
| `@airia/rn` | 3,598 lines | React Native + native modules |

The important finding: **`@airia/service` is already portable.** A scan for
`react-native`, `expo-*`, `window.` and `document.` across `service`, `db` and
`types` returns only comments — no actual imports. The single real dependency is
`TierRouter`'s use of `localStorage`, and that already degrades to an in-memory
store when absent.

That is the expensive part of an extraction, and it is done.

### What is genuinely platform-bound

Three files, all in `@airia/rn`:

- `bridge/NativeAppBridgeImpl.ts` — llama.rn calls, model download, multimodal init
- `bridge/models.ts` — the model registry: URLs, sizes, context windows, capabilities
- `services/attachmentText.ts` — filesystem reads, native PDF module

`models.ts` sitting in the React Native package is a layering mistake. The
registry is a *policy* concern — which models exist, what they are for, what they
cost — and nothing about it is React Native specific. It lives there only because
that is where it was first needed.

### What we have that the layer below does not

llama.cpp, MLC, MediaPipe and Core ML all stop at the same place: *load this
model, produce tokens*. Everything below is ours, and every team building
on-device AI rebuilds it, usually badly:

| Capability | What it does |
|---|---|
| **Capability router** | Rules pass, then bag-of-words semantic fallback at 0.62; picks vision / code / reason per turn |
| **Model lifecycle** | Registry, download with resume, completeness validation, hot-swap, vision projector management |
| **Context budgeting** | Prompt budget derived from the model's real window, reserve matched to the generation cap |
| **Memory** | Extraction and retrieval across conversations, injected as system context |
| **Skill contracts** | Risk tiers with tighten-only inheritance; regulated domains refuse rather than guess |
| **Degradation policy** | Substitute a model when one is unavailable — and say so, in the UI |

That last row is the one worth defending. During development, a text-only model
handed an image confidently described "a blue vintage typewriter" from a photo
library that contained no typewriter. The model cannot know it is blind. The
engine can, and telling the user is the difference between a degraded answer and
a fabricated one. Nothing in the inference layer does this.

### Current gaps, stated plainly

- `@airia/rn` has **no test runner**. 106 unit tests cover `service`; the mobile
  logic has none. Two recent bugs — a context budget exceeding the model window,
  and a completeness check accepting partial downloads — were pure functions and
  trivially testable.
- `NativeAppBridgeInterface` exists as a seam but leaks llama.rn concepts
  (`initMultimodal`, `media_paths`, GGUF paths). It abstracts *a* backend, not
  *any* backend.
- Product opinions are baked into shared code: the AIrIA persona system prompt,
  trust levels, theme tokens.

---

## 2. What an engine would unlock

The framing that holds up is **not** "Hermes for AI" — Hermes is a JavaScript
engine and the analogy misleads. It is:

> The orchestration layer for on-device AI that Apple and Google will not build.

They will ship models and inference for free, well integrated with the OS. They
will not ship cross-platform routing, model lifecycle, portable memory, or a
degradation policy that admits uncertainty. That is the gap.

### Why this serves the vision rather than diverting from it

"AI free for all, offline" is currently bounded by how many people install our
app. As an embedded engine, every host app that adopts it carries offline AI to
its own users — including users who would never install a standalone assistant.
The reach multiplies without the capability ever going behind a network or a
paywall.

The constraint this places on us: **the engine must be free and open.** The
moment it is licensed per-seat, "free for all" becomes marketing. Revenue, if
any, has to come from something adjacent — hosted sync for those who opt in,
enterprise support, managed model distribution — never from the capability
itself.

### Use cases

**1. Journaling and note-taking apps**
Want summarisation, tagging and search over deeply personal text. Sending that to
a server is a dealbreaker for their positioning. They need model download with
resumable progress, memory across entries, and graceful behaviour on a 3 GB
device. Today they either build all of it or ship a cloud call that contradicts
their privacy promise.

**2. Field service and logistics**
Technicians in basements, rural sites, offshore. Connectivity is absent by
default, not by preference. They need the code model for equipment diagnostics
and vision for reading nameplates and damage — with routing between them, since
the technician will not choose a model. Degradation disclosure matters: a wrong
confident answer about a gas valve is worse than "I could not read that".

**3. Healthcare intake and clinical notes**
Data cannot leave the device for regulatory reasons. Our risk-tiered skill
contracts and the regulated-domain guard exist precisely here — refusing to
answer a medical question without a grounded skill, rather than falling back to
a general model. That behaviour is hard to get right and is exactly what a
regulated buyer audits.

**4. Education in low-connectivity regions**
The clearest expression of the vision. A tutoring app on a cheap Android device
with intermittent data. Needs the smallest viable model, honest capability
limits, and no per-query cost. An engine that is free and offline makes this
economically possible for an NGO or ministry of education; a per-seat licence
does not.

**5. Accessibility tools**
Screen description and OCR for blind and low-vision users. Latency and privacy
both argue for on-device. Vision routing plus the image normalisation we already
do (HEIC conversion, bounded resize) is most of what such an app needs.

**6. Humanitarian and disaster response**
Deployments where infrastructure is damaged or absent. Translation, triage,
form-filling. Offline is the requirement, not a feature.

**7. OEM and carrier preinstall**
A device maker wanting an assistant without depending on Google or Apple's
stack. This is the only use case with obvious money in it, and the one most
likely to pull us toward proprietary licensing — worth naming so the tension is
visible rather than accidental.

**8. Enterprise document triage**
Contracts and invoices classified on-device before anything is uploaded. Our
attachment pipeline — native PDF extraction, honest failure reasons for scans —
is directly reusable.

In every case the host owns the user relationship and the interface. We own the
layer that decides which model runs, what is remembered, and what the system
admits it cannot do.

---

## 3. The extraction sketch

### Target layout

```
@airia/core          ← new: headless, portable, zero platform imports
    router/          CapabilityRouter, skill contracts, regulated guard
    context/         ContextManager
    memory/          MemoryService, MemoryExtractor, retrieval
    models/          registry types + policy  (moved out of @airia/rn)
    lifecycle/       download/resume/validate/hot-swap orchestration
    ports/           interfaces the host must satisfy

@airia/backend-llamarn   ← llama.rn implementation of InferenceBackend
@airia/backend-ollama    ← existing OllamaClient, same interface

@airia/rn            ← thin: UI, native modules, wiring
@airia/fe            ← thin: UI, wiring
```

### The ports

Everything platform-specific becomes an interface the host supplies. Four are
enough:

```ts
interface InferenceBackend {
  load(model: ModelRef, opts: LoadOptions): Promise<Session>
  unload(model: ModelRef): Promise<void>
  activeModel(): ModelRef | null
}

interface Session {
  chat(messages: Message[], opts: ChatOptions): Promise<string>  // streams via onChunk
  stop(): Promise<void>
  supportsVision: boolean
}

interface BlobStore {          // model files
  stat(key): Promise<{ exists: boolean; size: number }>
  download(key, url, onProgress): Promise<void>
  remove(key): Promise<void>
}

interface KeyValueStore {      // config, tier state
  get(key): string | null
  set(key, value): void
}
```

`ChatOptions` carries `mediaPaths` and an abort signal. `LoadOptions` carries
context size and an optional projector. Nothing in the interface mentions GGUF,
llama.rn or Expo — that is the test of whether the abstraction holds.

### What has to move or change

| Item | Action |
|---|---|
| `models.ts` registry | Move `@airia/rn` → `@airia/core`; keep URLs as data the host can override |
| `NativeAppBridgeInterface` | Replace with `InferenceBackend` + `Session`; llama.rn specifics move into the backend package |
| Download/resume/validation | Move out of `NativeAppBridgeImpl` into `core/lifecycle`, expressed over `BlobStore` |
| `TierRouter` localStorage | Inject `KeyValueStore` rather than sniffing globals |
| AIrIA persona prompt | Move to `@airia/rn` — a host must supply its own |
| Trust levels, themes | Stay in the app; not engine concerns |
| `attachmentText.ts` | Split: policy (what routes where) to core, filesystem/PDF to the RN package |

### Migration order

Each step leaves the app working and is independently revertible.

1. **Create `@airia/core`, move `service` into it unchanged.** Rename only. Proves
   the build and test wiring.
2. **Introduce `KeyValueStore`,** inject into `TierRouter`. Removes the last
   global sniff.
3. **Move the model registry** into core. Nothing else changes; it is data.
4. **Define `InferenceBackend`/`Session`,** implement `@airia/backend-llamarn`
   over the existing `NativeAppBridgeImpl`. Adapter, not rewrite.
5. **Move lifecycle** (download, resume, validation, hot-swap) into core over
   `BlobStore`. This is the largest step and where the current bugs were.
6. **Make `@airia/rn` consume core as an external dependency.** Forces the
   boundary honestly — anything it still reaches into is a leak.
7. **Second backend as proof.** Ollama already exists and is a different shape;
   making it satisfy the same interface is the real test.

Steps 1–3 are close to mechanical. Step 6 is where truth emerges.

### Before any of this

`@airia/rn` needs a test runner. Moving 3,598 lines of untested logic into a
package other people depend on, without tests, converts our bugs into their
bugs. The invariants worth pinning first, both pure functions:

- prompt budget + response reserve ≤ the model's context window
- a file is complete only when it matches expected size, not merely non-trivial

Both were real failures. Both are three-line tests.

---

## 4. Tensions worth deciding deliberately

**The memory moat inverts.** Our differentiator has been personal memory that
compounds. As an engine, that memory belongs to the host app. We would be
trading a deep relationship with a few users for a shallow one with many. That
may be the right trade for "free for all" — but it is a trade, and it should be
made on purpose.

**Engines are not businesses by default.** Meta gives Hermes away because it
makes React Native better; the value accrues to the platform. If AIrIA becomes
an engine, name where revenue sits before adoption makes it hard to change.

**The OS vendors are coming down this stack.** Apple Foundation Models ship in
the OS; Google has AI Edge. They will be free and better integrated. An engine
play only works clearly *above* inference — routing, memory, policy — which is
where we already are.

**Two products, one team.** A reference app and an embeddable engine have
different release cadences and compatibility obligations. The app can change
weekly; a public API cannot.

---

## 5. Recommendation

Do steps 1–3 and the two invariant tests. That is roughly a day, entirely
reversible, and it improves the app whether or not the engine happens: the
registry belongs in core regardless, and the storage injection removes a global
dependency we would want gone anyway.

Then reassess at step 6, where the abstraction either holds or leaks visibly.
Nothing before that point is a commitment.

What this proposal does **not** do is change the product. The app stays the
product; the engine, if it happens, is how the same capability reaches people who
will never install it. Free, offline, and on the user's own hardware — unchanged.
