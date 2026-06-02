import { useBarcode } from '../hooks/useBarcode'

interface Props {
  onScan: (barcode: string) => void
  disabled?: boolean
  placeholder?: string
}

export function BarcodeInput({ onScan, disabled = false, placeholder = 'Scan barcode…' }: Props) {
  const { inputRef } = useBarcode({ onScan, disabled })

  return (
    <input
      ref={inputRef}
      type="text"
      readOnly
      disabled={disabled}
      placeholder={placeholder}
      className="
        w-full rounded-lg border border-slate-600 bg-slate-800
        px-4 py-3 text-sm text-slate-100 placeholder-slate-500
        focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40
        disabled:opacity-40
      "
      aria-label="Barcode scanner input"
    />
  )
}
