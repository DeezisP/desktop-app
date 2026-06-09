import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'

interface Props {
  src: string
  alt?: string
  className?: string
}

export function AuthImage({ src, alt = '', className }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) return
    let objectUrl: string | null = null
    setError(false)
    setBlobUrl(null)

    apiClient
      .get<Blob>(src, { responseType: 'blob' })
      .then((r) => {
        objectUrl = URL.createObjectURL(r.data)
        setBlobUrl(objectUrl)
      })
      .catch(() => setError(true))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (error) {
    return (
      <span className="text-xs italic text-zinc-400 dark:text-zinc-500">
        ไม่สามารถโหลดรูปภาพ
      </span>
    )
  }

  if (!blobUrl) {
    return (
      <div className="w-40 h-24 rounded-xl bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
    )
  }

  return <img src={blobUrl} alt={alt} className={className} />
}
