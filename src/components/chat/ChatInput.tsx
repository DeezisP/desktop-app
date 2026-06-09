import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent, type ClipboardEvent } from 'react'
import { Send, Paperclip, X, FileText } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  onSend: (content: string, file?: File) => void
  onTyping: () => void
  disabled?: boolean
}

export function ChatInput({ onSend, onTyping, disabled }: Props) {
  const [value, setValue] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  function attachFile(f: File) {
    setFile(f)
    setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    autoResize()
    onTyping()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) attachFile(f)
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) { attachFile(f); break }
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if ((!trimmed && !file) || disabled) return
    onSend(trimmed, file ?? undefined)
    setValue('')
    clearFile()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const canSend = (value.trim().length > 0 || file !== null) && !disabled

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {/* File preview strip */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
              {previewUrl ? (
                <img src={previewUrl} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-zinc-200 dark:border-zinc-700" alt="" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-red-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate">{file.name}</p>
                <p className="text-[10px] text-zinc-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={clearFile}
                className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2.5">
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/*,application/pdf"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          title="แนบไฟล์"
        >
          <Paperclip size={16} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="พิมพ์ข้อความ… (Enter ส่ง, Shift+Enter ขึ้นบรรทัด)"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          style={{ minHeight: '36px', maxHeight: '120px' }}
        />

        <button
          onClick={submit}
          disabled={!canSend}
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="ส่งข้อความ"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
