import { memo } from 'react'

interface Props {
  roomId: number
  roomName: string
}

// Primitive props only — re-renders solely when the active room's id/name
// actually changes, never when unrelated room-list fields (unreadCount,
// lastMessage, etc.) update the parent's `rooms` array.
export const ChatHeader = memo(function ChatHeader({ roomId, roomName }: Props) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
          {roomName || `ห้อง #${roomId}`}
        </p>
      </div>
    </div>
  )
})
