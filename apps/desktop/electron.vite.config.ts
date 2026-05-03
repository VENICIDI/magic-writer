import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// workspace 内部的 TypeScript 源码包必须被 bundle，不能 external
const workspaceDeps = [
  '@magic-writer/shared',
  '@magic-writer/llm-gateway',
  '@magic-writer/agent-core',
  '@magic-writer/rag'
]

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspaceDeps })],
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspaceDeps })]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
