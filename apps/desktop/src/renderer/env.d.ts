/// <reference types="vite/client" />

// monaco-editor 的 editor.api 子路径不在其 exports 映射内，tsc(bundler) 无法解析其类型；
// Vite 能从文件系统正确打包，这里仅补一份类型映射到 monaco 主入口。
declare module 'monaco-editor/esm/vs/editor/editor.api' {
  export * from 'monaco-editor'
}
