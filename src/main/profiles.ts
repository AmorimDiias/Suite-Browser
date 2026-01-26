import fs from 'fs-extra'
import path from 'path'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'

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
  totalDataUsage?: number // Bytes
  proxyStatus?: 'online' | 'offline' | 'checking' | 'unknown'
}

// In dev: root/data/profiles.json
// In prod: userData/profiles.json (copied from resources/data/profiles.json on first run)
const getPath = (): string => {
  // 1. Dev Mode
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'data', 'profiles.json')
  }

  const appDir = path.dirname(app.getPath('exe'))

  // 2. Portable Mode - Option A: root/profiles.json
  const rootPortablePath = path.join(appDir, 'profiles.json')
  if (fs.existsSync(rootPortablePath)) {
    return rootPortablePath
  }

  // 3. Portable Mode - Option B: root/data/profiles.json
  const dataPortablePath = path.join(appDir, 'data', 'profiles.json')
  if (fs.existsSync(dataPortablePath)) {
    return dataPortablePath
  }

  // Fallback: If 'data' or 'browser_data' folder exists in root, we SHOULD stay in root (Portable intentions)
  if (
    fs.existsSync(path.join(appDir, 'data')) ||
    fs.existsSync(path.join(appDir, 'browser_data'))
  ) {
    return dataPortablePath // Even if it doesn't exist yet, we'll create it here
  }

  // 4. Standard Installed Mode
  return path.join(app.getPath('userData'), 'profiles.json')
}

export class ProfileManager {
  static getPath(): string {
    return getPath()
  }

  static async getAll(): Promise<Profile[]> {
    const filePath = getPath()

    // FIRST RUN INITIALIZATION (Production only)
    if (app.isPackaged && !fs.existsSync(filePath)) {
      try {
        const seedPath = path.join(process.resourcesPath, 'data', 'profiles.json')
        if (fs.existsSync(seedPath)) {
          console.log(`Initializing profiles from ${seedPath} to ${filePath}`)
          await fs.copy(seedPath, filePath)
        } else {
          console.log('No seed profiles found, creating empty.')
          await fs.writeJson(filePath, [])
        }
      } catch (err) {
        console.error('Failed to initialize profiles:', err)
      }
    }

    if (!fs.existsSync(filePath)) {
      // Create empty if still missing (dev or failed copy)
      await fs.writeJson(filePath, [])
      return []
    }

    try {
      return await fs.readJson(filePath)
    } catch (error) {
      console.error('Failed to read profiles:', error)
      return []
    }
  }

  static async getById(id: string): Promise<Profile | undefined> {
    const profiles = await this.getAll()
    return profiles.find((p) => p.id === id)
  }

  static async create(data: Omit<Profile, 'id'>): Promise<Profile> {
    const profiles = await this.getAll()
    const newProfile: Profile = {
      id: randomUUID(),
      ...data
    }
    profiles.push(newProfile)
    await fs.writeJson(getPath(), profiles, { spaces: 2 })
    return newProfile
  }

  static async update(id: string, data: Partial<Profile>): Promise<Profile> {
    const profiles = await this.getAll()
    const index = profiles.findIndex((p) => p.id === id)
    if (index === -1) throw new Error(`Profile ${id} not found`)

    profiles[index] = { ...profiles[index], ...data }
    await fs.writeJson(getPath(), profiles, { spaces: 2 })
    return profiles[index]
  }

  static async delete(id: string): Promise<void> {
    const profiles = await this.getAll()
    const filtered = profiles.filter((p) => p.id !== id)
    await fs.writeJson(getPath(), filtered, { spaces: 2 })

    // Cleanup browser data
    try {
      const baseDataDir = app.isPackaged
        ? path.join(app.getPath('userData'), 'browser_data')
        : path.join(process.cwd(), 'browser_data')
      const userDataDir = path.join(baseDataDir, id)
      if (await fs.pathExists(userDataDir)) {
        await fs.remove(userDataDir)
      }
    } catch (err) {
      console.error('Failed to clear browser data:', err)
    }
  }
}
