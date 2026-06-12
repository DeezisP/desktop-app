import { apiClient } from './client'

export interface OverviewStats {
  pageViews: number
  sessions: number
  uniqueVisitors: number
  returningVisitors: number
  newVisitors: number
  bounceRate: number
  avgSessionDuration: number
  pageViewsChange: number
  visitorsChange: number
  period: number
}

export interface TimeSeriesPoint {
  date: string
  value: number
}

export interface TopItem {
  label: string
  count: number
  percentage: number
}

export interface DeviceStats {
  devices: TopItem[]
  browsers: TopItem[]
  os: TopItem[]
}

export interface RevenueStats {
  revenue: number
  prevRevenue: number
  revenueChange: number
  orderCount: number
  avgOrderValue: number
  timeSeries: TimeSeriesPoint[]
  period: number
}

export interface SystemHealth {
  status: string
  uptimeMs: number
  memory: {
    usedMB: number
    totalMB: number
    maxMB: number
    usedPct: number
  }
  timestamp: number
}

export interface RealtimeStats {
  activeVisitors: number
  timestamp: number
}

export const analyticsApi = {
  async getOverview(days = 30): Promise<OverviewStats> {
    const { data } = await apiClient.get<OverviewStats>('/analytics/overview', { params: { days } })
    return data
  },

  async getTimeSeries(metric: 'pageviews' | 'sessions' | 'visitors', days = 30): Promise<TimeSeriesPoint[]> {
    const { data } = await apiClient.get<TimeSeriesPoint[]>('/analytics/timeseries', { params: { metric, days } })
    return data
  },

  async getSources(days = 30): Promise<TopItem[]> {
    const { data } = await apiClient.get<TopItem[]>('/analytics/sources', { params: { days } })
    return data
  },

  async getDevices(days = 30): Promise<DeviceStats> {
    const { data } = await apiClient.get<DeviceStats>('/analytics/devices', { params: { days } })
    return data
  },

  async getGeography(days = 30): Promise<TopItem[]> {
    const { data } = await apiClient.get<TopItem[]>('/analytics/geography', { params: { days } })
    return data
  },

  async getTopPages(days = 30): Promise<TopItem[]> {
    const { data } = await apiClient.get<TopItem[]>('/analytics/pages', { params: { days } })
    return data
  },

  async getEvents(days = 30): Promise<TopItem[]> {
    const { data } = await apiClient.get<TopItem[]>('/analytics/events', { params: { days } })
    return data
  },

  async getReferrers(days = 30): Promise<TopItem[]> {
    const { data } = await apiClient.get<TopItem[]>('/analytics/referrers', { params: { days } })
    return data
  },

  async getRevenue(days = 30): Promise<RevenueStats> {
    const { data } = await apiClient.get<RevenueStats>('/analytics/revenue', { params: { days } })
    return data
  },

  async getRealtime(): Promise<RealtimeStats> {
    const { data } = await apiClient.get<RealtimeStats>('/analytics/realtime')
    return data
  },

  async getSystemHealth(): Promise<SystemHealth> {
    const { data } = await apiClient.get<SystemHealth>('/analytics/system/health')
    return data
  },

  async getUsersOverview(): Promise<{ totalUsers: number }> {
    const { data } = await apiClient.get<{ totalUsers: number }>('/analytics/users')
    return data
  },
}
