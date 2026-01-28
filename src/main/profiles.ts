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

// Mutex simples para evitar condições de corrida ao acessar o arquivo JSON
class Mutex {
  private queue: Promise<void> = Promise.resolve()
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn)
    this.queue = next.then(() => {}).catch(() => {})
    return next
  }
}

const fileMutex = new Mutex()

// Cache do caminho para evitar flutuações durante a execução
let cachedPath: string | null = null

const getPath = (): string => {
  if (cachedPath) return cachedPath

  // 1. Modo Desenvolvimento
  if (!app.isPackaged) {
    cachedPath = path.join(process.cwd(), 'data', 'profiles.json')
    return cachedPath
  }

  const appDir = path.dirname(app.getPath('exe'))
  const resDir = process.resourcesPath

  // 2. Busca em locais portáteis ou customizados (Root ou Resources)
  const searchPaths = [
    path.join(appDir, 'profiles.json'),
    path.join(appDir, 'data', 'profiles.json'),
    path.join(resDir, 'profiles.json'), // Caso o usuário coloque em resources
    path.join(resDir, 'data', 'profiles.json')
  ]

  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      cachedPath = p
      return cachedPath
    }
  }

  // Fallback: Se existir pasta 'data' ou 'browser_data' (Intenção de Portátil)
  if (
    fs.existsSync(path.join(appDir, 'data')) ||
    fs.existsSync(path.join(appDir, 'browser_data'))
  ) {
    cachedPath = path.join(appDir, 'data', 'profiles.json')
    return cachedPath
  }

  if (
    fs.existsSync(path.join(resDir, 'data')) ||
    fs.existsSync(path.join(resDir, 'browser_data'))
  ) {
    cachedPath = path.join(resDir, 'data', 'profiles.json')
    return cachedPath
  }

  // 3. Modo Instalado Padrão
  cachedPath = path.join(app.getPath('userData'), 'profiles.json')
  return cachedPath
}

export class ProfileManager {
  static getPath(): string {
    return getPath()
  }

  /**
   * Salva os perfis de forma atômica para evitar corrupção em caso de queda de energia ou crash.
   */
  private static async saveAtomic(filePath: string, profiles: Profile[]): Promise<void> {
    const tempPath = `${filePath}.tmp_${randomUUID()}`
    try {
      await fs.ensureDir(path.dirname(filePath))
      await fs.writeJson(tempPath, profiles, { spaces: 2 })
      await fs.move(tempPath, filePath, { overwrite: true })
    } catch (err) {
      // Tenta limpar o arquivo temporário em caso de erro
      if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath).catch(() => {})
      }
      throw err
    }
  }

  static async getAll(): Promise<Profile[]> {
    return fileMutex.run(async () => {
      const filePath = getPath()

      // INICIALIZAÇÃO NO PRIMEIRO USO (Apenas se o arquivo não existir)
      if (!fs.existsSync(filePath)) {
        try {
          if (app.isPackaged) {
            const seedPath = path.join(process.resourcesPath, 'data', 'profiles.json')
            if (fs.existsSync(seedPath)) {
              console.log(`[Profiles] Initializing from seed: ${seedPath}`)
              await fs.copy(seedPath, filePath)
            } else {
              console.log('[Profiles] No seed found, creating empty file.')
              await this.saveAtomic(filePath, [])
            }
          } else {
            // Em dev, cria se não existir
            await this.saveAtomic(filePath, [])
          }
        } catch (err) {
          console.error('[Profiles] Failed to initialize profiles file:', err)
          // Se falhou ao inicializar, não retornamos nada para evitar sobrescrever depois
          throw err
        }
      }

      try {
        const data = await fs.readJson(filePath)
        if (!Array.isArray(data)) {
          console.error('[Profiles] Profile file is not an array!')
          return []
        }
        return data
      } catch (error) {
        console.error(`[Profiles] Error reading profiles from ${filePath}:`, error)
        // CRÍTICO: Se houver erro de leitura (ex: JSON corrompido), NÃO retornamos array vazio,
        // pois isso faria o sistema pensar que não existem perfis e potencialmente sobrescrever o arquivo original.
        throw error
      }
    })
  }

  static async getById(id: string): Promise<Profile | undefined> {
    const profiles = await this.getAll()
    return profiles.find((p) => p.id === id)
  }

  static async create(data: Omit<Profile, 'id'>): Promise<Profile> {
    // Usamos o mutex indiretamente via getAll e depois no salvamento
    // Mas para garantir atomicidade total da operação, enrolamos tudo no mutex
    return fileMutex.run(async () => {
      const filePath = getPath()
      let profiles: Profile[] = []

      try {
        if (fs.existsSync(filePath)) {
          profiles = await fs.readJson(filePath)
          if (!Array.isArray(profiles)) profiles = []
        }
      } catch (e) {
        console.error('[Profiles] Failed to read during create, aborting to prevent data loss')
        throw e
      }

      const newProfile: Profile = {
        id: randomUUID(),
        ...data
      }
      profiles.push(newProfile)
      await this.saveAtomic(filePath, profiles)
      return newProfile
    })
  }

  static async update(id: string, data: Partial<Profile>): Promise<Profile> {
    return fileMutex.run(async () => {
      const filePath = getPath()
      let profiles: Profile[] = []

      try {
        profiles = await fs.readJson(filePath)
        if (!Array.isArray(profiles)) throw new Error('Data is not an array')
      } catch (e) {
        console.error('[Profiles] Failed to read during update, aborting')
        throw e
      }

      const index = profiles.findIndex((p) => p.id === id)
      if (index === -1) throw new Error(`Profile ${id} not found`)

      profiles[index] = { ...profiles[index], ...data }
      await this.saveAtomic(filePath, profiles)
      return profiles[index]
    })
  }

  static async delete(id: string): Promise<void> {
    return fileMutex.run(async () => {
      const filePath = getPath()
      let profiles: Profile[] = []

      try {
        profiles = await fs.readJson(filePath)
        if (!Array.isArray(profiles)) throw new Error('Data is not an array')
      } catch (e) {
        console.error('[Profiles] Failed to read during delete, aborting')
        throw e
      }

      const filtered = profiles.filter((p) => p.id !== id)
      await this.saveAtomic(filePath, filtered)

      // Cleanup browser data (Async, doesn't need to block the mutex for too long)
      let baseDataDir = ''
      if (app.isPackaged) {
        const appDir = path.dirname(app.getPath('exe'))
        const resDir = process.resourcesPath

        // Checa Root e Resources
        const rootData = path.join(appDir, 'browser_data')
        const resData = path.join(resDir, 'browser_data')

        if (fs.existsSync(rootData)) {
          baseDataDir = rootData
        } else if (fs.existsSync(resData)) {
          baseDataDir = resData
        } else {
          baseDataDir = path.join(app.getPath('userData'), 'browser_data')
        }
      } else {
        baseDataDir = path.join(process.cwd(), 'browser_data')
      }

      const userDataDir = path.join(baseDataDir, id)
      fs.remove(userDataDir).catch((err) => {
        console.error('[Profiles] Failed to clear browser data:', err)
      })
    })
  }
}
