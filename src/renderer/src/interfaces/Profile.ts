export interface Profile {
  id: string
  name: string
  country: string
  proxy: string
  timezone: string
  locale: string
  avatar?: string
  userAgent?: string
  notes?: string
  lastUsed?: string
}
