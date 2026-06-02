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
      else setError('Login failed. Check your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading && !submitting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg">
            W
          </div>
          <h1 className="text-xl font-semibold text-white">Perfect ELT Warehouse</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 ring-1 ring-red-500/30">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
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
      else setError('Invalid or expired code. Please try again.')
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
      setResendMsg('A new code was sent to your email.')
      setCooldown(60)
      setDigits(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } catch {
      setError('Could not resend the code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg">
            ✉
          </div>
          <h1 className="text-xl font-semibold text-white">Verify your device</h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            A {OTP_LENGTH}-digit code was sent to
          </p>
          <p className="mt-0.5 text-sm font-medium text-brand-400">{maskedEmail}</p>
        </div>

        <form
          onSubmit={handleVerify}
          className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <div className="space-y-5">
            {/* OTP digit inputs */}
            <div>
              <label className="mb-3 block text-xs font-medium text-slate-400 text-center">
                Enter verification code
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
                      bg-slate-800 text-slate-100 transition-colors
                      focus:outline-none focus:ring-2
                      ${d
                        ? 'border-brand-500 ring-brand-500/40'
                        : 'border-slate-700 focus:border-brand-500 focus:ring-brand-500/40'
                      }
                      ${error ? 'border-red-500/60' : ''}
                    `}
                    aria-label={`Digit ${i + 1}`}
                    disabled={submitting || isLoading}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 ring-1 ring-red-500/30 text-center">
                {error}
              </p>
            )}

            {resendMsg && !error && (
              <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400 ring-1 ring-green-500/30 text-center">
                {resendMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={!isComplete || submitting || isLoading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Verifying…' : 'Verify & Sign in'}
            </button>

            {/* Resend */}
            <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
              <span>Didn't get it?</span>
              {resendCooldown > 0 ? (
                <span className="text-slate-600">
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-brand-400 hover:text-brand-300 disabled:opacity-50 underline underline-offset-2"
                >
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              )}
            </div>

            {/* Back */}
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              ← Back to sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
