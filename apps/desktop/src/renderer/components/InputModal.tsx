import { useState, useRef, useEffect } from 'react'
import { IconX } from './Icons'

interface InputModalProps {
  open: boolean
  title: string
  placeholder?: string
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function InputModal({ open, title, placeholder, defaultValue, onConfirm, onCancel }: InputModalProps): React.ReactElement | null {
  const [value, setValue] = useState(defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue ?? '')
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [open, defaultValue])

  if (!open) return null

  const handleSubmit = (): void => {
    if (value.trim()) {
      onConfirm(value.trim())
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-[360px] rounded-xl border border-surface-600 bg-surface-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600">
          <h3 className="text-sm font-medium text-gray-200">{title}</h3>
          <button className="text-gray-500 hover:text-gray-300" onClick={onCancel}>
            <IconX size={14} />
          </button>
        </div>
        <div className="px-4 py-4">
          <input
            ref={inputRef}
            className="input-field !text-sm !py-2.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') onCancel()
            }}
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-surface-600">
          <button
            className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-surface-700"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-accent px-4 py-1.5 text-xs text-white hover:bg-accent-80 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
