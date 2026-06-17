import {
  useEffect,
  useRef,
  useCallback,
  memo,
  type UIEvent,
} from 'react'
import { Loader2 } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useAuthStore } from '../../store/authStore'
import type { ChatMessage } from '../../types/chat'

interface Props {
  roomId: number
  onLoadMore: (roomId: number, beforeId: number) => void
  onDeleteMessage?: (messageId: number) => void
}

function isSameDay(a: string, b: string) {
  try {
    const da = new Date(a)
    const db = new Date(b)
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    )
  } catch {
    return false
  }
}

function formatDateSeparator(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const DateSeparator = memo(function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-3 px-4 select-none">
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
    </div>
  )
})

export const ChatMessageList = memo(function ChatMessageList({
  roomId,
  onLoadMore,
  onDeleteMessage,
}: Props) {
  const user = useAuthStore((s) => s.user)
  const messages = useChatStore((s) => s.messages[roomId] ?? [])
  const hasMore = useChatStore((s) => s.hasMore[roomId] ?? false)
  const loading = useChatStore((s) => s.loadingMessages[roomId] ?? false)
  const typingSet = useChatStore((s) => s.typing[roomId])
  const typingNames = typingSet ? Array.from(typingSet) : []
  const partnerLastReadId = useChatStore((s) => s.partnerLastReadId[roomId] ?? 0)

  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  const isNearBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)

  // Scroll to bottom on initial load and new own messages
  useEffect(() => {
    if (!initialScrollDoneRef.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      initialScrollDoneRef.current = true
      return
    }
    // Auto-scroll only when already near bottom
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // After prepending older messages, restore scroll position so it doesn't jump
  useEffect(() => {
    const el = containerRef.current
    if (!el || !prevScrollHeightRef.current) return
    const diff = el.scrollHeight - prevScrollHeightRef.current
    if (diff > 0) el.scrollTop += diff
    prevScrollHeightRef.current = 0
  })

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      isNearBottomRef.current = fromBottom < 80

      // Trigger load more when near top
      if (el.scrollTop < 120 && hasMore && !loading && messages.length > 0) {
        prevScrollHeightRef.current = el.scrollHeight
        onLoadMore(roomId, messages[0].id)
      }
    },
    [hasMore, loading, messages, roomId, onLoadMore],
  )

  function renderMessages() {
    const items: React.ReactNode[] = []
    let prevMsg: ChatMessage | null = null

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const next = messages[i + 1] ?? null

      // Date separator
      if (!prevMsg || !isSameDay(prevMsg.sentAt, msg.sentAt)) {
        items.push(<DateSeparator key={`sep-${msg.sentAt}`} label={formatDateSeparator(msg.sentAt)} />)
      }

      // Admin messages (any sender) → right side; guest messages → left side
      const isOwn = msg.sender !== null
      const isMyMessage = user ? msg.sender?.id === user.id : false

      // Show sender label when sender changes — skip for own messages
      const showSender =
        !isMyMessage &&
        (prevMsg === null ||
          !isSameDay(prevMsg.sentAt, msg.sentAt) ||
          prevMsg.sender?.id !== msg.sender?.id ||
          prevMsg.guestSenderId !== msg.guestSenderId)

      // Group adjacent messages from the same side
      const nextIsOwn = next ? next.sender !== null : false
      const isLastInGroup = !next || nextIsOwn !== isOwn || !isSameDay(msg.sentAt, next.sentAt)
      void isLastInGroup

      items.push(
        <MessageBubble
          key={msg.id || msg.clientMessageId}
          message={msg}
          isOwn={isOwn}
          showSender={showSender}
          isRead={isMyMessage && msg.id > 0 && msg.id <= partnerLastReadId}
          onDelete={onDeleteMessage ? () => onDeleteMessage(msg.id) : undefined}
        />,
      )

      prevMsg = msg
    }

    return items
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
    >
      {/* Load-more spinner at top */}
      {loading && (
        <div className="flex justify-center py-3">
          <Loader2 size={16} className="animate-spin text-zinc-400" />
        </div>
      )}

      {!hasMore && messages.length > 0 && (
        <div className="flex justify-center py-2">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            เริ่มต้นการสนทนา
          </span>
        </div>
      )}

      {messages.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400 dark:text-zinc-500 select-none">
          <span className="text-sm">ยังไม่มีข้อความ</span>
          <span className="text-xs">เริ่มบทสนทนาได้เลย</span>
        </div>
      )}

      {renderMessages()}

      <TypingIndicator names={typingNames} />

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
})
