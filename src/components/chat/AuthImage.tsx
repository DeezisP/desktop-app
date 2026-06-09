import { memo } from 'react'

interface Props {
  src: string
  alt?: string
  className?: string
}

// Chat uploads are served by nginx at the root domain — no auth header needed.
// fileUrl from the API is like "/chat/uploads/uuid.jpg"; prepend the domain.
const MEDIA_ORIGIN = 'https://www.perfectelt.com'

function resolveUrl(src: string): string {
  if (!src) return ''
  if (src.startsWith('http') || src.startsWith('blob:')) return src
  return `${MEDIA_ORIGIN}${src}`
}

export const AuthImage = memo(function AuthImage({ src, alt = '', className }: Props) {
  const url = resolveUrl(src)
  if (!url) return null
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={(e) => {
        const el = e.currentTarget
        el.style.display = 'none'
        const span = document.createElement('span')
        span.className = 'text-xs italic text-zinc-400 px-3 py-1'
        span.textContent = 'ไม่สามารถโหลดรูปภาพ'
        el.parentElement?.appendChild(span)
      }}
    />
  )
})
