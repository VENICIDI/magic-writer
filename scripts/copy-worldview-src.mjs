import fs from 'node:fs'
import path from 'node:path'

const srcRoot = 'c:/Users/dudu/Desktop/世界观分析/src'
const destRoot = 'c:/Users/dudu/Desktop/magic-writer/packages/worldview-analyzer/src'
const skipFiles = new Set(['index.ts', 'config.ts', 'server.ts', 'standalone.ts'])

function walk(dir, base = '') {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.join(base, name)
    if (fs.statSync(full).isDirectory()) {
      fs.mkdirSync(path.join(destRoot, rel), { recursive: true })
      walk(full, rel)
    } else if (name.endsWith('.ts')) {
      if (!rel.includes(path.sep) && skipFiles.has(name)) continue
      let text = fs.readFileSync(full, 'utf8')
      text = text.replace(/\.js"/g, '"')
      const out = path.join(destRoot, rel)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, text, 'utf8')
    }
  }
}

walk(srcRoot)
console.log('worldview source files copied')
