import { memo, useState } from 'react'
import { Check, CheckCheck, Pencil, Trash2, FileText, Download } from 'lucide-react'
import type { ChatMessage } from '../../types/chat'
import { ImageLightbox } from './ImageLightbox'

const MEDIA_ORIGIN = 'https://www.perfectelt.com'

function resolveFileUrl(fileUrl: string): string {
  if (!fileUrl) return ''
  if (fileUrl.startsWith('http') || fileUrl.startsWith('blob:')) return fileUrl
  return `${MEDIA_ORIGIN}${fileUrl}`
}

function isImageFile(fileUrl: string, fileType: string | null): boolean {
  if (fileType?.startsWith('image')) return true
  if (!fileType) return /\.(jpe?g|png|gif|webp)$/i.test(fileUrl)
  return false
}

function isPdfFile(fileUrl: string, fileType: string | null): boolean {
  if (fileType?.includes('pdf')) return true
  return fileUrl.toLowerCase().endsWith('.pdf')
}

interface Props {
  message: ChatMessage
  isOwn: boolean
  showSender: boolean
  isRead?: boolean
  onDelete?: () => void
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showSender,
  isRead,
  onDelete,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

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

  const read = isRead ?? message.isRead

  const fileUrl = message.fileUrl
  const resolvedUrl = fileUrl ? resolveFileUrl(fileUrl) : null
  const isImage = fileUrl ? isImageFile(fileUrl, message.fileType) : false
  const isPdf = fileUrl ? isPdfFile(fileUrl, message.fileType) : false

  // Show text unless it's a placeholder from the backend
  const displayText =
    message.messageText && message.messageText !== 'Sent an attachment'
      ? message.messageText
      : null

  const bubbleBase = isOwn
    ? 'bg-blue-500 text-white'
    : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'

  const roundOwn = 'rounded-[16px_16px_4px_16px]'
  const roundOther = 'rounded-[16px_16px_16px_4px]'
  const bubbleRound = isOwn ? roundOwn : roundOther

  return (
    <>
      {lightboxOpen && resolvedUrl && (
        <ImageLightbox src={resolvedUrl} onClose={() => setLightboxOpen(false)} />
      )}

      <div className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-1`}>
        {showSender && !isOwn && (
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 px-1 mb-0.5">
            {senderName}
          </span>
        )}

        <div className={`flex items-end gap-1 max-w-[72%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Delete button — always slightly visible, full opacity on hover */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm('ลบข้อความนี้ใช่ไหม?')) onDelete()
              }}
              className="opacity-20 hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all flex-shrink-0 self-center"
              title="ลบข้อความ"
            >
              <Trash2 size={11} />
            </button>
          )}

          <div className="flex flex-col gap-0.5">
            {/* Image attachment */}
            {isImage && resolvedUrl && (
              <div
                className={`overflow-hidden shadow-sm cursor-pointer ${bubbleRound}`}
                onClick={() => setLightboxOpen(true)}
                title="คลิกเพื่อดูรูปเต็ม"
              >
                <img
                  src={resolvedUrl}
                  alt="รูปภาพ"
                  className="max-w-[220px] max-h-[280px] block object-cover"
                />
              </div>
            )}

            {/* PDF attachment */}
            {isPdf && resolvedUrl && (
              <button
                onClick={() => window.open(resolvedUrl, '_blank')}
                className={`flex items-center gap-2.5 px-3 py-2.5 shadow-sm text-left ${bubbleBase} ${bubbleRound}`}
              >
                <div className={`p-1.5 rounded-lg ${isOwn ? 'bg-white/20' : 'bg-red-50 dark:bg-red-950/30'}`}>
                  <FileText size={15} className={isOwn ? 'text-white' : 'text-red-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">PDF Document</p>
                  <p className="text-[10px] opacity-60">แตะเพื่อเปิด</p>
                </div>
                <Download size={12} className="opacity-50 flex-shrink-0" />
              </button>
            )}

            {/* Other file */}
            {fileUrl && !isImage && !isPdf && resolvedUrl && (
              <button
                onClick={() => window.open(resolvedUrl, '_blank')}
                className={`flex items-center gap-1.5 px-3 py-2 shadow-sm text-xs ${bubbleBase} ${bubbleRound}`}
              >
                <Download size={12} /> ดาวน์โหลดไฟล์
              </button>
            )}

            {/* Text bubble */}
            {displayText && (
              <div className={`relative px-3 py-2 shadow-sm text-sm leading-relaxed break-words ${bubbleBase} ${bubbleRound}`}>
                {message.isEdited && (
                  <Pencil size={9} className={`inline-block mr-1 mb-0.5 ${isOwn ? 'text-blue-200' : 'text-zinc-400'}`} />
                )}
                {displayText}
              </div>
            )}
          </div>

          {/* Timestamp + delivery */}
          <div className={`flex items-center gap-0.5 pb-0.5 flex-shrink-0 ${isOwn ? 'flex-row-reverse' : ''}`}>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
              {formatTime(message.sentAt)}
            </span>
            {isOwn && (
              <span className="text-[10px]">
                {read ? (
                  <CheckCheck size={11} className="text-blue-400" />
                ) : (
                  <Check size={11} className="text-zinc-400" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
})
