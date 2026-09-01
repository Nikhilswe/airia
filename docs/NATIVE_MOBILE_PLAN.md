# AIrIA Native Mobile Plan

**Status:** Draft  
**Target:** React Native applications for iOS and Android with reliable native
on-device inference and cloud/Ollama fallback.

## Recommendation

Use React Native for one mobile product, with:

- A native mobile UI that is separate from the existing DOM/CSS web UI.
- Shared design tokens, copy, domain types, business rules, and view models.
- A platform-neutral inference contract consumed by the application core.
- Separate Swift/iOS and Kotlin/Android implementations behind one React Native
  native-module package.
- Backend selection between native inference, cloud inference, and a custom
  Ollama endpoint.

Do not create separate public TypeScript APIs for iOS and Android unless their
capabilities genuinely diverge. One API with separate native implementations
prevents platform conditionals from spreading through the application.

React Native's New Architecture is the correct baseline. Current React Native
guidance directs new native integrations toward Turbo Native Modules/Fabric,
and the candidate `llama.rn` binding requires the New Architecture from v0.10.

Use Expo development builds and prebuild/config plugins, not Expo Go. Expo Go
cannot include arbitrary native inference libraries. This retains Expo's build,
update, filesystem, SQLite, and app configuration tooling without preventing
Swift, Kotlin, C++, Metal, or Android NDK work.

## Proposed repository layout

```text
apps/
  airia-mobile/                React Native/Expo application

packages/
  airia-fe/                    Existing web application; move to apps/web later
  airia-types/                 Shared serializable domain and API types
  airia-core/                  Platform-neutral application/domain services
  airia-inference-http/        Cloud and custom Ollama HTTP adapter
  airia-inference-native/      TypeScript adapter over the native runtime
  airia-native-runtime/        One RN module package
    src/                       TypeScript module contract
    ios/                       Swift/Objective-C++ implementation
    android/                   Kotlin/JNI implementation
    cpp/                       Optional shared llama.cpp integration
  airia-storage-web/           Existing IndexedDB implementation
  airia-storage-native/        SQLite, secure storage, and model-file storage
  airia-design-tokens/         Colors, spacing, typography, motion, icons
  airia-test-contracts/        Reusable adapter conformance tests
```

The existing `packages/airia-db` can remain while the contracts are extracted,
then become `airia-storage-web`. The existing `packages/airia-service` should be
split incrementally rather than rewritten at once.

Update `pnpm-workspace.yaml` to include both `apps/*` and `packages/*`. Keep one
resolved version of React, React Native, Expo modules, and native dependencies;
duplicated native module versions in a monorepo can break autolinking/builds.

## Dependency direction

```text
Native UI / Web UI
       |
       v
   airia-core  ---> airia-types
    |       |
    v       v
Inference  Storage ports
    |       |
    +--- platform composition root ---+
          |                       |
     native/http adapter      SQLite/IndexedDB adapter
```

Rules:

1. `airia-core` must not import React, React Native, Expo, IndexedDB, WebLLM,
   Swift/Kotlin modules, `window`, `navigator`, or `localStorage`.
2. UI code calls application use cases, not storage or inference SDKs directly.
3. Native modules never contain product decisions such as subscription tier or
   memory relevance. They expose device capabilities and execute model work.
4. Platform selection happens in each application's composition root.

## Correct the current tier model

The current `Tier` type mixes commercial/product tier with execution backend.
Native mobile makes that ambiguity expensive. Split it into two concepts:

```ts
type EntitlementTier = 'free' | 'cloud' | 'local'
type InferenceBackend = 'native' | 'cloud' | 'ollama-custom'
```

The router should return a backend decision containing availability and reason:

```ts
interface BackendSelection {
  backend: InferenceBackend
  modelId: string
  available: boolean
  reason?: string
}
```

This allows a free user to use native inference, a paid user to choose native or
cloud, and any user to configure an Ollama server without changing entitlement
logic.

## Shared contracts

### Inference port

The core should depend on a contract similar to:

```ts
interface InferenceEngine {
  getCapabilities(): Promise<DeviceCapabilities>
  prepareModel(manifest: ModelManifest): Promise<void>
  activateModel(modelId: string): Promise<void>
  generate(request: GenerationRequest): AsyncIterable<GenerationEvent>
  cancel(requestId: string): Promise<void>
  unload(): Promise<void>
}
```

`GenerationEvent` should cover model-download progress, load progress, tokens,
completion, cancellation, and structured errors. Request IDs are necessary so
navigation, app backgrounding, and user cancellation cannot cross streams.

The existing `NativeAppBridge` is a useful prototype, but it should evolve into
this port. Avoid putting JavaScript callbacks and `AbortSignal` directly in the
native contract; translate native events and request IDs into an async iterable
inside `airia-inference-native`.

### Storage ports

Extract repositories for:

- Conversations and messages.
- Memories.
- Feedback/preference pairs.
- Training jobs and model metadata.
- Settings and backend selection.

Use IndexedDB implementations on web and SQLite implementations on native.
Authentication tokens and secrets belong in Keychain/Keystore-backed secure
storage, not SQLite or AsyncStorage. GGUF model files belong in application file
storage, not the database.

### Model manifest

Every downloadable model needs a signed manifest containing at least:

- Model ID and semantic version.
- Download URL and byte size.
- SHA-256 digest and signature.
- Quantization and context size.
- Minimum RAM/storage requirements.
- Supported architectures/backends.
- License and attribution metadata.
- Compatible adapter versions.

Download to a temporary file, verify it, then activate it atomically. Interrupted
downloads must resume; invalid or incomplete files must never become active.

## UI strategy

Keep the current web UI and the mobile UI separate. DOM elements, CSS behavior,
browser lifecycle, and mobile-native navigation are materially different.

Share:

- Design tokens and icons.
- Product copy and localization keys.
- Domain types and validation.
- Headless view models/application hooks where they have no DOM dependency.
- Analytics event names and accessibility labels.

Do not initially share:

- React components between web and native.
- CSS or layout implementations.
- Navigation containers.
- Browser persistence/lifecycle hooks.

iOS and Android should share the React Native screen/component layer. Use
`.ios.tsx` and `.android.tsx` only for real platform differences such as system
menus, permissions, haptics, or lifecycle behavior. This should produce one
mobile product codebase, not two parallel UIs.

## Native inference approach

### Initial implementation

Evaluate `llama.rn` behind AIrIA's own inference adapter. It currently provides
React Native bindings to llama.cpp, Metal support on iOS, and Android CPU/OpenCL
paths. Wrapping it prevents a third-party library API from becoming AIrIA's
application contract.

Do not commit the product to it until the technical spike passes on real
devices. The iOS simulator does not represent the Metal inference path, and
Android GPU support varies significantly by chipset.

### Model delivery

Do not bundle the primary model into the initial app binary. Download it after
install with:

- Explicit size disclosure and user confirmation.
- Wi-Fi-only option.
- Free-space check.
- Pause/resume and retry.
- Cryptographic verification.
- Delete/re-download controls.
- Model/version rollback.

Apple's review guidelines require apps to disclose and prompt before downloading
additional resources needed at first launch. Android App Bundles support large
asset delivery, but a cross-platform signed model registry gives AIrIA one model
lifecycle across direct, beta, and store distribution.

### Backend fallback

Recommended selection order:

1. Explicit user backend choice, if healthy.
2. Native model, if supported, downloaded, and within thermal/memory limits.
3. Authenticated AIrIA cloud inference.
4. Custom Ollama endpoint.
5. Clear no-backend state; never silently begin a huge download.

The user must always see which backend/model is active.

## Delivery phases

### Phase 0 — Decisions and contracts (3–5 days)

- Supersede ADR-015/016 with the native-mobile decision.
- Split entitlement tier from inference backend.
- Finalize inference, storage, model-manifest, and capability contracts.
- Decide whether offline inference is required for the first mobile beta.
- Choose candidate models and licenses for benchmarking.

**Exit gate:** contracts reviewed before UI or native module implementation.

### Phase 1 — Real-device inference spike (1–2 weeks)

- Scaffold a minimal New Architecture React Native/Expo development build.
- Integrate `llama.rn` behind a throwaway adapter.
- Download, verify, load, generate, cancel, unload, and reload one candidate
  GGUF model.
- Test three iOS device classes and representative 6 GB, 8 GB, and 12 GB
  Android devices where available.
- Measure peak memory, time to first token, tokens/second, thermal throttling,
  battery use, background/foreground recovery, and 30-minute stability.

**Proposed go/no-go gates:** no process termination, reliable cancellation,
p95 first-token latency under 8 seconds after model load, at least 5 tokens/sec
on the oldest supported device, and 30 minutes of repeated generation without a
leak. Final thresholds should be treated as product decisions.

### Phase 2 — Core extraction (1–2 weeks)

- Create `airia-core` and move platform-neutral context, memory scoring,
  preference-pair, and chat orchestration logic into it.
- Replace direct `@airia/db` usage in services with repository interfaces.
- Replace browser-dependent `TierRouter` behavior with injected capability,
  settings, and health-check ports.
- Add adapter conformance tests shared by web and native implementations.
- Keep the web application working throughout the extraction.

**Exit gate:** core tests run in Node without browser globals.

### Phase 3 — Mobile cloud vertical slice (1–2 weeks)

- Build onboarding, conversation list, chat, settings, model/backend indicator,
  streaming, cancellation, and error states in React Native.
- Use the HTTP/cloud adapter first.
- Add secure authentication storage and native SQLite repositories.
- Add crash reporting and backend/model telemetry without logging message
  contents.

**Exit gate:** TestFlight/Internal App Sharing builds can complete persistent
cloud-backed conversations before native inference is added.

### Phase 4 — Production native model lifecycle (2–3 weeks)

- Implement signed manifest retrieval and resumable model download.
- Add storage checks, download UI, checksum/signature validation, atomic model
  activation, delete, update, and rollback.
- Connect native inference to the same chat use case as cloud inference.
- Handle memory pressure, app backgrounding, audio interruptions, cancellation,
  and device capability changes.
- Add backend fallback and explicit user controls.

**Exit gate:** airplane-mode conversation works after model installation, and a
failed model load returns to cloud/custom backend without crashing.

### Phase 5 — Product parity and migration (2–3 weeks)

- Feedback capture, memories, retry, copy/share, training status, themes, model
  transparency, and opt-in sync.
- Define PWA-to-native data migration. Browser IndexedDB is not automatically
  available to the native app; migration requires authenticated sync or an
  explicit encrypted export/import flow.
- Add notifications and deep links only after the core chat flow is stable.

**Exit gate:** agreed mobile parity checklist passes on both platforms.

### Phase 6 — Hardening and release (2–3 weeks)

- XCTest/JUnit/native-module tests and React Native integration/E2E tests.
- Real-device performance matrix and long-running thermal/memory tests.
- Accessibility, offline, low-storage, interrupted-download, corrupt-model,
  upgrade, downgrade, and account-deletion tests.
- Privacy disclosures, model licenses, App Store/Play metadata, review account,
  TestFlight and Play closed testing.
- Gradual rollout with native inference behind a remotely controlled feature
  flag and cloud fallback.

**Exit gate:** crash-free beta target and store review checklist approved.

## Testing and CI

CI lanes should include:

- Shared TypeScript lint, typecheck, and unit tests.
- Core contract tests against in-memory, IndexedDB, SQLite, HTTP, and native
  adapters.
- iOS and Android native compilation on every native change.
- Swift/XCTest and Kotlin/JUnit tests for module lifecycle and error mapping.
- React Native E2E tests for cloud mode on simulators/emulators.
- Scheduled real-device inference benchmarks; simulators are insufficient for
  Metal/GPU acceptance.
- Signed TestFlight and Play internal builds from protected release branches.

Record benchmark results by app version, model digest, device, OS, backend,
context size, peak memory, first-token latency, and generation rate.

## Main risks

| Risk | Mitigation |
| --- | --- |
| Small native model quality is below the product bar | Ship cloud mode first; benchmark models before committing |
| iOS memory termination | Conservative model/context limits, real-device soak tests, unload on pressure |
| Android GPU fragmentation | CPU baseline, capability reporting, tested allowlist for acceleration |
| Model download size and failed downloads | Explicit consent, resume, integrity checks, atomic activation |
| Web/native data divergence | Repository contracts plus explicit sync/export migration design |
| Native dependency churn | Pin versions, wrap third-party APIs, maintain conformance tests |
| Two UIs drift visually | Shared tokens, screenshots, accessibility IDs, parity checklist |
| Tier/backend logic becomes tangled | Separate entitlement from inference backend now |

## Decisions needed before implementation

Recommended defaults are included in parentheses:

1. Is offline inference mandatory for the first beta? (**No: cloud-first beta,
   native inference behind a feature flag.**)
2. Maximum model download size? (**Target under 1 GB initially.**)
3. Oldest supported devices? (**Set only after the real-device spike.**)
4. Is conversation/memory sync required at launch? (**No; opt-in after the
   local-only path is stable.**)
5. One visual design across platforms or platform-specific navigation?
   (**Shared brand and screens, native navigation conventions.**)
6. Build approach? (**Expo development builds/CNG with New Architecture; move
   to more manual native project management only if a measured blocker appears.**)

## Effort estimate

For one experienced React Native engineer with occasional native support, plan
approximately 12–16 weeks from architecture through store-ready beta. A small
team can parallelize UI, core extraction, and native inference after Phase 1,
but the real-device inference spike remains the critical path.

## References

- [React Native native platform guidance](https://reactnative.dev/docs/native-platform)
- [React Native New Architecture](https://reactnative.dev/architecture/landing-page)
- [Expo monorepo guidance](https://docs.expo.dev/guides/monorepos/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo custom native code](https://docs.expo.dev/workflow/customizing/)
- [Expo standalone/local module structure](https://docs.expo.dev/more/create-expo-module/)
- [`llama.rn` native inference binding](https://github.com/mybigday/llama.rn)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Android App Bundle format](https://developer.android.com/guide/app-bundle/app-bundle-format)
