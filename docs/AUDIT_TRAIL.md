# AIrIA — Engineering Audit Trail

Tracks every shipped feature, fix, and architectural decision across sessions.
Updated by CTO (Claude Code) after each work block. Entries are chronological.

---

## Phase 0 — Scaffold (commit `6183004`)

| # | Item | Files | Status |
|---|------|-------|--------|
| 0.1 | Monorepo scaffold (pnpm workspaces, Turborepo) | `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | Done |
| 0.2 | Shared types package (`@airia/types`) | `packages/airia-types/src/index.ts` | Done |
| 0.3 | Database package (`@airia/db`) — Drizzle + SQLite | `packages/airia-db/src/schema.ts`, `client.ts` | Done |
| 0.4 | Service package (`@airia/service`) — OllamaClient, TierRouter, ContextManager, MemoryExtractor, MemoryService | `packages/airia-service/src/*` | Done |
| 0.5 | UI component library (`@airia/ui`) — OrbAvatar, ChatBubble, FeedbackRow, ThemeToken (6 themes) | `packages/airia-ui/src/*` | Done |
| 0.6 | Web frontend (`@airia/fe`) — Vite + React | `packages/airia-fe/` | Done |

## Phase 1 — Core Chat Loop (commit `7a52ab7`)

| # | Item | Files | Status |
|---|------|-------|--------|
| 1.1 | SSE streaming OllamaClient with abort control | `packages/airia-service/src/OllamaClient.ts` | Done |
| 1.2 | ContextManager — token budget, rolling truncation, summary trigger | `packages/airia-service/src/ContextManager.ts` | Done |
| 1.3 | MemoryExtractor — post-response fact extraction, 6 quality guardrails | `packages/airia-service/src/MemoryExtractor.ts` | Done |
| 1.4 | MemoryService — CRUD + retriever (recency + confidence + relevance) | `packages/airia-service/src/MemoryService.ts` | Done |
| 1.5 | useChat hook — wires all services, IndexedDB persistence | `packages/airia-fe/src/hooks/useChat.ts` | Done |
| 1.6 | ChatView — streaming render, theme switcher, settings panel | `packages/airia-fe/src/views/ChatView.tsx` | Done |
| 1.7 | OnboardingView — question-first, tier selection second | `packages/airia-fe/src/views/OnboardingView.tsx` | Done |
| 1.8 | Unit tests — OllamaClient, ContextManager, TierRouter, MemoryService, QualityValidator, LocalTrainer, WebGPU, PreferencePairBuilder | `packages/airia-service/tests/unit/*` (8 files, 69 tests) | Done |

## Phase 2 — React Native Mobile App (uncommitted)

### Infrastructure

| # | Item | Files | Status |
|---|------|-------|--------|
| 2.1 | RN app scaffold (Expo SDK 54, React Native 0.81) | `packages/airia-rn/` | Done |
| 2.2 | EAS build config — dev, simulator, preview, production profiles | `packages/airia-rn/eas.json` | Done |
| 2.3 | Node 22.13 + pnpm 11.2.2 pinned for EAS | `eas.json` all profiles | Done |
| 2.4 | iOS Xcode image pinned to `macos-sequoia-15.5-xcode-16.4` | `eas.json` ios sections | Done |
| 2.5 | react-native pnpm patch — `#include <thread>` for Xcode 16 libc++ | `patches/react-native@0.81.5.patch`, `pnpm-workspace.yaml` | Done |
| 2.6 | Podfile — FOLLY_CFG_NO_COROUTINES, Hermes debugger disable, fmt consteval patch | `packages/airia-rn/ios/Podfile` | Done |
| 2.7 | Ollama LAN binding — launchd plist, survives reboots | `~/Library/LaunchAgents/ai.airia.ollama.plist` | Done |

### Tier & Config Persistence

| # | Item | Files | Status |
|---|------|-------|--------|
| 2.8 | TierRouter.setStorage() — async hydration for RN | `packages/airia-service/src/TierRouter.ts` | Done |
| 2.9 | TierRouter.setOnDeviceCheck() — swappable capability check | `packages/airia-service/src/TierRouter.ts` | Done |
| 2.10 | File-backed KVStorage adapter for RN (tierStorage.ts) | `packages/airia-rn/src/db/tierStorage.ts` | Done |
| 2.11 | Port migration (11431 -> 11434) in tierStorage | `packages/airia-rn/src/db/tierStorage.ts` | Done |
| 2.12 | Metro endpoint auto-set only on first launch | `packages/airia-rn/src/screens/ChatScreen.tsx` | Done |
| 2.13 | Mobile-first tier priority — on-device overrides custom endpoint + stored config | `packages/airia-service/src/TierRouter.ts` | Done |
| 2.14 | React Native device detection (`navigator.product === 'ReactNative'`) | `packages/airia-service/src/TierRouter.ts` | Done |

### On-Device Inference (llama.rn)

| # | Item | Files | Status |
|---|------|-------|--------|
| 2.15 | llama.rn integration — NativeAppBridgeImpl | `packages/airia-rn/src/bridge/NativeAppBridgeImpl.ts` | Done |
| 2.16 | Model registry (Gemma 3 1B, Llama 3.2 1B) | `packages/airia-rn/src/bridge/models.ts` | Done |
| 2.17 | Gemma download URL fixed — ungated `unsloth` mirror (was gated `bartowski`, HTTP 401) | `packages/airia-rn/src/bridge/models.ts` | Done |
| 2.18 | Explicit model download flow — prompt -> downloading -> ready | `packages/airia-rn/src/screens/ChatScreen.tsx`, `ModelDownloadPrompt.tsx`, `ModelDownloadOverlay.tsx` | Done |
| 2.19 | ExpoGoStubBridge — safe fallback in Expo Go | `packages/airia-rn/src/bridge/ExpoGoStubBridge.ts` | Done |
| 2.20 | Chat template fix — pass `messages` to llama.rn (was sending `[object Object]` as prompt) | `packages/airia-rn/src/bridge/NativeAppBridgeImpl.ts` | Done |
| 2.21 | Stop tokens updated for Gemma/Llama families | `packages/airia-rn/src/bridge/NativeAppBridgeImpl.ts` | Done |
| 2.22 | useChat on-device routing — bridge-backed IOllamaClient when tier is on-device | `packages/airia-rn/src/hooks/useChat.ts` | Done |

### UI Polish

| # | Item | Files | Status |
|---|------|-------|--------|
| 2.23 | SafeAreaProvider wrapping entire app (was missing — insets were all zeros) | `packages/airia-rn/src/App.tsx` | Done |
| 2.24 | User bubble contrast — `accentDark` bg, white text | `packages/airia-ui/src/ChatBubble.tsx` | Done |
| 2.25 | Feedback icons — thumbs up/down emoji, edit label | `packages/airia-ui/src/FeedbackRow.tsx` | Done |
| 2.26 | Theme text contrast — textSecondary/textTertiary boosted ~25% for dark mode | `packages/airia-ui/src/ThemeToken.ts` | Done |
| 2.27 | Error message sanitization — raw ConnectException traces to friendly text | `packages/airia-rn/src/screens/ChatScreen.tsx` | Done |
| 2.28 | Removed floating user avatar dots, per-message OrbAvatar (kept in header only) | `packages/airia-rn/src/screens/ChatScreen.tsx` | Done |
| 2.29 | Keyboard/input bar — KAV wraps FlatList + input, platform-specific paddingBottom | `packages/airia-rn/src/screens/ChatScreen.tsx` | Done |
| 2.30 | Header model name shows actual model (`Gemma 3 1B (Q4)`) not stale WebLLM default | `packages/airia-rn/src/screens/ChatScreen.tsx` | Done |

---

## Known Issues / In Progress

| # | Issue | Root Cause | Status |
|---|-------|-----------|--------|
| B.1 | On-device chat falls back to Ollama endpoint when internet is off | `tierRouter.getCurrent()` may not return `on-device`; capability check wiring needs verification on physical device | **Debugging** — diagnostic logs added |
| B.2 | iOS EAS build — pnpm lockfile config mismatch | EAS used default pnpm (not 11.2.2); `patchedDependencies` hash format differs | **Fixed** — pnpm pinned in eas.json; awaiting rebuild |
| B.3 | iOS EAS build — `std::thread` / `HermesExecutorFactory.cpp` | Xcode 16 libc++ no longer transitively includes `<thread>` | **Fixed** — pnpm patch adds the include; awaiting rebuild |

---

## Deferred / Low Priority

| # | Item | Notes |
|---|------|-------|
| D.1 | SafeAreaView deprecation warning | Cosmetic warning only |
| D.2 | Legacy Architecture warning | RN 0.81 new arch not enabled |
| D.3 | pnpm dedupe | Reduces install size |
| D.4 | DHCP reservation for dev Mac | Prevents IP drift on LAN |
| D.5 | Hermes debugger re-enable | Disabled due to missing CDP symbols in prebuilt xcframework |
| D.6 | TestFlight / Play Store release build | Requires paid Apple Developer account for iOS |
| D.7 | Repo split (FE/BE separate GitHub repos) | Deferred — monorepo fine for now |
