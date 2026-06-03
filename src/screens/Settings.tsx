import { useEffect, useRef, useState } from 'react'
import {
  Sun, Moon, Monitor, Volume2, VolumeX, Bell, BellOff,
  Info, Cpu, MapPin, ChevronRight, CheckCircle2,
  RefreshCw, Download, RotateCcw, AlertTriangle, Loader2,
  ArrowDownToLine,
} from 'lucide-react'
import { useSettingsStore, type ThemeMode } from '../store/settingsStore'
import { sounds } from '../service/sounds'
import { toast } from '../components/Toast'
import type { UpdateStatus } from '../types/api'

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {title}
      </h2>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
        {children}
      </div>
    </div>
  )
}

// ── Generic row ───────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode
  label: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
        {description && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:ring-offset-zinc-900 ${
        checked ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ── Theme selector ────────────────────────────────────────────────────────────

const THEMES: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'สว่าง',   icon: <Sun  size={14} /> },
  { value: 'dark',   label: 'มืด',     icon: <Moon size={14} /> },
  { value: 'system', label: 'ระบบ', icon: <Monitor size={14} /> },
]

function ThemeSelector() {
  const theme    = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div className="flex gap-1.5">
      {THEMES.map((t) => {
        const active = theme === t.value
        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              active
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Station name field ────────────────────────────────────────────────────────

function StationNameField() {
  const stationName    = useSettingsStore((s) => s.stationName)
  const setStationName = useSettingsStore((s) => s.setStationName)
  const [draft, setDraft] = useState(stationName)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setStationName(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        placeholder="เช่น Station 1"
        maxLength={40}
        className="w-40 px-2.5 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
      />
      <button
        onClick={handleSave}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
      >
        {saved ? <CheckCircle2 size={13} /> : 'บันทึก'}
      </button>
    </div>
  )
}

// ── Updates section ───────────────────────────────────────────────────────────

function UpdatesSection() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onUpdateStatus) return

    unsubRef.current = api.onUpdateStatus((s) => {
      setStatus(s)

      // Toast for notable transitions
      if (s.state === 'available') {
        toast.info(`อัปเดตพร้อมแล้ว v${s.version}`, 'กำลังดาวน์โหลดในพื้นหลัง…')
      } else if (s.state === 'downloaded') {
        toast.success(`ดาวน์โหลด v${s.version} สำเร็จ`, 'คลิก "รีสตาร์ทและติดตั้ง" เพื่ออัปเดต')
      } else if (s.state === 'error') {
        toast.error('ตรวจสอบอัปเดตไม่สำเร็จ', s.message)
      }
    })

    return () => { unsubRef.current?.(); unsubRef.current = null }
  }, [])

  function handleCheck() {
    window.electronAPI?.checkForUpdates?.()
  }

  function handleInstall() {
    window.electronAPI?.installUpdate?.()
  }

  // ── Status display ──────────────────────────────────────────────────────────

  const statusNode = (() => {
    switch (status.state) {
      case 'idle':
        return (
          <span className="text-xs text-zinc-400 dark:text-zinc-500"></span>
        )
      case 'checking':
        return (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 size={12} className="animate-spin" />
            กำลังตรวจสอบ…
          </span>
        )
      case 'not-available':
        return (
          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 size={12} />
            เวอร์ชันล่าสุดแล้ว (v{status.version})
          </span>
        )
      case 'available':
        return (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <Download size={12} />
            พบ v{status.version} — กำลังดาวน์โหลด…
          </span>
        )
      case 'downloading':
        return (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs text-blue-600 dark:text-blue-400">
              ดาวน์โหลด {status.percent}%
            </span>
            <div className="w-32 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${status.percent}%` }}
              />
            </div>
          </div>
        )
      case 'downloaded':
        return (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
          >
            <RotateCcw size={12} />
            รีสตาร์ทและติดตั้ง v{status.version}
          </button>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 max-w-[220px] truncate" title={status.message}>
            <AlertTriangle size={12} className="flex-shrink-0" />
            {status.message}
          </span>
        )
    }
  })()

  return (
    <Section title="อัปเดต">
      <div className="flex items-center gap-4 px-4 py-3.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
          <ArrowDownToLine size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">ตรวจสอบอัปเดต</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {statusNode}
          {status.state !== 'downloading' && status.state !== 'downloaded' && (
            <button
              onClick={handleCheck}
              disabled={status.state === 'checking'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={status.state === 'checking' ? 'animate-spin' : ''} />
              ตรวจสอบ
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── About section ─────────────────────────────────────────────────────────────

function AboutSection() {
  const [version, setVersion] = useState<string | null>(null)
  const [logPath, setLogPath] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI?.appVersion?.().then(setVersion).catch(() => setVersion('—'))
    window.electronAPI?.logPath?.().then(setLogPath).catch(() => {})
  }, [])

  function handleViewLog() {
    window.electronAPI?.openLogFile?.()
  }

  return (
    <Section title="เกี่ยวกับ">
      <Row icon={<Info size={15} />} label="เวอร์ชันแอปพลิเคชัน" description="Perfect Electronic">
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
          {version ?? '…'}
        </span>
      </Row>

      <Row icon={<Cpu size={15} />} label="แพลตฟอร์ม" description="Windows x64">
        <span className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
          {window.electronAPI?.platform ?? navigator.platform}
        </span>
      </Row>

      {logPath && (
        <button
          onClick={handleViewLog}
          className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
            <MapPin size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">ไฟล์บันทึกข้อผิดพลาด</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate max-w-xs">{logPath}</p>
          </div>
          <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-600 flex-shrink-0" />
        </button>
      )}
    </Section>
  )
}

// ── Sound preview button ──────────────────────────────────────────────────────

function SoundPreviewButton({ label, fn }: { label: string; fn: () => void }) {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled)
  return (
    <button
      onClick={fn}
      disabled={!soundEnabled}
      className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Settings() {
  const soundEnabled           = useSettingsStore((s) => s.soundEnabled)
  const notificationsEnabled   = useSettingsStore((s) => s.notificationsEnabled)
  const setSoundEnabled        = useSettingsStore((s) => s.setSoundEnabled)
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled)

  async function handleToggleNotifications(v: boolean) {
    if (v && Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        toast.warning('การแจ้งเตือนถูกปฏิเสธ', 'กรุณาอนุญาตการแจ้งเตือนในการตั้งค่า Windows')
        return
      }
    }
    setNotificationsEnabled(v)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-5 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">ตั้งค่า</h1>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">กำหนดค่าแอปพลิเคชันคลังสินค้า</p>
        </div>

        {/* ── General ── */}
        <Section title="ทั่วไป">
          <Row
            icon={<MapPin size={15} />}
            label="ชื่อสถานี"
            description="ระบุชื่อสถานีงานสำหรับการระบุตัวตน"
          >
            <StationNameField />
          </Row>
        </Section>

        {/* ── Appearance ── */}
        <Section title="รูปลักษณ์">
          <Row
            icon={<Sun size={15} />}
            label="ธีม"
            description="เลือกธีมแสงสว่าง มืด หรือตามระบบ"
          >
            <ThemeSelector />
          </Row>
        </Section>

        {/* ── Sound ── */}
        <Section title="เสียง">
          <Row
            icon={soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            label="เปิดใช้เสียง"
            description="เสียงตอบสนองสำหรับการสแกนและการแจ้งเตือน"
          >
            <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
          </Row>

          <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-1">ทดสอบ</span>
            <SoundPreviewButton label="สแกนสำเร็จ" fn={sounds.scanSuccess} />
            <SoundPreviewButton label="ข้อผิดพลาด" fn={sounds.scanError} />
            <SoundPreviewButton label="ยืนยัน" fn={sounds.confirm} />
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section title="การแจ้งเตือน">
          <Row
            icon={notificationsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            label="การแจ้งเตือนเดสก์ท็อป"
            description="แสดงการแจ้งเตือนระบบสำหรับกิจกรรมคลังสินค้า"
          >
            <Toggle checked={notificationsEnabled} onChange={handleToggleNotifications} />
          </Row>
        </Section>

        {/* ── Scanner ── */}
        <Section title="สแกนเนอร์">
          <Row
            icon={<Cpu size={15} />}
            label="โหมดสแกนเนอร์"
            description="รับอินพุตบาร์โค้ดผ่านสแกนเนอร์ USB HID อัตโนมัติ"
          >
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">พร้อมใช้งาน</span>
          </Row>
        </Section>

        {/* ── Updates ── */}
        <UpdatesSection />

        {/* ── About ── */}
        <AboutSection />
      </div>
    </div>
  )
}
