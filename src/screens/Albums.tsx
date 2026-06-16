import React, {
  useState, useEffect, useLayoutEffect,
  useRef, useCallback, useMemo,
} from 'react'
import { createPortal } from 'react-dom'
import JSZip from 'jszip'
import {
  Plus, Upload, Trash2, FolderOpen, X, MoreVertical, Download,
  Loader2, Search, Check, CheckCircle2, XCircle, Edit3,
  ImageIcon, Package, ArrowLeft, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize, CheckSquare, Square, RotateCcw,
  Image as ImageIconSm, Camera, Copy,
} from 'lucide-react'
import { albumApi } from '../api/albumApi'
import { apiClient } from '../api/client'
import type { Album, Photo, AlbumWithPhotos, AlbumParams } from '../api/albumApi'
import { warehouseStompClient } from '../stomp/client'
import { photoRequestApi } from '../api/photoRequestApi'
import type { PhotoRequest } from '../api/photoRequestApi'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlbumRow extends Album {
  isUploading?: boolean
}

interface FilePreview { file: File; preview: string }

interface DlProgress {
  active: boolean
  label:  string
  loaded: number
  total:  number
  speed:  number   // bytes/sec (rolling average)
  eta:    number   // seconds remaining
  mode?:  'bytes' | 'photos'
  done?:  boolean
}
const DL_IDLE: DlProgress = { active: false, label: '', loaded: 0, total: 0, speed: 0, eta: 0 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(n: number): string {
  if (n < 1024)            return `${n} B`
  if (n < 1024 * 1024)    return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
function fmtETA(s: number): string {
  if (!isFinite(s) || s <= 0) return '—'
  if (s < 60)   return `${Math.ceil(s)} วิ`
  if (s < 3600) return `${Math.ceil(s / 60)} นาที`
  return `${(s / 3600).toFixed(1)} ชม.`
}

// ── DownloadProgressOverlay ────────────────────────────────────────────────────

function DownloadProgressOverlay({ dl }: { dl: DlProgress }) {
  const pct = dl.total > 0 ? Math.min(100, (dl.loaded / dl.total) * 100) : null
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-zinc-700 p-6">
        {dl.done ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">ดาวน์โหลดสำเร็จ!</p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate max-w-full">{dl.label}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
                <Download size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{dl.label}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">กำลังดาวน์โหลด...</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-3">
              {pct !== null ? (
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-linear"
                  style={{ width: `${pct}%` }}
                />
              ) : (
                <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '40%' }} />
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
              {dl.mode === 'photos' ? (
                <span className="font-mono tabular-nums">
                  {dl.loaded} / {dl.total} รูป
                </span>
              ) : (
                <span className="font-mono tabular-nums">
                  {fmtBytes(dl.loaded)}
                  {dl.total > 0 && <span className="text-slate-300 dark:text-zinc-600"> / {fmtBytes(dl.total)}</span>}
                </span>
              )}
              <div className="flex items-center gap-3">
                {dl.mode !== 'photos' && dl.speed > 1024 && (
                  <span className="font-mono tabular-nums">{fmtBytes(dl.speed)}/s</span>
                )}
                {dl.mode !== 'photos' && dl.eta > 0 && (
                  <span>เหลือ {fmtETA(dl.eta)}</span>
                )}
                {pct !== null && (
                  <span className="font-mono tabular-nums text-blue-500">{Math.round(pct)}%</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared download helpers ───────────────────────────────────────────────────

async function downloadAlbumZip(
  albumId: number,
  albumTitle: string,
  setDl: (p: DlProgress) => void,
): Promise<void> {
  const filename = `${albumTitle || 'album'}.zip`

  const filePath = await window.electronAPI?.showSaveDialog({
    title: 'บันทึกไฟล์',
    defaultPath: filename,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  })
  if (!filePath) return  // user cancelled

  const startTime = Date.now()
  setDl({ active: true, label: filename, loaded: 0, total: 0, speed: 0, eta: 0 })
  let success = false
  try {
    const res = await apiClient.get<ArrayBuffer>(`/keeps/albums/${albumId}/download`, {
      responseType: 'arraybuffer',
      timeout: 120_000,
      onDownloadProgress: (ev) => {
        const elapsed = Math.max((Date.now() - startTime) / 1000, 0.1)
        const speed   = ev.loaded / elapsed
        const eta     = speed > 0 && ev.total ? (ev.total - ev.loaded) / speed : 0
        setDl({ active: true, label: filename, loaded: ev.loaded, total: ev.total ?? 0, speed, eta })
      },
    })
    const data = new Uint8Array(res.data as ArrayBuffer)
    const result = await window.electronAPI?.writeFile(filePath, data)
    if (result && !result.ok) throw new Error(result.error)
    success = true
  } finally {
    if (success) {
      setDl({ active: true, label: filename, loaded: 0, total: 0, speed: 0, eta: 0, done: true })
      await new Promise(r => setTimeout(r, 1000))
    }
    setDl(DL_IDLE)
  }
}

async function downloadSinglePhoto(
  imageUrl: string,
  photoId: number,
  mimeType?: string,
): Promise<void> {
  const ext      = mimeType?.split('/')[1] || 'jpg'
  const filename = `photo-${photoId}.${ext}`

  const filePath = await window.electronAPI?.showSaveDialog({
    title: 'บันทึกรูปภาพ',
    defaultPath: filename,
    filters: [{ name: 'รูปภาพ', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
  })
  if (!filePath) return

  const blobUrl = await albumApi.fetchProtectedImage(imageUrl)
  if (!blobUrl) { alert('ไม่สามารถดาวน์โหลดไฟล์นี้ได้'); return }

  const response  = await fetch(blobUrl)
  const blob      = await response.blob()
  const data      = new Uint8Array(await blob.arrayBuffer())
  const result    = await window.electronAPI?.writeFile(filePath, data)
  if (result && !result.ok) alert('ไม่สามารถบันทึกไฟล์ได้: ' + result.error)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TAG_CONFIG = [
  { key: 'isReadyToShip',     label: 'พร้อมส่ง',   on: 'bg-blue-50 border-blue-300 text-blue-700',       off: 'bg-slate-50 border-slate-200 text-slate-500' },
  { key: 'isPreOrder',        label: 'พรีออเดอร์',  on: 'bg-purple-50 border-purple-300 text-purple-700', off: 'bg-slate-50 border-slate-200 text-slate-500' },
  { key: 'isAuthentic',       label: 'สินค้าแท้',   on: 'bg-emerald-50 border-emerald-300 text-emerald-700', off: 'bg-slate-50 border-slate-200 text-slate-500' },
  { key: 'isExpressDelivery', label: 'ส่งด่วน',     on: 'bg-orange-50 border-orange-300 text-orange-700', off: 'bg-slate-50 border-slate-200 text-slate-500' },
]

const FILTER_OPTIONS = [
  { label: 'ทั้งหมด',                      key: 'all' },
  { label: 'พร้อมส่ง',                     key: 'isReadyToShip' },
  { label: 'พรีออเดอร์',                   key: 'isPreOrder' },
  { label: 'สินค้าแท้',                    key: 'isAuthentic' },
  { label: 'ส่งด่วน',                      key: 'isExpressDelivery' },
  { label: 'เสร็จสิ้น',                    key: 'isDone' },
  { label: 'ยังไม่เสร็จ',                  key: 'isNotDone' },
  { label: 'ยังไม่กรอกข้อมูล(ยังไม่ทำ)', key: 'noInfo' },
  { label: 'กรอกข้อมูล(ยังไม่ทำ)',        key: 'hasInfo' },
]

const EMPTY_FORM = {
  description: '', price: '',
  isReadyToShip: false, isPreOrder: false,
  isAuthentic: false, isExpressDelivery: false, isDone: false,
}

// ── Blob cache (protected images) ─────────────────────────────────────────────

const blobCache = new Map<string, { url: string; refs: number }>()

let activeRequests = 0
const requestQueue: (() => void)[] = []
const MAX_CONCURRENT = 4

function acquireSlot(): Promise<void> {
  return new Promise(resolve => {
    if (activeRequests < MAX_CONCURRENT) { activeRequests++; resolve() }
    else requestQueue.push(() => { activeRequests++; resolve() })
  })
}
function releaseSlot() {
  activeRequests--
  if (requestQueue.length > 0) requestQueue.shift()!()
}

// ── ProtectedImage ─────────────────────────────────────────────────────────────

const ProtectedImage: React.FC<{ url: string; alt: string; className?: string }> = ({ url, alt, className }) => {
  const [blobUrl, setBlobUrl] = useState<string>(() => blobCache.get(url)?.url ?? '')
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect() } },
      { rootMargin: '100px' },
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const cached = blobCache.get(url)
    if (cached) { cached.refs++; setBlobUrl(cached.url); return }

    let isMounted = true;
    (async () => {
      await acquireSlot()
      try {
        const src = await albumApi.fetchProtectedImage(url)
        if (!isMounted || !src) return
        blobCache.set(url, { url: src, refs: 1 })
        setBlobUrl(src)
      } finally {
        releaseSlot()
      }
    })()

    return () => {
      isMounted = false
      const entry = blobCache.get(url)
      if (entry) {
        entry.refs--
        if (entry.refs <= 0) { URL.revokeObjectURL(entry.url); blobCache.delete(url) }
      }
    }
  }, [url, isVisible])

  return (
    <div ref={containerRef} className="w-full h-full">
      {blobUrl ? (
        <img src={blobUrl} alt={alt} className={className} />
      ) : (
        <div className="bg-slate-100 dark:bg-zinc-800 animate-pulse w-full h-full flex items-center justify-center">
          <ImageIconSm className="text-slate-300 dark:text-zinc-600" size={24} />
        </div>
      )}
    </div>
  )
}

// ── CoverImage ─────────────────────────────────────────────────────────────────

const CoverImage: React.FC<{ src: string }> = ({ src }) => {
  const [loaded, setLoaded] = useState(false)
  const [error, setError]   = useState(false)
  return (
    <div className="relative w-full h-full overflow-hidden">
      {!loaded && !error && <div className="absolute inset-0 bg-slate-100 dark:bg-zinc-800 animate-pulse" />}
      {error ? (
        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-slate-300 dark:text-zinc-600">
          <FolderOpen size={32} />
        </div>
      ) : (
        <img
          src={src} alt="" loading="lazy" decoding="async"
          className={`w-full h-full object-cover object-center transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </div>
  )
}

// ── AlbumGallery ──────────────────────────────────────────────────────────────

function AlbumGallery({ onSelectAlbum }: { onSelectAlbum: (id: number) => void }) {
  const titleInputRef = useRef<Record<number, HTMLInputElement | null>>({})

  const [albums,          setAlbums]          = useState<AlbumRow[]>([])
  const [albumsLoading,   setAlbumsLoading]    = useState(true)
  const [showCreateForm,  setShowCreateForm]   = useState(false)
  const [albumTitle,      setAlbumTitle]       = useState('')
  const [searchQuery,     setSearchQuery]      = useState('')
  const [activeFilter,    setActiveFilter]     = useState('all')
  const [selectedFiles,   setSelectedFiles]    = useState<FilePreview[]>([])
  const [activeMenu,      setActiveMenu]       = useState<number | null>(null)
  const [isDeletingId,    setIsDeletingId]     = useState<number | null>(null)
  const [deleteConfirm,   setDeleteConfirm]    = useState<{ id: number; title: string } | null>(null)
  const [formData,        setFormData]         = useState({ ...EMPTY_FORM })
  const [dlProgress,           setDlProgress]           = useState<DlProgress>(DL_IDLE)
  const [photoRequests,        setPhotoRequests]         = useState<Record<number, PhotoRequest[]>>(() => {
    try { const c = localStorage.getItem('photo-requests-cache'); return c ? JSON.parse(c) : {} } catch { return {} }
  })
  const [showRequestModal,     setShowRequestModal]      = useState<number | null>(null)
  const [requestNote,          setRequestNote]           = useState('')
  const [requestSampleFile,    setRequestSampleFile]     = useState<File | null>(null)
  const [requestSamplePreview, setRequestSamplePreview]  = useState<string | null>(null)
  const [requestSubmitting,    setRequestSubmitting]     = useState(false)
  const [copiedAlbumId,        setCopiedAlbumId]         = useState<number | null>(null)

  const loadAlbums = useCallback(async () => {
    try {
      const data = await albumApi.getAlbums()
      setAlbums(prev => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        return sorted.map(a => ({
          ...a,
          isUploading: prev.find(p => p.id === a.id)?.isUploading ?? false,
        }))
      })
    } catch {}
    finally { setAlbumsLoading(false) }
  }, [])

  useEffect(() => { loadAlbums() }, [loadAlbums])

  const loadPhotoRequests = useCallback(async () => {
    try {
      const all = await photoRequestApi.getAll()
      const byAlbum: Record<number, PhotoRequest[]> = {}
      all.forEach(r => {
        if (!byAlbum[r.albumId]) byAlbum[r.albumId] = []
        byAlbum[r.albumId].push(r)
      })
      localStorage.setItem('photo-requests-cache', JSON.stringify(byAlbum))
      setPhotoRequests(byAlbum)
    } catch {}
  }, [])

  useEffect(() => { loadPhotoRequests() }, [loadPhotoRequests])

  const closeRequestModal = () => {
    setShowRequestModal(null)
    setRequestNote('')
    setRequestSampleFile(null)
    if (requestSamplePreview) URL.revokeObjectURL(requestSamplePreview)
    setRequestSamplePreview(null)
  }

  const handleRequestSubmit = async () => {
    if (showRequestModal === null) return
    setRequestSubmitting(true)
    try {
      const req = await photoRequestApi.create(showRequestModal, requestNote, requestSampleFile ?? undefined)
      setPhotoRequests(prev => ({
        ...prev,
        [showRequestModal]: [...(prev[showRequestModal] ?? []), req],
      }))
      closeRequestModal()
    } catch {}
    finally { setRequestSubmitting(false) }
  }

  const handleCancelRequest = async (albumId: number) => {
    const requests = photoRequests[albumId] ?? []
    for (const req of requests) {
      try { await photoRequestApi.deleteRequest(req.id) } catch {}
    }
    setPhotoRequests(prev => { const n = { ...prev }; delete n[albumId]; return n })
    setActiveMenu(null)
  }

  // STOMP: real-time album list updates
  useEffect(() => {
    return warehouseStompClient.subscribe('/topic/albums', (msg) => {
      try {
        const { type, payload } = JSON.parse(msg.body)
        if (type === 'ALBUM_CREATED') {
          setAlbums(prev =>
            prev.some(a => a.id === payload.id) ? prev : [payload, ...prev]
          )
        }
        if (type === 'ALBUM_UPDATED') {
          setAlbums(prev => prev.map(a => a.id === payload.id ? { ...a, ...payload } : a))
        }
        if (type === 'ALBUM_DELETED') {
          setAlbums(prev => prev.filter(a => a.id !== payload.id))
        }
      } catch {}
    })
  }, [])

  // Load cover photos lazily for albums missing them
  useEffect(() => {
    const missing = albums.filter(a => !a.photos || a.photos.length === 0)
    missing.forEach(async (album) => {
      try {
        const photos = await albumApi.getAlbumPhotos(album.id)
        if (photos.length > 0) {
          setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, photos } : a))
        }
      } catch {}
    })
  }, [albums.map(a => a.id).join(',')])

  const isNoInfo = (a: AlbumRow) => !a.price && !a.description

  const filteredAlbums = useMemo(() => {
    const list = albums.filter(a => {
      if (!a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (activeFilter === 'all') return true
      if (activeFilter === 'isNotDone') return !a.isDone
      if (activeFilter === 'noInfo')   return isNoInfo(a) && !a.isDone
      if (activeFilter === 'hasInfo')  return !isNoInfo(a) && !a.isDone
      return (a as any)[activeFilter] === true
    }).filter(a => a.id !== isDeletingId)
    return [...list].sort((a, b) => {
      const aReq = (photoRequests[a.id]?.length ?? 0) > 0 ? 1 : 0
      const bReq = (photoRequests[b.id]?.length ?? 0) > 0 ? 1 : 0
      return bReq - aReq
    })
  }, [albums, searchQuery, activeFilter, isDeletingId, photoRequests])

  const getCount = (key: string) => {
    const all = albums.filter(a => a.id !== isDeletingId)
    if (key === 'all') return all.length
    if (key === 'isNotDone') return all.filter(a => !a.isDone).length
    if (key === 'noInfo')    return all.filter(a => isNoInfo(a) && !a.isDone).length
    if (key === 'hasInfo')   return all.filter(a => !isNoInfo(a) && !a.isDone).length
    return all.filter(a => (a as any)[key] === true).length
  }

  const handleUpdateField = async (album: AlbumRow, updates: Partial<AlbumRow>) => {
    const merged = { ...album, ...updates }
    setAlbums(prev => prev.map(a => a.id === album.id ? merged : a))
    try {
      const priceVal = merged.price
      await albumApi.updateAlbum(album.id, {
        title: merged.title,
        description: merged.description,
        price: priceVal === '' || priceVal === undefined ? undefined : Number(priceVal),
        isReadyToShip: merged.isReadyToShip,
        isPreOrder: merged.isPreOrder,
        isAuthentic: merged.isAuthentic,
        isExpressDelivery: merged.isExpressDelivery,
        isDone: merged.isDone,
      } as AlbumParams)
    } catch { loadAlbums() }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files).map(file => ({ file, preview: URL.createObjectURL(file) }))
    setSelectedFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (i: number) => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!albumTitle.trim() || selectedFiles.length === 0) return
    const tempId = -(Date.now())
    const title  = albumTitle
    const files  = [...selectedFiles]
    const data   = { ...formData }

    setAlbums(prev => [{
      id: tempId as any, title, photoCount: files.length,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      isUploading: true,
      isReadyToShip: data.isReadyToShip, isPreOrder: data.isPreOrder,
      isAuthentic: data.isAuthentic, isExpressDelivery: data.isExpressDelivery,
      isDone: data.isDone,
      photos: files.slice(0, 4).map(f => ({ fileUrl: f.preview } as any)),
    } as AlbumRow, ...prev])
    setAlbumTitle(''); setFormData({ ...EMPTY_FORM }); setSelectedFiles([]); setShowCreateForm(false)

    try {
      const newAlbum = await albumApi.createAlbum({
        ...data, title,
        price: data.price === '' ? undefined : Number(data.price),
        description: data.description,
      })
      await Promise.all(files.map(fp => albumApi.uploadPhoto(newAlbum.id, fp.file)))
      loadAlbums()
    } catch {
      setAlbums(prev => prev.filter(a => a.id !== tempId))
    } finally {
      files.forEach(fp => URL.revokeObjectURL(fp.preview))
    }
  }

  const executeDelete = async () => {
    if (!deleteConfirm) return
    const id = deleteConfirm.id
    setIsDeletingId(id); setDeleteConfirm(null)
    try { await albumApi.deleteAlbum(id) }
    catch { setIsDeletingId(null) }
  }

  const handleDownload = async (albumId: number, title: string) => {
    setActiveMenu(null)
    await downloadAlbumZip(albumId, title, setDlProgress)
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl"><ImageIcon size={18} className="text-white" /></div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-zinc-100 leading-tight">จัดการอัลบั้ม</h1>
              <p className="text-xs text-slate-400 dark:text-zinc-500">ทั้งหมด {albums.length} อัลบั้ม</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text" placeholder="ค้นหาอัลบั้ม..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-sm w-full sm:w-52 focus:ring-2 focus:ring-blue-500/30 outline-none dark:text-zinc-100 dark:placeholder-zinc-500 transition-all"
              />
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0"
            >
              <Plus size={16} /> สร้างอัลบั้ม
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
          {FILTER_OPTIONS.map(opt => {
            const count  = getCount(opt.key)
            const active = activeFilter === opt.key
            return (
              <button
                key={opt.key} onClick={() => setActiveFilter(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                {opt.label}
                {count > 0 && (
                  <span className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4 sm:gap-5">
          {albumsLoading && filteredAlbums.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-pulse" style={{ opacity: 1 - i * 0.08 }}>
                <div className="aspect-[4/3] bg-slate-100 dark:bg-zinc-800" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 bg-slate-100 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded w-1/3" />
                  <div className="h-8 bg-slate-100 dark:bg-zinc-800 rounded" />
                  <div className="h-12 bg-slate-100 dark:bg-zinc-800 rounded" />
                  <div className="flex gap-1.5">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-6 w-14 bg-slate-100 dark:bg-zinc-800 rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : filteredAlbums.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-400 dark:text-zinc-600">
              <Package size={44} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">ไม่พบอัลบั้มที่ตรงกัน</p>
            </div>
          ) : filteredAlbums.map((album, index) => {
            const isOverlay    = album.isUploading || isDeletingId === album.id
            const overlayLabel = isDeletingId === album.id ? 'กำลังลบ' : 'กำลังอัปโหลด'

            return (
              <div
                key={album.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md transition-all flex flex-col overflow-hidden"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {/* Cover */}
                {(() => {
                  const hasRequest = (photoRequests[album.id]?.length ?? 0) > 0
                  const requestNote = photoRequests[album.id]?.[0]?.note ?? ''
                  return (
                    <div
                      className="relative aspect-[4/3] cursor-pointer bg-slate-100 dark:bg-zinc-800 overflow-hidden"
                      onClick={() => !isOverlay && typeof album.id === 'number' && album.id > 0 && onSelectAlbum(album.id)}
                    >
                      {isOverlay && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="animate-spin text-blue-500" size={22} />
                          <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">{overlayLabel}</span>
                        </div>
                      )}
                      {/* Photo-request badge */}
                      {hasRequest && !isOverlay && (
                        <div className="absolute top-2 left-2 z-[2] flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                          <Camera size={10} /> ถ่ายรูปใหม่
                        </div>
                      )}
                      {album.photos && album.photos.length > 0 ? (
                        <>
                          <CoverImage src={(album.photos[0] as any).fileUrl} />
                          {/* Note overlay at bottom */}
                          {hasRequest && !isOverlay && requestNote && (
                            <div className="absolute bottom-0 left-0 right-0 z-[2] bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-4 pb-2">
                              <p className="text-[10px] text-white leading-snug line-clamp-2">{requestNote}</p>
                            </div>
                          )}
                          {album.photoCount > 1 && (
                            <div className={`absolute right-2 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full z-[3] ${hasRequest && requestNote ? 'bottom-9' : 'bottom-2'}`}>
                              +{album.photoCount - 1} รูป
                            </div>
                          )}
                        </>
                      ) : hasRequest ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-orange-50 dark:bg-orange-950/20 text-orange-400 dark:text-orange-500 px-3">
                          <Camera size={32} strokeWidth={1.5} />
                          <span className="text-[11px] font-bold tracking-wide">ถ่ายรูปใหม่</span>
                          {requestNote && (
                            <p className="text-[10px] text-center text-orange-400/80 dark:text-orange-400/70 leading-snug line-clamp-3 mt-0.5">{requestNote}</p>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-zinc-600">
                          <FolderOpen size={40} />
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Body */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Title + Menu */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <input
                        ref={el => { if (album.id > 0) titleInputRef.current[album.id] = el }}
                        className="w-full text-[15px] font-semibold text-slate-800 dark:text-zinc-100 bg-transparent border-none p-0 focus:outline-none focus:ring-0 placeholder:text-slate-300 cursor-copy"
                        value={album.title} placeholder="ชื่ออัลบั้ม"
                        onChange={e => {
                          const val = e.target.value
                          setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, title: val } : a))
                        }}
                        onBlur={e => handleUpdateField(album, { title: e.target.value })}
                        onClick={e => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(album.title).then(() => {
                            setCopiedAlbumId(album.id)
                            setTimeout(() => setCopiedAlbumId(null), 1500)
                          })
                        }}
                      />
                      <div className="mt-1">
                        {copiedAlbumId === album.id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                            <Check size={12} /> คัดลอกแล้ว
                          </span>
                        ) : album.isDone ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={12} /> เสร็จสิ้นแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500 dark:text-amber-400">
                            <XCircle size={12} /> ยังดำเนินการอยู่
                          </span>
                        )}
                      </div>
                    </div>
                    {album.id > 0 && (
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === album.id ? null : album.id) }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeMenu === album.id && (
                          <div
                            className="absolute right-0 top-9 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 w-48 overflow-hidden"
                            onMouseLeave={() => setActiveMenu(null)}
                          >
                            <button
                              className="w-full px-3.5 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors"
                              onClick={e => { e.stopPropagation(); titleInputRef.current[album.id]?.focus(); setActiveMenu(null) }}
                            >
                              <Edit3 size={14} /> เปลี่ยนชื่อ
                            </button>
                            <button
                              className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors ${
                                album.isDone
                                  ? 'hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                                  : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                              }`}
                              onClick={e => { e.stopPropagation(); handleUpdateField(album, { isDone: !album.isDone }); setActiveMenu(null) }}
                            >
                              {album.isDone ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                              {album.isDone ? 'ทำเครื่องหมายว่ายังไม่เสร็จ' : 'ทำเครื่องหมายว่าเสร็จสิ้น'}
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-zinc-700 mx-2" />
                            {(photoRequests[album.id]?.length ?? 0) > 0 ? (
                              <button
                                className="w-full px-3.5 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 dark:text-orange-400 transition-colors"
                                onClick={e => { e.stopPropagation(); handleCancelRequest(album.id) }}
                              >
                                <XCircle size={14} /> ยกเลิกคำขอถ่ายรูป
                              </button>
                            ) : (
                              <button
                                className="w-full px-3.5 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 dark:text-orange-400 transition-colors"
                                onClick={e => { e.stopPropagation(); setShowRequestModal(album.id); setActiveMenu(null) }}
                              >
                                <Camera size={14} /> ขอถ่ายรูปใหม่
                              </button>
                            )}
                            <div className="h-px bg-slate-100 dark:bg-zinc-700 mx-2" />
                            <button
                              className="w-full px-3.5 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition-colors"
                              onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: album.id, title: album.title }); setActiveMenu(null) }}
                            >
                              <Trash2 size={14} /> ลบอัลบั้ม
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">฿</span>
                    <input
                      type="number" placeholder="ระบุราคา"
                      className="w-full pl-7 pr-12 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      value={album.price ?? ''}
                      onChange={e => { const val = e.target.value; setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, price: val } : a)) }}
                      onBlur={e => handleUpdateField(album, { price: e.target.value as any })}
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 dark:text-zinc-600 pointer-events-none">บาท</span>
                  </div>

                  {/* Description */}
                  <textarea
                    placeholder="คำอธิบายอัลบั้ม..." value={album.description ?? ''}
                    onChange={e => { const val = e.target.value; setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, description: val } : a)) }}
                    onBlur={e => handleUpdateField(album, { description: e.target.value })}
                    onClick={e => e.stopPropagation()}
                    rows={2}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-300 dark:placeholder:text-zinc-600 resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_CONFIG.map(tag => {
                      const checked = (album as any)[tag.key]
                      return (
                        <label
                          key={tag.key} onClick={e => e.stopPropagation()}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer border select-none transition-all ${checked ? tag.on : tag.off}`}
                        >
                          <input type="checkbox" className="hidden" checked={checked}
                            onChange={e => handleUpdateField(album, { [tag.key]: e.target.checked })} />
                          {checked && <Check size={10} strokeWidth={3} />}
                          {tag.label}
                        </label>
                      )
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-zinc-800 mt-auto">
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">{album.photoCount} รูปภาพ</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(album.id, album.title) }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Download size={12} /> ดาวน์โหลด
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-5">
          <form
            onSubmit={handleCreateAlbum}
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-zinc-100">สร้างอัลบั้มใหม่</h2>
              <button type="button" onClick={() => setShowCreateForm(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">ชื่ออัลบั้ม</label>
                <input
                  required type="text" placeholder="ชื่ออัลบั้ม" value={albumTitle}
                  onChange={e => setAlbumTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">ราคา (บาท)</label>
                  <input
                    type="number" placeholder="0.00" value={formData.price}
                    onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">สถานะ</label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isDone: !prev.isDone }))}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      formData.isDone
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'bg-amber-50 border-amber-200 text-amber-600'
                    }`}
                  >
                    {formData.isDone ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
                    {formData.isDone ? 'เสร็จสิ้น' : 'กำลังทำ'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">คำอธิบาย</label>
                <textarea
                  placeholder="รายละเอียดเพิ่มเติม..." value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-zinc-100 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">แท็กสินค้า</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_CONFIG.map(tag => {
                    const checked = (formData as any)[tag.key]
                    return (
                      <button
                        key={tag.key} type="button"
                        onClick={() => setFormData(prev => ({ ...prev, [tag.key]: !checked }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${checked ? tag.on : tag.off}`}
                      >
                        {checked && <Check size={12} strokeWidth={3} />}
                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">รูปภาพ ({selectedFiles.length})</label>
                <div className="grid grid-cols-4 gap-2">
                  {selectedFiles.map((f, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={f.preview} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 dark:border-zinc-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex flex-col items-center justify-center cursor-pointer transition-all">
                    <Upload size={20} className="text-slate-400 mb-1" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">เพิ่มรูป</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex gap-3">
              <button type="button" onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-sm font-medium rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={!albumTitle.trim() || selectedFiles.length === 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-zinc-800 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20">
                สร้างอัลบั้ม
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1001] flex items-center justify-center p-5">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-zinc-700 p-6">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2">ยืนยันการลบอัลบั้ม?</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-semibold text-slate-900 dark:text-zinc-200">"{deleteConfirm.title}"</span>? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                ยกเลิก
              </button>
              <button onClick={executeDelete}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl transition-colors">
                ลบออก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Request Modal */}
      {showRequestModal !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1001] flex items-center justify-center p-5">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                  <Camera size={16} className="text-orange-500" />
                </div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-100">ขอถ่ายรูปใหม่</h2>
              </div>
              <button onClick={closeRequestModal} className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">บันทึกเพิ่มเติม</label>
                <textarea
                  value={requestNote}
                  onChange={e => setRequestNote(e.target.value)}
                  placeholder="อธิบายรูปที่ต้องการ..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all dark:text-zinc-100 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">แนบรูปตัวอย่าง (ไม่บังคับ)</label>
                {requestSamplePreview ? (
                  <div className="relative">
                    <img src={requestSamplePreview} className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-zinc-700" alt="ตัวอย่าง" />
                    <button
                      onClick={() => { URL.revokeObjectURL(requestSamplePreview!); setRequestSampleFile(null); setRequestSamplePreview(null) }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-rose-500 text-white rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all">
                    <Upload size={20} className="text-slate-300 mb-1" />
                    <span className="text-xs text-slate-400">คลิกเพื่อแนบรูปตัวอย่าง</span>
                    <input type="file" accept="image/*" hidden onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) { setRequestSampleFile(file); setRequestSamplePreview(URL.createObjectURL(file)) }
                    }} />
                  </label>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 flex gap-3">
              <button onClick={closeRequestModal}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-sm font-medium rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleRequestSubmit} disabled={requestSubmitting}
                className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 dark:disabled:bg-orange-800 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-orange-500/20">
                {requestSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download progress overlay */}
      {dlProgress.active && <DownloadProgressOverlay dl={dlProgress} />}
    </div>
  )
}

// ── AlbumDetail ───────────────────────────────────────────────────────────────

function AlbumDetail({ albumId, onBack }: { albumId: number; onBack: () => void }) {
  const [album,             setAlbum]             = useState<AlbumWithPhotos | null>(null)
  const [uploading,         setUploading]         = useState(false)
  const [isSelectMode,      setIsSelectMode]       = useState(false)
  const [selectedIds,       setSelectedIds]        = useState<number[]>([])
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [zoomLevel,         setZoomLevel]          = useState(1)
  const [position,          setPosition]           = useState({ x: 0, y: 0 })
  const [isDragging,        setIsDragging]         = useState(false)
  const [arrowAnchor,       setArrowAnchor]        = useState<{ leftX: number; rightX: number; midY: number } | null>(null)
  const [showUploadPanel,   setShowUploadPanel]    = useState(false)
  const [pendingFiles,      setPendingFiles]       = useState<File[]>([])
  const [previews,          setPreviews]           = useState<string[]>([])
  const [uploadSuccess,     setUploadSuccess]      = useState(false)
  const [dlProgress,        setDlProgress]         = useState<DlProgress>(DL_IDLE)

  const dragStart       = useRef({ x: 0, y: 0 })
  const touchStartX     = useRef(0)
  const imageWrapperRef = useRef<HTMLDivElement>(null)
  const fileInputRef    = useRef<HTMLInputElement>(null)

  const loadAlbum = useCallback(async () => {
    try {
      const data = await albumApi.getAlbum(albumId)
      setAlbum(data)
    } catch {}
  }, [albumId])

  useEffect(() => { loadAlbum() }, [loadAlbum])

  // STOMP: real-time photo events
  useEffect(() => {
    return warehouseStompClient.subscribe(`/topic/albums/${albumId}/photos`, (msg) => {
      try {
        const { type, payload } = JSON.parse(msg.body)
        if (type === 'PHOTO_ADDED') {
          setAlbum(prev => {
            if (!prev) return prev
            const exists = prev.photos?.some(p => p.id === payload.id)
            if (exists) return prev
            return { ...prev, photos: [...(prev.photos ?? []), payload], photoCount: (prev.photoCount ?? 0) + 1 }
          })
        }
        if (type === 'PHOTO_DELETED') {
          setAlbum(prev => {
            if (!prev) return prev
            const photos = (prev.photos ?? []).filter(p => p.id !== payload.id)
            return { ...prev, photos, photoCount: photos.length }
          })
        }
      } catch {}
    })
  }, [albumId])

  // Arrow anchor re-measure
  useLayoutEffect(() => {
    if (selectedPhotoIndex === null || !imageWrapperRef.current) { setArrowAnchor(null); return }
    const measure = () => {
      const rect = imageWrapperRef.current?.getBoundingClientRect()
      if (rect && rect.width > 0) setArrowAnchor({ leftX: rect.left, rightX: rect.right, midY: rect.top + rect.height / 2 })
    }
    measure()
    const t = setTimeout(measure, 120)
    return () => clearTimeout(t)
  }, [selectedPhotoIndex, zoomLevel, position])

  const photos = album?.photos ?? []

  const openLightbox  = useCallback((index: number) => { setSelectedPhotoIndex(index); setZoomLevel(1); setPosition({ x: 0, y: 0 }) }, [])
  const closeLightbox = useCallback(() => { setSelectedPhotoIndex(null); setZoomLevel(1); setPosition({ x: 0, y: 0 }) }, [])
  const handlePrev    = useCallback((e?: React.MouseEvent) => { e?.stopPropagation(); setSelectedPhotoIndex(prev => prev === null ? null : (prev - 1 + photos.length) % photos.length) }, [photos.length])
  const handleNext    = useCallback((e?: React.MouseEvent) => { e?.stopPropagation(); setSelectedPhotoIndex(prev => prev === null ? null : (prev + 1) % photos.length) }, [photos.length])

  useEffect(() => {
    if (selectedPhotoIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedPhotoIndex, handlePrev, handleNext, closeLightbox])

  const handlePhotoClick = (photo: Photo) => {
    if (isSelectMode) {
      setSelectedIds(prev => prev.includes(photo.id) ? prev.filter(i => i !== photo.id) : [...prev, photo.id])
    } else {
      openLightbox(photos.findIndex(p => p.id === photo.id))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files])
      setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
      setShowUploadPanel(true)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (i: number) => {
    URL.revokeObjectURL(previews[i])
    setPendingFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
    if (pendingFiles.length <= 1) setShowUploadPanel(false)
  }

  const closeUploadPanel = () => {
    previews.forEach(url => URL.revokeObjectURL(url))
    setPendingFiles([]); setPreviews([]); setShowUploadPanel(false)
  }

  const handleUpload = async () => {
    if (!albumId || pendingFiles.length === 0) return
    setUploading(true)
    try {
      for (const file of pendingFiles) await albumApi.uploadPhoto(albumId, file)
      setUploading(false)
      setUploadSuccess(true)
      setTimeout(() => {
        setUploadSuccess(false)
        closeUploadPanel()
      }, 1000)
    } catch {
      setUploading(false)
    }
  }

  const toggleSelectAll = () => {
    if (!album?.photos) return
    setSelectedIds(selectedIds.length === album.photos.length ? [] : album.photos.map(p => p.id))
  }

  const handleBulkDelete = async () => {
    try {
      for (const id of selectedIds) await albumApi.deletePhoto(id)
      setSelectedIds([]); setIsSelectMode(false)
    } catch {}
  }

  const handleDownloadOne = async (e: React.MouseEvent | null, url: string, photoId: number, mimeType?: string) => {
    if (e) e.stopPropagation()
    await downloadSinglePhoto(url, photoId, mimeType)
  }

  const handleDownloadAll = async () => {
    if (!albumId || !album?.photos?.length) return
    await downloadAlbumZip(albumId, album.title, setDlProgress)
  }

  const handleBulkDownloadZip = async () => {
    if (!album?.photos || selectedIds.length === 0 || !albumId) return
    if (selectedIds.length === album.photos.length) {
      await downloadAlbumZip(albumId, album.title, setDlProgress)
      setIsSelectMode(false); setSelectedIds([])
      return
    }

    const folderName = album.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename   = `${folderName}_images.zip`

    const filePath = await window.electronAPI?.showSaveDialog({
      title: 'บันทึกไฟล์',
      defaultPath: filename,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (!filePath) return

    const photosToDownload = album.photos.filter(p => selectedIds.includes(p.id))
    const zip    = new JSZip()
    const folder = zip.folder(folderName)
    let failed   = 0

    setDlProgress({ active: true, label: filename, loaded: 0, total: photosToDownload.length, speed: 0, eta: 0, mode: 'photos' })
    try {
      for (let i = 0; i < photosToDownload.length; i++) {
        const photo = photosToDownload[i]
        try {
          const blobUrl = await albumApi.fetchProtectedImage(photo.fileUrl)
          if (!blobUrl) { failed++; continue }
          const response = await fetch(blobUrl)
          const blob     = await response.blob()
          const ext      = photo.mimeType?.split('/')[1] || photo.fileUrl.split('.').pop() || 'jpg'
          folder?.file(`photo_${photo.id}.${ext}`, blob)
        } catch { failed++ }
        setDlProgress(prev => ({ ...prev, loaded: i + 1 }))
      }

      const successCount = photosToDownload.length - failed
      if (successCount === 0) { alert('ไม่สามารถดาวน์โหลดรูปภาพได้'); return }

      const content = await zip.generateAsync({ type: 'uint8array' })
      const result  = await window.electronAPI?.writeFile(filePath, content)
      if (result && !result.ok) throw new Error(result.error)

      if (failed > 0) alert(`ดาวน์โหลดสำเร็จ ${successCount} รูป (ไม่สำเร็จ ${failed} รูป)`)
      setIsSelectMode(false); setSelectedIds([])
      setDlProgress({ active: true, label: filename, loaded: 0, total: 0, speed: 0, eta: 0, done: true })
      await new Promise(r => setTimeout(r, 1000))
    } catch { alert('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP') }
    finally { setDlProgress(DL_IDLE) }
  }

  const allSelected = selectedIds.length === (album?.photos?.length ?? 0) && selectedIds.length > 0

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3">
        {isSelectMode ? (
          <>
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm font-medium text-slate-700 dark:text-zinc-200 transition-colors">
                {allSelected ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} className="text-slate-400" />}
                เลือกทั้งหมด
              </button>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full">
                เลือกแล้ว {selectedIds.length} รูป
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleBulkDownloadZip} disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 disabled:opacity-40 text-sm font-medium transition-colors">
                <Download size={15} /> ดาวน์โหลด ZIP
              </button>
              <button onClick={handleBulkDelete} disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 disabled:opacity-40 text-sm font-medium transition-colors">
                <Trash2 size={15} /> ลบที่เลือก
              </button>
              <button onClick={() => { setIsSelectMode(false); setSelectedIds([]) }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors">
                <X size={18} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={onBack}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors flex-shrink-0">
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold text-slate-800 dark:text-zinc-100 leading-tight truncate">{album?.title}</h1>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">{album?.photos?.length ?? 0} รูปภาพ</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={handleDownloadAll} disabled={!album?.photos?.length}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 disabled:opacity-40 text-sm font-medium transition-colors">
                <Download size={15} /> ดาวน์โหลดทั้งหมด
              </button>
              <button onClick={() => setIsSelectMode(true)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                เลือก
              </button>
            </div>
          </>
        )}
      </div>

      {/* Photo Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {photos.map(photo => {
            const isSelected = selectedIds.includes(photo.id)
            return (
              <div
                key={photo.id} onClick={() => handlePhotoClick(photo)}
                className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 aspect-square ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                    : 'border-transparent hover:border-slate-200 dark:hover:border-zinc-700'
                }`}
              >
                <ProtectedImage url={photo.fileUrl} alt="" className="w-full h-full object-cover" />
                {isSelectMode && (
                  <div className="absolute top-2 left-2">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm transition-colors ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/60 border-white'
                    }`}>
                      {isSelected && <CheckCircle2 size={13} className="text-white" />}
                    </div>
                  </div>
                )}
                {!isSelectMode && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => handleDownloadOne(e, photo.fileUrl, photo.id, photo.mimeType)}
                        className="w-7 h-7 bg-black/50 hover:bg-blue-500 text-white rounded-full backdrop-blur-sm flex items-center justify-center transition-colors">
                        <Download size={12} />
                      </button>
                      <button
                        onClick={async e => { e.stopPropagation(); await albumApi.deletePhoto(photo.id); loadAlbum() }}
                        className="w-7 h-7 bg-black/50 hover:bg-rose-500 text-white rounded-full backdrop-blur-sm flex items-center justify-center transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upload FAB */}
      {!isSelectMode && (
        <button
          className="fixed bottom-6 right-6 w-[52px] h-[52px] bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-300 dark:shadow-blue-900 flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-20"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={24} />
          <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileSelect} accept="image/*" />
        </button>
      )}

      {/* Lightbox */}
      {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && createPortal((() => {
        const current = photos[selectedPhotoIndex]
        return (
          <div
            className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center overflow-hidden"
            onWheel={e => { const delta = e.deltaY > 0 ? -0.1 : 0.1; setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.5), 5)) }}
            onClick={closeLightbox}
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              const diff = touchStartX.current - e.changedTouches[0].clientX
              if (Math.abs(diff) > 50) diff > 0 ? handleNext() : handlePrev()
            }}
          >
            <button onClick={closeLightbox}
              className="absolute top-4 right-4 z-[110] w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-rose-500 text-white rounded-full backdrop-blur-sm transition-all active:scale-90 shadow-lg">
              <X size={20} />
            </button>
            {photos.length > 1 && arrowAnchor && (
              <button onClick={e => { e.stopPropagation(); handlePrev() }}
                style={{ position: 'fixed', left: Math.max(8, arrowAnchor.leftX - 52), top: arrowAnchor.midY - 20, zIndex: 310 }}
                className="w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-colors active:scale-90 shadow-lg">
                <ChevronLeft size={22} />
              </button>
            )}
            {photos.length > 1 && arrowAnchor && (
              <button onClick={e => { e.stopPropagation(); handleNext() }}
                style={{ position: 'fixed', left: Math.min(window.innerWidth - 48, arrowAnchor.rightX + 12), top: arrowAnchor.midY - 20, zIndex: 310 }}
                className="w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-colors active:scale-90 shadow-lg">
                <ChevronRight size={22} />
              </button>
            )}
            <div
              className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-2 rounded-2xl"
              onClick={e => e.stopPropagation()}
            >
              {[
                { icon: <ZoomIn size={16} />,   action: () => setZoomLevel(p => Math.min(p + 0.5, 4)),     title: 'ซูมเข้า' },
                { icon: <ZoomOut size={16} />,  action: () => setZoomLevel(p => Math.max(p - 0.5, 0.5)),   title: 'ซูมออก' },
                { icon: <Maximize size={16} />, action: () => { setZoomLevel(1); setPosition({ x: 0, y: 0 }) }, title: 'รีเซ็ต' },
                { icon: <Download size={16} />, action: (e: any) => handleDownloadOne(e, current.fileUrl, current.id, current.mimeType), title: 'ดาวน์โหลด' },
              ].map((btn, i) => (
                <button key={i} onClick={btn.action} title={btn.title}
                  className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/25 text-white rounded-xl transition-all active:scale-90">
                  {btn.icon}
                </button>
              ))}
              <div className="w-px h-5 bg-white/20 mx-0.5" />
              <span className="text-[11px] text-white/60 font-mono px-1 select-none">{selectedPhotoIndex + 1} / {photos.length}</span>
              <span className="text-[11px] text-white/40 font-mono px-1 select-none">{Math.round(zoomLevel * 100)}%</span>
            </div>
            <div
              ref={imageWrapperRef}
              className={`flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'transition-transform duration-200 ease-out cursor-grab'}`}
              style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})` }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => { e.preventDefault(); setIsDragging(true); dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y } }}
              onMouseMove={e => { if (!isDragging) return; setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }) }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              <ProtectedImage
                key={current.fileUrl} url={current.fileUrl} alt="ขยายรูป"
                className="max-w-[80vw] max-h-[80vh] object-contain shadow-2xl rounded-lg select-none pointer-events-none"
              />
            </div>
          </div>
        )
      })(), document.body)}

      {/* Download progress overlay */}
      {dlProgress.active && <DownloadProgressOverlay dl={dlProgress} />}

      {/* Upload Panel */}
      {showUploadPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">อัปโหลดรูปภาพ</h3>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{pendingFiles.length} รูปที่เลือก</p>
              </div>
              <button onClick={closeUploadPanel} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {previews.map((url, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                    <p className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[10px] text-white font-medium truncate translate-y-full group-hover:translate-y-0 transition-transform bg-gradient-to-t from-black/60 to-transparent">
                      {pendingFiles[i]?.name}
                    </p>
                    <button onClick={() => removePendingFile(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-rose-500 text-white rounded-full flex items-center justify-center transition-colors">
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all group">
                  <Plus size={18} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-400 transition-colors">เพิ่ม</span>
                  <input type="file" multiple accept="image/*" onChange={handleFileSelect} hidden />
                </label>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
              {uploadSuccess ? (
                <div className="w-full py-3 bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> อัปโหลดสำเร็จ!
                </div>
              ) : (
                <button onClick={handleUpload} disabled={uploading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                  {uploading
                    ? <><Loader2 size={16} className="animate-spin" /> กำลังอัปโหลด...</>
                    : `อัปโหลด ${pendingFiles.length} รูปภาพ`
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Albums (screen entry point) ───────────────────────────────────────────────

export default function Albums() {
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null)

  if (selectedAlbumId !== null) {
    return <AlbumDetail albumId={selectedAlbumId} onBack={() => setSelectedAlbumId(null)} />
  }
  return <AlbumGallery onSelectAlbum={setSelectedAlbumId} />
}
