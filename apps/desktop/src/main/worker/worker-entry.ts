/**
 * Magic Writer · Worker Entry
 *
 * Worker 线程入口，接收主线程发来的任务并执行。
 */
import { parentPort } from 'worker_threads'
import { HashBagEmbedder } from '@magic-writer/rag'

const embedder = new HashBagEmbedder()

parentPort?.on('message', async (msg: { id: string; type: string; data: unknown }) => {
  try {
    let result: unknown

    switch (msg.type) {
      case 'embed-batch': {
        const { texts } = msg.data as { texts: string[] }
        const vectors = await embedder.embedBatch(texts)
        // Float32Array 不能直接 postMessage，转为普通数组
        result = vectors.map((v) => Array.from(v))
        break
      }

      case 'count-words': {
        const { text } = msg.data as { text: string }
        const zh = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
        const en = (text.match(/[a-zA-Z]+/g) ?? []).length
        result = zh + en
        break
      }

      case 'analyze-consistency': {
        // 全书一致性分析（简版）
        const { chapters } = msg.data as { chapters: Array<{ id: string; content: string }> }
        const issues: Array<{ chapterId: string; type: string; description: string }> = []

        // 简单的人名出现频次分析
        const nameMap = new Map<string, Set<string>>()
        for (const ch of chapters) {
          // 提取引号内的人名（简版）
          const names = ch.content.match(/(?<=[""「])[\u4e00-\u9fff]{2,4}(?=[""」])/g) ?? []
          for (const name of names) {
            if (!nameMap.has(name)) nameMap.set(name, new Set())
            nameMap.get(name)!.add(ch.id)
          }
        }

        result = { issues, nameFrequency: Object.fromEntries(nameMap) }
        break
      }

      default:
        throw new Error(`Unknown task type: ${msg.type}`)
    }

    parentPort?.postMessage({ ok: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    parentPort?.postMessage({ ok: false, error: message })
  }
})
