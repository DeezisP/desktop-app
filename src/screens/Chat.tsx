import { useEffect, useCallback, useRef, useState } from 'react'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import { useChat } from '../hooks/useChat'
import { ChatRoomList } from '../components/chat/ChatRoomList'
import { ChatMessageList } from '../components/chat/ChatMessageList'
import { ChatInput } from '../components/chat/ChatInput'
import { ChatHeader } from '../components/chat/ChatHeader'
import { selectTotalUnread } from '../store/chatStore'

function EmptyRoomPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400 dark:text-zinc-500 select-none">
      <MessageSquare size={40} className="opacity-30" />
      <div className="text-center">
        <p className="text-sm font-medium">เลือกห้องสนทนา</p>
        <p className="text-xs mt-0.5">เลือกห้องทางซ้ายเพื่อดูข้อความ</p>
      </div>
    </div>
  )
}

export default function Chat() {
  const activeRoomId = useChatStore((s) => s.activeRoomId)
  const rooms = useChatStore((s) => s.rooms ?? [])
  const totalUnread = useChatStore(selectTotalUnread)
  const { loadRooms, loadMessages, sendMessage, notifyTyping, markRoomRead, deleteRoom, deleteMessage } = useChat()

  const setActiveRoom = useChatStore((s) => s.setActiveRoom)
  const messages = useChatStore((s) => (activeRoomId ? (s.messages ?? {})[activeRoomId] : undefined))
  
  const [isMobile, setIsMobile] = useState(false)
  const originalTitleRef = useRef<string>('')

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Capture original title once
  useEffect(() => {
    originalTitleRef.current = document.title
    return () => { document.title = originalTitleRef.current }
  }, [])

  // Update tab title when there are unread messages
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ข้อความใหม่ — Admin Chat`
    } else {
      document.title = originalTitleRef.current || 'Admin Chat'
    }
  }, [totalUnread])

  const activeRoom = rooms.find((r) => r.id === activeRoomId)

  // Load messages when room is selected (only if not already loaded)
  useEffect(() => {
    if (!activeRoomId) return
    const existing = messages ?? []
    if (existing.length === 0) {
      loadMessages(activeRoomId)
    }
  }, [activeRoomId, loadMessages, messages])

  // Mark as read when entering a room
  useEffect(() => {
    if (!activeRoomId) return
    const msgs = messages ?? []
    if (msgs.length === 0) return
    const lastId = msgs[msgs.length - 1]?.id
    markRoomRead(activeRoomId, lastId)
  }, [activeRoomId, markRoomRead, messages])

  const handleSelectRoom = useCallback(
    (roomId: number) => {
      setActiveRoom(roomId)
    },
    [setActiveRoom],
  )

  const handleLoadMore = useCallback(
    (roomId: number, beforeId: number) => {
      loadMessages(roomId, beforeId)
    },
    [loadMessages],
  )

  const handleSend = useCallback(
    (content: string, file?: File) => {
      if (!activeRoomId) return
      sendMessage(activeRoomId, content, file)
    },
    [activeRoomId, sendMessage],
  )

  const handleTyping = useCallback(() => {
    if (!activeRoomId) return
    notifyTyping(activeRoomId)
  }, [activeRoomId, notifyTyping])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Room list sidebar */}
      {(!isMobile || !activeRoomId) && (
      <aside className={`${isMobile ? 'w-full' : 'w-80'} flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden`}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-blue-500" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              แชท
            </span>
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={loadRooms}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="รีเฟรชห้องสนทนา"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        <ChatRoomList onSelectRoom={handleSelectRoom} onDeleteRoom={deleteRoom} />
      </aside>
      )}

      {/* Main chat area */}
      {(!isMobile || activeRoomId) && (
      <div className={`flex-1 h-full flex flex-col min-w-0 ${isMobile ? 'absolute inset-0 z-50' : 'relative'} bg-zinc-50 dark:bg-zinc-950`}>
        {activeRoomId && activeRoom ? (
          <>
            <ChatHeader roomId={activeRoom.id} roomName={activeRoom.name} />

            {/* Messages */}
            <ChatMessageList
              roomId={activeRoomId}
              onLoadMore={handleLoadMore}
              onDeleteMessage={deleteMessage}
            />

            {/* Input */}
            <ChatInput onSend={handleSend} onTyping={handleTyping} />
          </>
        ) : (
          <EmptyRoomPlaceholder />
        )}
      </div>
      )}
    </div>
  )
}
