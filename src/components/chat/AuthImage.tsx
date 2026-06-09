import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'

interface Props {
  src: string
  alt?: string
  className?: string
}

type FetchResult = { base64: string; contentType: string } | null

// Electron API shape — only the subset we need here
type ElectronAPI = { fetchChatImage?: (url: string) => Promise<FetchResult> }

function getElectronAPI(): ElectronAPI | null {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI ?? null
}

export function AuthImage({ src, alt = '', className }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) return
    setError(false)
    setDataUrl(null)

    const api = getElectronAPI()

    if (api?.fetchChatImage) {
      // Electron: main-process net.fetch preserves Authorization across www redirects
      api
        .fetchChatImage(src)
        .then((result) => {
          if (result) {
            setDataUrl(`data:${result.contentType};base64,${result.base64}`)
          } else {
            setError(true)
          }
        })
        .catch(() => setError(true))
      return
    }

    // Browser fallback: apiClient (adds Bearer token via interceptor)
    let objectUrl: string | null = null
    apiClient
      .get<Blob>(src, { responseType: 'blob' })
      .then((r) => {
        objectUrl = URL.createObjectURL(r.data)
        setDataUrl(objectUrl)
      })
      .catch(() => setError(true))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (error) {
    return (
      <span className="text-xs italic text-zinc-400 dark:text-zinc-500 px-3 py-1">
        ไม่สามารถโหลดรูปภาพ
      </span>
    )
  }

  if (!dataUrl) {
    return <div className="w-40 h-24 rounded-xl bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
  }

  return <img src={dataUrl} alt={alt} className={className} />
}
