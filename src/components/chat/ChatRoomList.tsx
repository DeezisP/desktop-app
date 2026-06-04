import { memo } from 'react'
import { Users, User, Loader2 } from 'lucide-react'
import { useChatStore, selectSortedRooms } from '../../store/chatStore'
import type { ChatRoom } from '../../types/chat'

interface Props {
  onSelectRoom: (roomId: number) => void
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const now = Date.now()
    const diff = now - new Date(iso).getTime()
    if (diff < 60_000) return 'เมื่อกี้'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} นาที`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชั่วโมง`
    return new Date(iso).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

const RoomItem = memo(function RoomItem({
  room,
  isActive,
  onClick,
}: {
  room: ChatRoom
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-950/50'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 relative">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
            isActive ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
          }`}
        >
          {room.isGroup ? (
            <Users size={16} />
          ) : (
            <User size={16} />
          )}
        </div>
      </div>

      {/* Room info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className={`text-sm font-medium truncate ${
              isActive
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-zinc-800 dark:text-zinc-100'
            }`}
          >
            {room.name || `ห้อง #${room.id}`}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
            {formatRelativeTime(room.lastMessageAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {room.lastMessage ?? 'ไม่มีข้อความ'}
          </span>
          {room.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
              {room.unreadCount > 99 ? '99+' : room.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

export const ChatRoomList = memo(function ChatRoomList({ onSelectRoom }: Props) {
  const rooms = useChatStore(selectSortedRooms)
  const activeRoomId = useChatStore((s) => s.activeRoomId)
  const loading = useChatStore((s) => s.loadingRooms)

  // ════════════════════════════════════════════════════════════════════════════
  // AUDIT LOGGING: Log all rooms and filter logic
  // ════════════════════════════════════════════════════════════════════════════
  
  console.log('[ChatRoomList] ═══════════════════════════════════════════════════')
  console.log('[ChatRoomList] selector output - total rooms:', rooms.length)
  console.log('[ChatRoomList] activeRoomId:', activeRoomId)
  console.log('[ChatRoomList] loading:', loading)
  
  // Log each room
  rooms.forEach((room, idx) => {
    const msgPreview = room.lastMessage 
      ? room.lastMessage.substring(0, 30) + '...'
      : '(null)'
    console.log(`[ChatRoomList] room[${idx}]:`, {
      id: room.id,
      name: room.name,
      nameType: typeof room.name,
      nameLength: room.name?.length ?? 0,
      lastMessage: msgPreview,
      lastMessageType: typeof room.lastMessage,
      unreadCount: room.unreadCount,
      isGroup: room.isGroup,
      guestToken: room.guestToken ? '✓' : '(none)',
      membersCount: room.members?.length ?? 'undefined',
    })
  })

  // Filter out rooms with no lastMessage (like web admin implementation)
  const filteredRooms = rooms.filter(r => 
    r.lastMessage !== null && 
    r.lastMessage !== undefined && 
    String(r.lastMessage).trim() !== ''
  )

  console.log('[ChatRoomList] after filter - valid rooms:', filteredRooms.length, 'filtered out:', rooms.length - filteredRooms.length)
  console.log('[ChatRoomList] ═══════════════════════════════════════════════════')

  // Debug logging
  if (typeof window !== 'undefined' && filteredRooms.length > 0) {
    console.log('[ChatRoomList] first filtered room details:', JSON.stringify(filteredRooms[0], null, 2))
  }

  if (loading && filteredRooms.length === 0) {
    console.log('[ChatRoomList] showing loading state')
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </div>
    )
  }

  if (filteredRooms.length === 0) {
    console.log('[ChatRoomList] showing empty state (no valid rooms after filter)')
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1 text-zinc-400 dark:text-zinc-500 px-4 text-center select-none">
        <Users size={28} className="mb-1 opacity-40" />
        <p className="text-sm">ยังไม่มีห้องสนทนา</p>
        <p className="text-xs">รอลูกค้าเริ่มแชทก่อนนะ</p>
      </div>
    )
  }

  console.log('[ChatRoomList] rendering', filteredRooms.length, 'rooms')
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {filteredRooms.map((room: ChatRoom) => (
          <RoomItem
            key={room.id}
            room={room}
            isActive={room.id === activeRoomId}
            onClick={() => onSelectRoom(room.id)}
          />
        ))}
      </div>
    </div>
  )
})
