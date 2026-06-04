import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (content: string) => void
  onTyping: () => void
  disabled?: boolean
}

export function ChatInput({ onSend, onTyping, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    autoResize()
    onTyping()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  return (
    <div className="flex items-end gap-2 px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัด)"
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        style={{ minHeight: '36px', maxHeight: '120px' }}
      />
      <button
        onClick={submit}
        disabled={!value.trim() || disabled}
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="ส่งข้อความ"
      >
        <Send size={15} />
      </button>
    </div>
  )
}
