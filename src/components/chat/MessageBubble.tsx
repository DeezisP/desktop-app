import { memo } from 'react'
import { Check, CheckCheck, Pencil } from 'lucide-react'
import type { ChatMessage } from '../../types/chat'

interface Props {
  message: ChatMessage
  isOwn: boolean
  showSender: boolean
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showSender,
}: Props) {
  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <span className="text-xs italic text-zinc-400 dark:text-zinc-500 px-3 py-1.5">
          [ข้อความถูกลบแล้ว]
        </span>
      </div>
    )
  }

  const senderName = message.sender
    ? message.sender.firstname || message.sender.username
    : message.guestSenderId
      ? 'Guest'
      : 'Unknown'

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-1`}>
      {showSender && !isOwn && (
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 px-1 mb-0.5">
          {senderName}
        </span>
      )}

      <div className={`flex items-end gap-1.5 max-w-[72%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Bubble */}
        <div
          className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            isOwn
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-bl-sm'
          }`}
        >
          {message.isEdited && (
            <Pencil
              size={9}
              className={`inline-block mr-1 mb-0.5 ${isOwn ? 'text-blue-200' : 'text-zinc-400'}`}
            />
          )}
          {message.messageText}
        </div>

        {/* Timestamp + delivery */}
        <div className={`flex items-center gap-0.5 pb-0.5 flex-shrink-0 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
            {formatTime(message.sentAt)}
          </span>
          {isOwn && (
            <span className="text-[10px]">
              {message.isRead ? (
                <CheckCheck size={11} className="text-blue-400" />
              ) : (
                <Check size={11} className="text-zinc-400" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
