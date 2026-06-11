/**
 * useChatToast — DEPRECATED / NO-OP
 *
 * Toast notifications are now driven by useGlobalChatMessages (mounted in
 * Layout), which subscribes to /topic/admin/notifications permanently and
 * fires toasts directly from the incoming STOMP payload.
 *
 * This file is kept to avoid breaking any stale imports but does nothing.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function useChatToast() {}
