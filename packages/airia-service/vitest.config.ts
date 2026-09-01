import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@airia/types': resolve(__dirname, '../airia-types/src/index.ts'),
      '@airia/db': resolve(__dirname, '../airia-db/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
