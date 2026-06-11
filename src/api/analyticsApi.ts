import { apiClient } from './client'

export type DateRange = 1 | 7 | 30 | 90 | 365

export const analyticsApi = {
  getOverview: (days: DateRange) =>
    apiClient.get('/api/analytics/overview', { params: { days } }).then(r => r.data),

  getTrend: (days: DateRange) =>
    apiClient.get('/api/analytics/trend', { params: { days } }).then(r => r.data),

  getTrafficSources: (days: DateRange) =>
    apiClient.get('/api/analytics/traffic-sources', { params: { days } }).then(r => r.data),

  getTopPages: (days: DateRange, limit = 20) =>
    apiClient.get('/api/analytics/top-pages', { params: { days, limit } }).then(r => r.data),

  getLandingPages: (days: DateRange, limit = 10) =>
    apiClient.get('/api/analytics/landing-pages', { params: { days, limit } }).then(r => r.data),

  getExitPages: (days: DateRange, limit = 10) =>
    apiClient.get('/api/analytics/exit-pages', { params: { days, limit } }).then(r => r.data),

  getDevices: (days: DateRange) =>
    apiClient.get('/api/analytics/devices', { params: { days } }).then(r => r.data),

  getGeo: (days: DateRange) =>
    apiClient.get('/api/analytics/geo', { params: { days } }).then(r => r.data),

  getRealtime: () =>
    apiClient.get('/api/analytics/realtime').then(r => r.data),

  getSearch: (days: DateRange) =>
    apiClient.get('/api/analytics/search', { params: { days } }).then(r => r.data),

  getHealthScores: () =>
    apiClient.get('/api/analytics/health-scores').then(r => r.data),

  getHealthScoreHistory: (type: string) =>
    apiClient.get(`/api/analytics/health-scores/${type}/history`).then(r => r.data),

  computeHealthScores: () =>
    apiClient.post('/api/analytics/health-scores/compute').then(r => r.data),

  getInsights: () =>
    apiClient.get('/api/analytics/insights').then(r => r.data),

  generateInsights: () =>
    apiClient.post('/api/analytics/insights/generate').then(r => r.data),
}
