import { cpSync, existsSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// workspace 内部的 TypeScript 源码包必须被 bundle，不能 external
const workspaceDeps = [
  '@magic-writer/shared',
  '@magic-writer/llm-gateway',
  '@magic-writer/agent-core',
  '@magic-writer/rag',
  '@magic-writer/worldview-analyzer'
]

function copyWorldviewPublic(): { name: string; closeBundle: () => void } {
  return {
    name: 'copy-worldview-public',
    closeBundle() {
      const src = resolve(__dirname, '../../packages/worldview-analyzer/public')
      const dest = resolve(__dirname, 'out/main/worldview-public')
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true })
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspaceDeps }), copyWorldviewPublic()],
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
