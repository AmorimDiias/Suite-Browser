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
  BR: { latitude: -23.5505, longitude: -46.6333 } // Sao Paulo
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

  console.log(`Launching profile ${profile.id} (${profile.name})`)
  console.log(`Directory: ${userDataDir}`)
  console.log(`Proxy: ${proxyConfig ? 'Configured with auth' : 'None'}`)

  // 3. Launch with PLAYWRIGHT PURE (no playwright-extra)
  // This still allows Google login while handling proxy auth correctly
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
      '--disable-component-extensions-with-background-pages'
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

      // ANTI-BOT: Flags removidas para evitar barra de aviso ("Unsupported flag")
      // A proteção é feita via 'ignoreDefaultArgs' e 'initScript' (JS)
    ],
    // STEALTH: User Agent atualizado (Chrome 131 - Janeiro 2025)
    userAgent:
      profile.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

    // DOWNLOADS: Pasta isolada para cada perfil na pasta de Downloads do usuário
    // Estrutura: Downloads/SuiteBrowser/{profile_id}
    downloadsPath: path.join(
      app.getPath('downloads'),
      'SuiteBrowser',
      profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + profile.id
    ),
    acceptDownloads: true
  })

  // STEALTH VIA JS (Recusa robusta de fingerprinting)
  await context.addInitScript(() => {
    // --- UTILS: Native Code Emulation ---
    // Make our overrides look like native functions
    const makeNative = (func: Function, key: string) => {
      // @ts-ignore
      Object.defineProperty(func, 'toString', {
        value: () => `function ${key}() { [native code] }`,
        configurable: true,
        writable: true
      })
      // @ts-ignore
      Object.defineProperty(func, 'name', { value: key, configurable: true })
    }

    // --- 1. WEBDRIVER (The most common tell) ---
    // Remove the property completely from the prototype chain
    try {
      // @ts-ignore
      delete Object.getPrototypeOf(navigator).webdriver
    } catch (e) {}

    // Also define it as false on the instance just in case
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
      enumerable: true // Native properties are often enumerable
    })

    // --- 2. CHROME OBJECT ---
    // Ensure window.chrome exists and looks real
    // @ts-ignore
    if (!window.chrome) {
      // @ts-ignore
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
      // @ts-ignore
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
      // @ts-ignore
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
    } catch (e) {}

    // --- 5. PLUGINS (Subtle Adjustment) ---
    // Only mess with plugins if strictly necessary.
    // In headed mode, browsers have plugins. Empty arrays are suspicious.
    // We leave the default plugins alone as we are in a real Chrome instance.
    // However, we ensure the prototype is correct if we ever did modify it.
    // (Skipping aggressive plugin mocking to avoid mismatches)

    // --- 6. WEBRTC (Prevent Leaks) ---
    // @ts-ignore
    const originalRTCPeerConnection = window.RTCPeerConnection
    // @ts-ignore
    if (originalRTCPeerConnection) {
      const fakeRTCPeerConnection = function (config: RTCConfiguration) {
        if (config && config.iceServers) {
          config.iceTransportPolicy = 'relay'
        }
        // @ts-ignore
        return new originalRTCPeerConnection(config)
      }
      fakeRTCPeerConnection.prototype = originalRTCPeerConnection.prototype
      // @ts-ignore
      window.RTCPeerConnection = fakeRTCPeerConnection

      // Hide the override
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
  const handlePageClose = () => {
    setTimeout(() => {
      try {
        if (context.pages().length === 0) {
          console.log(`All pages for ${profileId} closed. Closing context.`)
          context.close().catch((e) => console.error('Error closing context:', e))
        }
      } catch (e) {
        // Context might be already closed
      }
    }, 500)
  }

  // Função auxiliar para configurar handlers de página
  const setupPage = (page) => {
    page.on('close', handlePageClose)

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

  // Update lastUsed
  await ProfileManager.update(profile.id, { lastUsed: new Date().toISOString() })

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage()

  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' })

  return context
}

export async function stopProfile(profileId: string): Promise<void> {
  const context = runningContexts.get(profileId)
  if (context) {
    await context.close()
    runningContexts.delete(profileId)
  }

  console.log(`Profile ${profileId} stopped.`)
}
