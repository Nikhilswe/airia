interface ImportMetaEnv {
  readonly VITE_AIRIA_TIER?: string
  readonly VITE_DEV_TRAINING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
