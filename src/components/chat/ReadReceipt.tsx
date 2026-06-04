import { memo } from 'react'
import { Check, CheckCheck } from 'lucide-react'

interface ReadReceiptProps {
  isRead: boolean
}

export const ReadReceipt = memo(function ReadReceipt({ isRead }: ReadReceiptProps) {
  if (isRead) {
    return <CheckCheck size={12} className="text-blue-500" />
  }
  return <Check size={12} className="text-zinc-400 dark:text-zinc-500" />
})
