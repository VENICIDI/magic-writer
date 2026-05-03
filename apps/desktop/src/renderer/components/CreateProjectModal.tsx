import { useState, useRef, useEffect } from 'react'
import { IconX } from './Icons'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { title: string; genre: string; logline: string }) => void
}

export function CreateProjectModal({ open, onClose, onSubmit }: CreateProjectModalProps): React.ReactElement | null {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [logline, setLogline] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setGenre('')
      setLogline('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = (): void => {
    if (!title.trim()) return
    onSubmit({ title: title.trim(), genre: genre.trim(), logline: logline.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[440px] rounded-xl border border-surface-600 bg-surface-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600">
          <h2 className="text-sm font-semibold text-gray-200">新建作品</h2>
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-200 hover:bg-surface-700"
            onClick={onClose}
          >
            <IconX size={14} />
          </button>
        </div>

        {/* 表单 */}
        <div className="px-5 py-4 space-y-4">
          {/* 书名 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">书名 *</label>
            <input
              ref={inputRef}
              className="input-field !text-sm !py-2.5"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 30))}
              placeholder="输入你的作品名称"
              maxLength={30}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
            <div className="text-right text-[11px] text-gray-600 mt-1">{title.length}/30</div>
          </div>

          {/* 类型 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">类型</label>
            <select
              className="input-field !text-sm !py-2.5"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="">选择类型</option>
              <option value="玄幻">玄幻</option>
              <option value="仙侠">仙侠</option>
              <option value="都市">都市</option>
              <option value="言情">言情</option>
              <option value="科幻">科幻</option>
              <option value="悬疑">悬疑</option>
              <option value="历史">历史</option>
              <option value="游戏">游戏</option>
              <option value="奇幻">奇幻</option>
              <option value="军事">军事</option>
              <option value="其他">其他</option>
            </select>
          </div>

          {/* 简介 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">作品简介</label>
            <textarea
              className="input-field !text-sm resize-none"
              rows={3}
              value={logline}
              onChange={(e) => setLogline(e.target.value.slice(0, 500))}
              placeholder="选填，一句话描述你的故事"
              maxLength={500}
            />
            <div className="text-right text-[11px] text-gray-600 mt-1">{logline.length}/500</div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-surface-600">
          <button
            className="rounded-lg px-4 py-2 text-xs text-gray-400 hover:bg-surface-700"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-accent px-5 py-2 text-xs font-medium text-white hover:bg-accent-80 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            创建作品
          </button>
        </div>
      </div>
    </div>
  )
}
