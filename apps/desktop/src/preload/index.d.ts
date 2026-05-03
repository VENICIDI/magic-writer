import type { ElectronAPI } from '@electron-toolkit/preload'
import type { MagicWriterAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: MagicWriterAPI
  }
}

export {}
