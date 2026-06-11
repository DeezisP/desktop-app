import { apiClient } from './client'

const BASE = '/keeps/albums'

export interface Album {
  id: number
  title: string
  description?: string
  price?: number | string
  isReadyToShip: boolean
  isPreOrder: boolean
  isAuthentic: boolean
  isExpressDelivery: boolean
  isDone: boolean
  photoCount: number
  createdAt: string
  updatedAt: string
  photos?: Photo[]
}

export interface Photo {
  id: number
  fileName: string
  originalFileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  width: number
  height: number
  description?: string
  displayOrder: number
  uploadedAt: string
  updatedAt: string
}

export interface AlbumWithPhotos extends Album {
  photos: Photo[]
}

export interface AlbumParams {
  title: string
  description?: string
  price?: number
  isReadyToShip?: boolean
  isPreOrder?: boolean
  isAuthentic?: boolean
  isExpressDelivery?: boolean
  isDone?: boolean
}

export const albumApi = {
  getAlbums: () =>
    apiClient.get<Album[]>(BASE).then((r) => r.data),

  getAlbum: (id: number) =>
    apiClient.get<AlbumWithPhotos>(`${BASE}/${id}`).then((r) => r.data),

  getAlbumPhotos: (id: number) =>
    apiClient.get<Photo[]>(`${BASE}/${id}/photos`).then((r) => r.data),

  createAlbum: (params: AlbumParams) =>
    apiClient.post<Album>(BASE, params).then((r) => r.data),

  updateAlbum: (id: number, params: AlbumParams) =>
    apiClient.put<Album>(`${BASE}/${id}`, params).then((r) => r.data),

  deleteAlbum: (id: number) =>
    apiClient.delete(`${BASE}/${id}`),

  uploadPhoto: (albumId: number, file: File, description?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (description) fd.append('description', description)
    return apiClient
      .post<Photo>(`${BASE}/${albumId}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      })
      .then((r) => r.data)
  },

  deletePhoto: (photoId: number) =>
    apiClient.delete(`${BASE}/photos/${photoId}`),

  fetchProtectedImage: async (imageUrl: string): Promise<string> => {
    try {
      const res = await apiClient.get(imageUrl, { responseType: 'blob' })
      return URL.createObjectURL(res.data as Blob)
    } catch {
      return ''
    }
  },

  downloadAlbumBlob: async (albumId: number): Promise<Blob> => {
    const res = await apiClient.get<Blob>(`${BASE}/${albumId}/download`, {
      responseType: 'blob',
      timeout: 120_000,
    })
    return res.data
  },
}
