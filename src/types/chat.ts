export interface ChatRoomRef {
  id: number
}

export interface ChatSenderRef {
  id: number
  username: string
  firstname: string
  role: string
}

export interface ChatMessage {
  id: number
  clientMessageId: string
  room: ChatRoomRef
  sender: ChatSenderRef | null
  guestSenderId: string | null
  messageText: string
  sentAt: string
  isRead: boolean
  fileUrl: string | null
  fileType: string | null
  isDeleted: boolean
  isEdited: boolean
}

export interface ChatRoom {
  id: number
  name: string
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
  isGroup: boolean
  guestToken: string | null
}

export interface PagedMessageResponse {
  messages: ChatMessage[]
  nextCursor: string | null
  hasMore: boolean
}

export interface TypingPayload {
  roomId: number
  typing: boolean
}

export interface ReadReceiptPayload {
  roomId: number
  lastReadMessageId: number
}

export interface TypingBroadcast {
  roomId: number
  userId?: number
  displayName: string
  typing: boolean
}

export interface ReadBroadcast {
  roomId: number
  userId: number
  lastReadMessageId: number
}

export interface PresenceBroadcast {
  userId: number
  online: boolean
  lastSeen: string | null
}

export interface OutboundMessage {
  clientMessageId: string
  roomId: number
  content: string
}
