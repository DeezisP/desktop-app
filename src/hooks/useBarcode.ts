import { useEffect, useRef, useCallback } from 'react'

interface UseBarcodeOptions {
  onScan: (barcode: string) => void
  minLength?: number
  timeout?: number
  disabled?: boolean
}

export function useBarcode({
  onScan,
  minLength = 4,
  timeout = 80,
  disabled = false,
}: UseBarcodeOptions) {
  const inputRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef<string>('')
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    const code = bufferRef.current.trim()
    bufferRef.current = ''
    if (code.length >= minLength) onScan(code)
  }, [onScan, minLength])

  useEffect(() => {
    if (disabled) return

    const el = inputRef.current
    if (!el) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current)
        flush()
        return
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(flush, timeout)
      }
    }

    el.addEventListener('keydown', handleKeyDown)
    el.focus()

    return () => {
      el.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [disabled, flush, timeout])

  // Re-focus when the window regains focus (scanner needs focused input)
  useEffect(() => {
    if (disabled) return
    const refocus = () => inputRef.current?.focus()
    window.addEventListener('focus', refocus)
    return () => window.removeEventListener('focus', refocus)
  }, [disabled])

  return { inputRef }
}
