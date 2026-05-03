/**
 * Magic Writer · Worker Pool
 *
 * 使用 worker_threads 隔离执行重型任务（批量 Embedding、全书审校等），
 * 保证主线程零阻塞。
 */
import { Worker } from 'worker_threads'
import { join } from 'path'

export interface WorkerTask<T = unknown> {
  id: string
  type: string
  data: unknown
  resolve: (value: T) => void
  reject: (error: Error) => void
}

export class WorkerPool {
  private workers: Array<{ worker: Worker; busy: boolean }> = []
  private queue: WorkerTask[] = []
  private maxWorkers: number

  constructor(maxWorkers = 2) {
    this.maxWorkers = maxWorkers
  }

  /**
   * 提交任务到 Worker 池
   */
  async submit<T>(type: string, data: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: WorkerTask<T> = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        data,
        resolve: resolve as (value: unknown) => void,
        reject
      }
      this.queue.push(task as WorkerTask)
      this.processQueue()
    })
  }

  private processQueue(): void {
    if (this.queue.length === 0) return

    // 查找空闲 Worker
    let slot = this.workers.find((w) => !w.busy)

    // 如果没有空闲的，且未达上限，创建新的
    if (!slot && this.workers.length < this.maxWorkers) {
      const worker = new Worker(join(__dirname, 'worker-entry.js'))
      slot = { worker, busy: false }
      this.workers.push(slot)
    }

    if (!slot) return // 所有 Worker 忙碌，等待

    const task = this.queue.shift()!
    slot.busy = true

    const onMessage = (result: { ok: boolean; data?: unknown; error?: string }): void => {
      slot!.busy = false
      slot!.worker.removeListener('message', onMessage)
      slot!.worker.removeListener('error', onError)

      if (result.ok) {
        task.resolve(result.data)
      } else {
        task.reject(new Error(result.error ?? 'Worker task failed'))
      }

      // 继续处理队列
      this.processQueue()
    }

    const onError = (err: Error): void => {
      slot!.busy = false
      slot!.worker.removeListener('message', onMessage)
      slot!.worker.removeListener('error', onError)
      task.reject(err)
      this.processQueue()
    }

    slot.worker.on('message', onMessage)
    slot.worker.on('error', onError)
    slot.worker.postMessage({ id: task.id, type: task.type, data: task.data })
  }

  /**
   * 关闭所有 Worker
   */
  async terminate(): Promise<void> {
    for (const { worker } of this.workers) {
      await worker.terminate()
    }
    this.workers = []
    this.queue = []
  }

  /**
   * 当前队列长度
   */
  get pending(): number {
    return this.queue.length
  }

  /**
   * 活跃 Worker 数
   */
  get active(): number {
    return this.workers.filter((w) => w.busy).length
  }
}

// 全局单例
let pool: WorkerPool | null = null

export function getWorkerPool(): WorkerPool {
  if (!pool) pool = new WorkerPool(2)
  return pool
}

export function shutdownWorkerPool(): void {
  if (pool) {
    void pool.terminate()
    pool = null
  }
}
