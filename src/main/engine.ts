import { BrowserContext, chromium as playwrightChromium } from 'playwright'
import path from 'path'
import fs from 'fs-extra'
import { ProfileManager } from './profiles'
import { app, BrowserWindow } from 'electron'

// Reference to main window for IPC communication
let mainWindow: BrowserWindow | null = null

// Map to store running browser contexts: profileId -> BrowserContext
const runningContexts = new Map<string, BrowserContext>()

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

const GEOLOCATIONS: Record<string, { latitude: number; longitude: number }> = {
  DE: { latitude: 52.52, longitude: 13.405 }, // Berlin
  FR: { latitude: 48.8566, longitude: 2.3522 }, // Paris
  US: { latitude: 40.7128, longitude: -74.006 }, // New York
  ES: { latitude: 40.4168, longitude: -3.7038 }, // Madrid
  BR: { latitude: -23.5505, longitude: -46.6333 }, // Sao Paulo
  CO: { latitude: 4.711, longitude: -74.0721 }, // Bogota
  GB: { latitude: 51.5074, longitude: -0.1278 }, // London
  CA: { latitude: 45.4215, longitude: -75.6972 } // Ottawa
}

function getGeolocation(countryCode: string): {
  latitude: number
  longitude: number
  accuracy: number
} {
  const coords = GEOLOCATIONS[countryCode] || GEOLOCATIONS['DE']
  return { ...coords, accuracy: 100 }
}

export async function launchProfile(profileId: string): Promise<BrowserContext> {
  // Check if already running
  if (runningContexts.has(profileId)) {
    const existingContext = runningContexts.get(profileId)
    if (existingContext) {
      const pages = existingContext.pages()
      if (pages.length > 0) {
        pages[0].bringToFront().catch(() => {})
      }
      return existingContext
    }
  }

  const profile = await ProfileManager.getById(profileId)

  if (!profile) {
    throw new Error(`Profile ${profileId} not found`)
  }

  // 1. Prepare User Data Dir
  let baseDataDir = ''

  if (app.isPackaged) {
    // Check for portable browser_data next to executable
    const portableDataDir = path.join(path.dirname(app.getPath('exe')), 'browser_data')
    if (fs.existsSync(portableDataDir)) {
      baseDataDir = portableDataDir
      console.log('Using portable browser_data:', baseDataDir)
    } else {
      baseDataDir = path.join(app.getPath('userData'), 'browser_data')
    }
  } else {
    baseDataDir = path.join(process.cwd(), 'browser_data')
  }

  const userDataDir = path.join(baseDataDir, profileId)
  fs.ensureDirSync(userDataDir)

  // 2. Configure Proxy with credentials
  let proxyConfig: { server: string; username?: string; password?: string } | undefined

  if (profile.proxy && profile.proxy.includes('://')) {
    const url = new URL(profile.proxy)
    proxyConfig = {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username || undefined,
      password: url.password || undefined
    }
  }

  console.log(`[Engine] Launching profile ${profile.id} (${profile.name})`)
  console.log(`[Engine] Directory: ${userDataDir}`)
  console.log(`[Engine] Proxy: ${proxyConfig ? 'Configured with auth' : 'None'}`)

  if (proxyConfig) {
    console.log(`[Engine] Proxy Server: ${proxyConfig.server}`)
  }

  try {
    console.log(`[Engine] Attempting playwrightChromium.launchPersistentContext...`)
    const context = await playwrightChromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      proxy: proxyConfig,

      // Timezone, locale, geolocation
      timezoneId: profile.timezone || 'Europe/Berlin',
      locale: profile.locale || 'de-DE',
      permissions: ['geolocation'],
      // Dynamic geolocation based on country
      geolocation: getGeolocation(profile.country),
      colorScheme: 'dark',

      // CORREÇÃO: Lista Seletiva (Não use true) para manter user-data-dir funcionar
      // Ignoramos flags que desabilitam extensões para permitir a Chrome Web Store
      ignoreDefaultArgs: [
        '--enable-automation',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-signin-promo',
        '--disable-features=Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,CalculateNativeWinOcclusion,InterestFeedContentSuggestions,CertificateTransparencyComponentUpdater,AutofillServerCommunication,LogJsConsoleMessages'
      ],

      args: [
        '--enable-extensions',
        '--no-first-run',
        '--start-maximized', // Maximizar janela ao iniciar
        '--disable-infobars',
        '--disable-renderer-backgrounding',
        '--password-store=basic',
        '--use-mock-keychain',
        `--lang=${profile.locale || 'de-DE'}`
      ],
      // STEALTH: User Agent
      // Se não definido, usa o nativo do navegador (Mais seguro para evitar mismatch de versão)
      userAgent: profile.userAgent || undefined,

      // DOWNLOADS: Pasta isolada para cada perfil na pasta de Downloads do usuário
      // Estrutura: Downloads/SuiteBrowser/{profile_id}
      downloadsPath: path.join(
        app.getPath('downloads'),
        'SuiteBrowser',
        profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + profile.id
      ),
      acceptDownloads: true
    })
    console.log(`[Engine] Browser context created successfully.`)

    // STEALTH VIA JS (Recusa robusta de fingerprinting)
    await context.addInitScript(() => {
      // --- UTILS: Native Code Emulation ---
      // Make our overrides look like native functions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const makeNative = (func: (...args: any[]) => any, key: string): void => {
        // @ts-ignore: overwriting native toString
        Object.defineProperty(func, 'toString', {
          value: () => `function ${key}() { [native code] }`,
          configurable: true,
          writable: true
        })
        // @ts-ignore: defining name property
        Object.defineProperty(func, 'name', { value: key, configurable: true })
      }

      // --- 1. WEBDRIVER (The most common tell) ---
      // Remove the property completely from the prototype chain
      try {
        // @ts-ignore: deleting webdriver property
        delete Object.getPrototypeOf(navigator).webdriver
      } catch {
        // ignore
      }

      // Also define it as false on the instance just in case
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true,
        enumerable: true // Native properties are often enumerable
      })

      // --- 2. CHROME OBJECT ---
      // Ensure window.chrome exists and looks real
      // @ts-ignore: polyfilling chrome object
      if (!window.chrome) {
        // @ts-ignore: polyfilling chrome object
        window.chrome = {
          runtime: {},
          app: {
            isInstalled: false,
            InstallState: {
              DISABLED: 'disabled',
              INSTALLED: 'installed',
              NOT_INSTALLED: 'not_installed'
            },
            RunningState: {
              CANNOT_RUN: 'cannot_run',
              READY_TO_RUN: 'ready_to_run',
              RUNNING: 'running'
            }
          },
          csi: () => {},
          loadTimes: () => {}
        }
      }

      // --- 3. PERMISSIONS ---
      // Robustly handle permission queries without leaking 'Illegal invocation'
      if (navigator.permissions && navigator.permissions.query) {
        const originalQuery = navigator.permissions.query
        // @ts-ignore: overwriting permissions query
        navigator.permissions.query = function (parameters: PermissionDescriptor) {
          // Cloudflare/Google often check for 'notifications' permission
          if (parameters && parameters.name === 'notifications') {
            return Promise.resolve({ state: Notification.permission })
          }
          // Ensure correct 'this' context
          return originalQuery.call(this, parameters)
        }
        // Mask the string representation
        makeNative(navigator.permissions.query, 'query')
      }

      // --- 4. WEBGL VENDOR/RENDERER ---
      try {
        const getParameter = WebGLRenderingContext.prototype.getParameter
        // @ts-ignore: overwriting getParameter
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
          // UNMASKED_VENDOR_WEBGL
          if (parameter === 37445) {
            return 'Google Inc. (NVIDIA)'
          }
          // UNMASKED_RENDERER_WEBGL
          if (parameter === 37446) {
            return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, or similar)'
          }
          return getParameter.apply(this, [parameter])
        }
        makeNative(WebGLRenderingContext.prototype.getParameter, 'getParameter')
      } catch {
        // ignore
      }

      // --- 5. PLUGINS (Subtle Adjustment) ---
      // Only mess with plugins if strictly necessary.
      // In headed mode, browsers have plugins. Empty arrays are suspicious.
      // We leave the default plugins alone as we are in a real Chrome instance.
      // However, we ensure the prototype is correct if we ever did modify it.
      // (Skipping aggressive plugin mocking to avoid mismatches)

      // --- 6. WEBRTC (Prevent Leaks) ---
      // @ts-ignore: accessing RTCPeerConnection
      const originalRTCPeerConnection = window.RTCPeerConnection
      // @ts-ignore: accessing RTCPeerConnection
      if (originalRTCPeerConnection) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fakeRTCPeerConnection = function (config: RTCConfiguration): any {
          if (config && config.iceServers) {
            config.iceTransportPolicy = 'relay'
          }
          // @ts-ignore: constructor call: constructor call
          return new originalRTCPeerConnection(config)
        }
        fakeRTCPeerConnection.prototype = originalRTCPeerConnection.prototype
        // @ts-ignore: setting global RTCPeerConnection
        window.RTCPeerConnection = fakeRTCPeerConnection

        // Hide the override
        // @ts-ignore: fixing makeNative type compatibility
        makeNative(window.RTCPeerConnection, 'RTCPeerConnection')
      }
    })

    // Store context
    runningContexts.set(profileId, context)

    // Cleanup on close
    context.on('close', () => {
      runningContexts.delete(profileId)

      // Notify renderer that profile stopped unexpectedly
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('profile-stopped', profileId)
      }

      console.log(`Profile ${profileId} closed.`)
    })

    // 4. Force detection of window closure (User clicks 'X')
    // Sometimes context 'close' is not triggered immediately if pages are just closed
    const handlePageClose = (): void => {
      setTimeout(() => {
        try {
          if (context.pages().length === 0) {
            console.log(`All pages for ${profileId} closed. Closing context.`)
            context.close().catch((e) => console.error('Error closing context:', e))
          }
        } catch {
          // Context might be already closed
        }
      }, 500)
    }

    // 5. Data Usage Tracking
    let sessionDataUsage = 0
    let lastSave = Date.now()
    const SAVE_INTERVAL = 5000 // 5 seconds

    const trackDataUsage = async (page): Promise<void> => {
      try {
        const client = await context.newCDPSession(page)
        await client.send('Network.enable')

        client.on('Network.dataReceived', (params) => {
          sessionDataUsage += params.dataLength

          // Save periodically
          if (Date.now() - lastSave > SAVE_INTERVAL) {
            saveUsage()
          }
        })

        // Also track sent data if possible, though 'dataReceived' is the bulk
        // Network.dataSent is not a standard event in all versions, sticking to loaded resources mostly
      } catch (e) {
        console.warn(`Failed to attach CDP for data tracking on page ${page.url()}:`, e)
      }
    }

    const saveUsage = async (): Promise<void> => {
      if (sessionDataUsage > 0) {
        const currentProfile = await ProfileManager.getById(profileId)
        const currentTotal = currentProfile?.totalDataUsage || 0
        const newTotal = currentTotal + sessionDataUsage

        await ProfileManager.update(profileId, { totalDataUsage: newTotal })

        sessionDataUsage = 0 // Reset accumulator
        lastSave = Date.now()
      }
    }

    // Função auxiliar para configurar handlers de página
    const setupPage = (page): void => {
      page.on('close', handlePageClose)
      trackDataUsage(page) // Attach tracker

      // CORREÇÃO: Forçar o salvamento com o nome correto do arquivo
      page.on('download', async (download) => {
        const suggestedFilename = download.suggestedFilename()

        // Reconstrói o caminho da pasta de downloads deste perfil
        const profileDownloadPath = path.join(
          app.getPath('downloads'),
          'SuiteBrowser',
          profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + profile.id
        )

        // Garante que a pasta existe
        await fs.ensureDir(profileDownloadPath)

        // Caminho final completo
        const filePath = path.join(profileDownloadPath, suggestedFilename)

        console.log(`Salvando download em: ${filePath}`)

        // Salva o arquivo com o nome correto
        await download.saveAs(filePath)
      })
    }

    context.on('page', (page) => {
      setupPage(page)
    })

    // Attach to existing pages
    context.pages().forEach((page) => {
      setupPage(page)
    })

    // Ensure final save on close, hook into the existing close logic isn't enough because context.on('close') is called after closure.
    // We need to ensure we save before destroying the context reference or when stopping.
    const originalClose = context.close.bind(context)
    context.close = async () => {
      await saveUsage() // Final save
      return originalClose()
    }

    // Update lastUsed
    await ProfileManager.update(profile.id, { lastUsed: new Date().toISOString() })

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage()

    try {
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch (navError) {
      console.warn('[Engine] Initial navigation failed:', navError)
    }

    return context
  } catch (error: unknown) {
    console.error('[Engine] Launch failed:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes("Executable doesn't exist")) {
      throw new Error(
        'Google Chrome não encontrado. Por favor, instale o Google Chrome ou verifique se ele está no caminho padrão.'
      )
    }
    throw error
  }
}

export async function stopProfile(profileId: string): Promise<void> {
  const context = runningContexts.get(profileId)
  if (context) {
    await context.close()
    runningContexts.delete(profileId)
  }

  console.log(`Profile ${profileId} stopped.`)
}

export async function closeAllProfiles(): Promise<void> {
  console.log('Closing all open profiles...')
  const promises: Promise<void>[] = []

  for (const [id, context] of runningContexts.entries()) {
    console.log(`Closing profile ${id}...`)
    promises.push(context.close().catch((e) => console.error(`Failed to close profile ${id}:`, e)))
  }

  await Promise.all(promises)
  runningContexts.clear()
  console.log('All profiles closed.')
}
