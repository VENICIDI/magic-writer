import { loader } from '@monaco-editor/react'
// 正文为纯文本写作，只需编辑器内核，无需任何语言高亮/语言 worker（ts/css/html/json 等）。
// 仅引入 editor.api 可大幅减小打包体积，避免把全部语言 worker 一起打进产物。
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// 离线打包：让 Monaco 的 web worker 走 Vite 本地产物，而非默认的 CDN/绝对路径。
// 纯文本只会用到基础 editorWorkerService，统一返回基础 worker 即可。
self.MonacoEnvironment = {
  getWorker(): Worker {
    return new editorWorker()
  }
}

// 让 @monaco-editor/react 使用本地 bundle 的 monaco 实例，避免运行时从 CDN 拉取。
loader.config({ monaco })

export { monaco }
