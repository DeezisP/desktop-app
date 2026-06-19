import { memo } from 'react'
import { Users, User, Trash2 } from 'lucide-react'
import { useChatStore, selectSortedRooms } from '../../store/chatStore'
import { Skeleton } from '../Skeleton'
import type { ChatRoom } from '../../types/chat'

interface Props {
  onSelectRoom: (roomId: number) => void
  onDeleteRoom?: (roomId: number) => void
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
  onSelect,
  onDelete,
}: {
  room: ChatRoom
  isActive: boolean
  onSelect: (roomId: number) => void
  onDelete?: (roomId: number) => void
}) {
  const displayName = room.name?.trim()
    ? room.name
    : room.guestToken
      ? `Guest (${room.guestToken.substring(0, 8)}...)`
      : `Room #${room.id}`

  return (
    <div className={`group relative flex items-center transition-all duration-150 ${
      isActive ? 'bg-blue-50 dark:bg-blue-950/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
    }`}>
      <button
        onClick={() => onSelect(room.id)}
        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            {displayName}
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

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm(`ลบห้องสนทนา "${displayName}" ใช่ไหม?`)) onDelete(room.id)
          }}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 mr-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          title="ลบห้องสนทนา"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
})

export const ChatRoomList = memo(function ChatRoomList({ onSelectRoom, onDeleteRoom }: Props) {
  const allRooms = useChatStore(selectSortedRooms)
  const activeRoomId = useChatStore((s) => s.activeRoomId)
  const loading = useChatStore((s) => s.loadingRooms)

  // Only show rooms that have at least one message
  const rooms = allRooms.filter((r) => r.lastMessage != null)

  if (loading && rooms.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5" style={{ opacity: 1 - i * 0.12 }}>
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-10 flex-shrink-0" />
                </div>
                <Skeleton className="h-2.5 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1 text-zinc-400 dark:text-zinc-500 px-4 text-center select-none">
        <Users size={28} className="mb-1 opacity-40" />
        <p className="text-sm">ยังไม่มีห้องสนทนา</p>
        <p className="text-xs">รอลูกค้าเริ่มแชทก่อนนะ</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {rooms.map((room: ChatRoom) => (
          <RoomItem
            key={room.id}
            room={room}
            isActive={room.id === activeRoomId}
            onSelect={onSelectRoom}
            onDelete={onDeleteRoom}
          />
        ))}
      </div>
    </div>
  )
})
