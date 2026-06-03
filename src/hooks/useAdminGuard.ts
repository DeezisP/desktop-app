import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../components/Toast'

// Returns requireAdmin() — call it before any admin-only action.
// Returns true if the user is an admin, false (and shows Thai warning) otherwise.

export function useAdminGuard() {
  const user = useAuthStore((s) => s.user)

  function requireAdmin(): boolean {
    const role = user?.role?.toUpperCase() ?? ''
    const isAdmin = role === 'ADMIN' || role === 'ROLE_ADMIN'
    if (!isAdmin) {
      useToastStore.getState().push({
        type:     'error',
        title:    'หยุดการกระทำนี้',
        message:  'คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ',
        duration: 4000,
      })
    }
    return isAdmin
  }

  return { requireAdmin }
}
