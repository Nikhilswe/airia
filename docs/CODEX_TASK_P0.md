# Codex Task Brief — AIrIA Phase 0 Scaffold

## Context
You are generating boilerplate for AIrIA, a local-first personal AI PWA.
The CTO has already written all TypeScript interfaces in `src/types/core.ts`.
You implement against those interfaces. You do NOT modify anything in `src/types/`.

## Stack
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3 (for utility classes only, no custom config needed beyond theme tokens)
- idb (IndexedDB wrapper)
- Vitest (unit tests)
- Playwright (E2E, stub only)
- ESLint + Prettier + Husky

## Tasks

### 1. package.json
Include these exact scripts:
- `dev` — vite dev server
- `build` — vite build
- `typecheck` — tsc --noEmit
- `lint` — eslint src --ext .ts,.tsx
- `lint:fix` — eslint src --ext .ts,.tsx --fix
- `test:unit` — vitest run
- `test:e2e` — playwright test

Dependencies: react, react-dom, idb
DevDependencies: vite, @vitejs/plugin-react, typescript, eslint, prettier, husky, lint-staged, vitest, @vitest/ui, @playwright/test, @types/react, @types/react-dom, tailwindcss, autoprefixer

### 2. vite.config.ts
- React plugin
- PWA manifest (name: AIrIA, short_name: airIA, theme_color: #BA7517)
- Path alias: `@` → `src/`

### 3. tsconfig.json
- Strict mode ON
- Target: ES2022
- Module: ESNext
- Path alias matching vite config

### 4. .eslintrc.cjs
- @typescript-eslint/recommended
- react-hooks/recommended
- No unused vars as error
- No explicit any as error

### 5. .prettierrc
- Single quotes: true
- Semi: false
- Tab width: 2
- Print width: 100

### 6. .husky/pre-commit
Run: lint-staged
lint-staged config in package.json:
- `*.{ts,tsx}` → eslint --fix, prettier --write
- `*.{json,md}` → prettier --write

### 7. .github/workflows/ci.yml
Jobs in order (each must pass before next runs):
1. lint — npm run lint
2. typecheck — npm run typecheck
3. test — npm run test:unit
4. build — npm run build

### 8. src/db/schema.ts
IndexedDB schema using idb. Stores:
- `conversations` — keyPath: id, indexes: updatedAt
- `messages` — keyPath: id, indexes: conversationId, timestamp
- `feedback` — keyPath: id, indexes: conversationId, timestamp
- `memory` — keyPath: id, indexes: category, lastSeen, confidence
- `skills` — keyPath: skillId
- `adapters` — keyPath: id

Export: `DB_NAME = 'airia-prod'`, `DB_VERSION = 1`, `openDB()` function

### 9. src/db/client.ts
Typed wrappers (using the interfaces from src/types/core.ts):
- `getConversations()` — sorted by updatedAt desc
- `getMessages(conversationId)` — sorted by timestamp asc
- `upsertConversation(c)`, `upsertMessage(m)`
- `deleteConversation(id)` — cascades to messages, feedback

### 10. src/services/OllamaHealth.ts
- `pingOllama(endpoint: string): Promise<boolean>`
- `getAvailableModels(endpoint: string): Promise<string[]>`
- Timeout: 3000ms
- No throws — returns false / [] on error

### 11. Component shells (no logic, just structure + props interface)

`src/components/ChatWindow.tsx`
- Props: conversationId, tier
- Renders: message list, input bar
- Imports: MessageBubble, InputBar, OrbAvatar

`src/components/MessageBubble.tsx`
- Props: message (Message type from core.ts), onFeedback
- Renders: bubble + feedback row (thumb_up, thumb_down, retry, copy)

`src/components/InputBar.tsx`
- Props: onSend, disabled, placeholder
- Renders: textarea + send button

`src/components/OrbAvatar.tsx`
- Props: trustLevel (0-3), animating
- Renders: the AIrIA orb — expressiveness scales with trustLevel

### 12. src/styles/themes.css
CSS custom property sets for 6 themes. Each theme is a data-theme attribute selector.
Themes: dawn (default), midnight, forest, ocean, rose, slate
Each defines: --accent, --accent-dark, --accent-light, --accent-border, --accent-text, --orb-bg, --orb-glow

Dawn accent: #BA7517
Midnight accent: #534AB7
Forest accent: #3B6D11
Ocean accent: #185FA5
Rose accent: #993556
Slate accent: #444441

## Hard rules
- Do NOT modify src/types/core.ts or src/services/TierRouter.ts
- Do NOT add any business logic — shells only
- Do NOT add any API calls except in OllamaHealth.ts
- Use the exact interface types from src/types/core.ts in all components
- Every file must typecheck with tsc --noEmit
- ESLint must pass with zero errors
