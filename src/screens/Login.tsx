import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function Login() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading       = useAuthStore((s) => s.isLoading)
  const pendingOtp      = useAuthStore((s) => s.pendingOtp)
  const login           = useAuthStore((s) => s.login)
  const verifyOtp       = useAuthStore((s) => s.verifyOtp)
  const resendOtp       = useAuthStore((s) => s.resendOtp)
  const cancelOtp       = useAuthStore((s) => s.cancelOtp)

  if (isAuthenticated) return <Navigate to="/" replace />

  return pendingOtp
    ? <OtpStep maskedEmail={pendingOtp.maskedEmail}
               isLoading={isLoading}
               onVerify={verifyOtp}
               onResend={resendOtp}
               onCancel={cancelOtp} />
    : <CredentialsStep isLoading={isLoading} onLogin={login} />
}

// ── Step 1: username + password ───────────────────────────────────────────────

function CredentialsStep({
  isLoading,
  onLogin,
}: {
  isLoading: boolean
  onLogin: (u: string, p: string) => Promise<void>
}) {
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onLogin(username.trim(), password)
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: string | { message?: string } } })
        ?.response?.data
      if (typeof raw === 'string')         setError(raw)
      else if (raw && typeof raw === 'object' && 'message' in raw)
        setError((raw as { message: string }).message)
      else setError('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading && !submitting) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg">
            W
          </div>
          <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Perfect ELT Warehouse</h1>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="username">
                ชื่อผู้ใช้
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="password">
                รหัสผ่าน
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:ring-offset-zinc-900"
            >
              {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Step 2: device OTP ────────────────────────────────────────────────────────

const OTP_LENGTH = 6

function OtpStep({
  maskedEmail,
  isLoading,
  onVerify,
  onResend,
  onCancel,
}: {
  maskedEmail: string
  isLoading:  boolean
  onVerify:   (otp: string) => Promise<void>
  onResend:   () => Promise<void>
  onCancel:   () => void
}) {
  const [digits,      setDigits]     = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error,       setError]      = useState<string | null>(null)
  const [submitting,  setSubmitting] = useState(false)
  const [resending,   setResending]  = useState(false)
  const [resendMsg,   setResendMsg]  = useState<string | null>(null)
  const [resendCooldown, setCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first empty cell on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  function handleDigitChange(index: number, value: string) {
    // Handle paste of full OTP into any cell
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, OTP_LENGTH)
      const next = [...digits]
      for (let i = 0; i < pasted.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = pasted[i]
      }
      setDigits(next)
      const focusIdx = Math.min(index + pasted.length, OTP_LENGTH - 1)
      inputRefs.current[focusIdx]?.focus()
      return
    }
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft'  && index > 0)              inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  const otp = digits.join('')
  const isComplete = otp.length === OTP_LENGTH && digits.every(Boolean)

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (!isComplete) return
    setError(null)
    setSubmitting(true)
    try {
      await onVerify(otp)
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: string | { message?: string } } })
        ?.response?.data
      if (typeof raw === 'string')         setError(raw)
      else if (raw && typeof raw === 'object' && 'message' in raw)
        setError((raw as { message: string }).message)
      else setError('รหัสไม่ถูกต้องหรือหมดอายุ กรุณาลองอีกครั้ง')
      // Clear digits on wrong OTP
      setDigits(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResendMsg(null)
    setError(null)
    setResending(true)
    try {
      await onResend()
      setResendMsg('ส่งรหัสใหม่ไปยังอีเมลของคุณแล้ว')
      setCooldown(60)
      setDigits(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } catch {
      setError('ส่งรหัสใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg">
            ✉
          </div>
          <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">ยืนยันอุปกรณ์</h1>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500 leading-relaxed">
            รหัส {OTP_LENGTH} หลักถูกส่งไปที่
          </p>
          <p className="mt-0.5 text-sm font-medium text-blue-600 dark:text-blue-400">{maskedEmail}</p>
        </div>

        <form
          onSubmit={handleVerify}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm"
        >
          <div className="space-y-5">
            {/* OTP digit inputs */}
            <div>
              <label className="mb-3 block text-xs font-medium text-slate-400 text-center">
                กรอกรหัสยืนยัน
              </label>
              <div className="flex justify-center gap-2.5">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    className={`
                      h-12 w-10 rounded-lg border text-center text-lg font-bold
                      bg-white text-zinc-800 transition-colors
                      focus:outline-none focus:ring-2
                      ${d
                        ? 'border-blue-500 ring-blue-500/30'
                        : 'border-zinc-300 focus:border-blue-500 focus:ring-blue-500/30'
                      }
                      ${error ? 'border-red-400' : ''}
                    `}
                    aria-label={`Digit ${i + 1}`}
                    disabled={submitting || isLoading}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200 text-center">
                {error}
              </p>
            )}

            {resendMsg && !error && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 ring-1 ring-green-200 text-center">
                {resendMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={!isComplete || submitting || isLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'กำลังยืนยัน…' : 'ยืนยันและเข้าสู่ระบบ'}
            </button>

            {/* Resend */}
            <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
              <span>ไม่ได้รับรหัส?</span>
              {resendCooldown > 0 ? (
                <span className="text-slate-600">
                  ส่งใหม่ใน {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-blue-600 hover:text-blue-700 disabled:opacity-50 underline underline-offset-2"
                >
                  {resending ? 'กำลังส่ง…' : 'ส่งรหัสใหม่'}
                </button>
              )}
            </div>

            {/* Back */}
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              ← กลับหน้าเข้าสู่ระบบ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
