const BASE = import.meta.env.VITE_API_BASE ?? 'https://www.perfectelt.com'

export interface PhotoRequest {
  id: string
  albumId: number
  note: string
  sampleImageUrl: string | null
  createdAt: string
}

function withFullUrl(req: PhotoRequest): PhotoRequest {
  return {
    ...req,
    sampleImageUrl: req.sampleImageUrl ? `${BASE}${req.sampleImageUrl}` : null,
  }
}

export const photoRequestApi = {
  getAll: async (): Promise<PhotoRequest[]> => {
    const res = await fetch(`${BASE}/api/photo-requests`)
    const data: PhotoRequest[] = await res.json()
    return data.map(withFullUrl)
  },

  create: async (albumId: number, note: string, sampleImage?: File): Promise<PhotoRequest> => {
    const fd = new FormData()
    fd.append('albumId', String(albumId))
    if (note) fd.append('note', note)
    if (sampleImage) fd.append('sampleImage', sampleImage)
    const res = await fetch(`${BASE}/api/photo-requests`, { method: 'POST', body: fd })
    const data: PhotoRequest = await res.json()
    return withFullUrl(data)
  },

  deleteRequest: async (requestId: string): Promise<void> => {
    await fetch(`${BASE}/api/photo-requests/${requestId}`, { method: 'DELETE' })
  },
}
