import { BrowserContext, Page, chromium as playwrightChromium } from 'playwright'
import path from 'path'
import fs from 'fs-extra'
import { ProfileManager, Profile } from './profiles'
import { createProxyForwarder, ForwarderResult } from './proxyForwarder'
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

interface UserAgentBundle {
  userAgent: string
  userAgentMetadata: {
    brands: Array<{ brand: string; version: string }>
    fullVersionList: Array<{ brand: string; version: string }>
    platform: string
    platformVersion: string
    architecture: string
    model: string
    mobile: boolean
    bitness: string
    wow64: boolean
  }
}

function buildUserAgentBundle(profile: Profile): UserAgentBundle {
  // Se o perfil não tiver UA, usamos um padrão extremamente comum (Chrome/Windows) como base para a higienização
  const ua =
    profile.userAgent ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'

  const platformMap: Record<string, string> = {
    // ... (mapeamento mantido)
    DE: 'Windows',
    FR: 'Windows',
    US: 'Windows',
    ES: 'Windows',
    BR: 'Windows',
    CO: 'Windows',
    GB: 'Windows',
    CA: 'Windows'
  }

  const chromeFullVersionMatch = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/)
  const chromeMajorVersionMatch = ua.match(/Chrome\/(\d+)/)

  const MAX_SAFE_MAJOR = 135
  const FALLBACK_FULL = '133.0.6943.141'
  const FALLBACK_MAJOR = '133'

  let chromeFullVersion = chromeFullVersionMatch ? chromeFullVersionMatch[1] : FALLBACK_FULL
  let chromeMajorVersion = chromeMajorVersionMatch ? chromeMajorVersionMatch[1] : FALLBACK_MAJOR
  let finalUa = ua

  if (parseInt(chromeMajorVersion, 10) > MAX_SAFE_MAJOR) {
    console.warn(
      `[Engine] Versão suspeita de Chrome detectada (${chromeMajorVersion}). Normalizando para ${FALLBACK_MAJOR}.`
    )
    chromeFullVersion = FALLBACK_FULL
    chromeMajorVersion = FALLBACK_MAJOR
    // Replace robusto: captura Chrome/ seguido de qualquer versão até o próximo espaço ou fim de string
    finalUa = ua.replace(/Chrome\/[\d.]+/, `Chrome/${FALLBACK_FULL}`)
  }

  const platform = platformMap[profile.country] || 'Windows'

  const brands = [
    { brand: 'Google Chrome', version: chromeMajorVersion },
    { brand: 'Chromium', version: chromeMajorVersion },
    { brand: 'Not A;Brand', version: '99' }
  ]

  const fullVersionList = [
    { brand: 'Google Chrome', version: chromeFullVersion },
    { brand: 'Chromium', version: chromeFullVersion },
    { brand: 'Not A;Brand', version: '99.0.0.0' }
  ]

  const platformVersion = platform === 'Windows' ? '10.0.0' : '14.0.0'

  return {
    userAgent: finalUa,
    userAgentMetadata: {
      brands,
      fullVersionList,
      platform,
      platformVersion,
      architecture: 'x86',
      model: '',
      mobile: false,
      bitness: '64',
      wow64: false
    }
  }
}

const SPOOFED_SCREEN = { width: 1920, height: 1080 }

async function applyUAOverride(
  page: Page,
  bundle: UserAgentBundle,
  profileLocale?: string
): Promise<void> {
  try {
    const client = await page.context().newCDPSession(page)

    // Emulation.setUserAgentOverride é persistente (sobrevive ao detach e navegações)
    // Diferente do Network.setUserAgentOverride que seria resetado após o client.detach()
    await client.send('Emulation.setUserAgentOverride', {
      userAgent: bundle.userAgent,
      acceptLanguage: profileLocale || 'de-DE',
      platform: bundle.userAgentMetadata.platform,
      userAgentMetadata: bundle.userAgentMetadata
    })

    client.detach().catch(() => {})
  } catch (e) {
    console.warn('[Engine] Falha ao aplicar UA override via CDP:', e)
  }
}

// Helper to generate deterministic fingerprint protected config from Profile ID
function generateFingerprint(profileId: string): {
  seed: number
  vendor: string
  renderer: string
} {
  let hash = 0
  for (let i = 0; i < profileId.length; i++) {
    const char = profileId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  const seed = Math.abs(hash)

  // Curated list of high-entropy GPUs to rotate
  const vendors = [
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)'
    },
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)'
    },
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)'
    },
    {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0)'
    },
    {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)'
    }
  ]
  const gpu = vendors[seed % vendors.length]

  return {
    seed,
    vendor: gpu.vendor,
    renderer: gpu.renderer
  }
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
    const appDir = path.dirname(app.getPath('exe'))
    const resDir = process.resourcesPath

    // Checa Root e Resources
    const rootData = path.join(appDir, 'browser_data')
    const resData = path.join(resDir, 'browser_data')

    if (fs.existsSync(rootData)) {
      baseDataDir = rootData
      console.log('Using portable browser_data (root):', baseDataDir)
    } else if (fs.existsSync(resData)) {
      baseDataDir = resData
      console.log('Using browser_data from resources:', baseDataDir)
    } else {
      baseDataDir = path.join(app.getPath('userData'), 'browser_data')
    }
  } else {
    baseDataDir = path.join(process.cwd(), 'browser_data')
  }

  const userDataDir = path.join(baseDataDir, profileId)
  fs.ensureDirSync(userDataDir)

  // 2. Configurar proxy com suporte a SOCKS5 autenticado via forwarder local
  let proxyConfig: { server: string; username?: string; password?: string } | undefined
  let proxyProtocol = ''
  let proxyHost = ''
  let proxyPort = ''
  let forwarder: ForwarderResult | null = null

  if (profile.proxy && profile.proxy.includes('://')) {
    const url = new URL(profile.proxy)
    proxyProtocol = url.protocol.replace(':', '')
    proxyHost = url.hostname
    proxyPort = url.port

    const isSocks5 = proxyProtocol === 'socks5' || proxyProtocol === 'socks5h'
    const hasAuth = !!url.username

    if (isSocks5 && hasAuth) {
      // Chromium não suporta autenticação nativa em SOCKS5.
      // Solução: subir um forwarder local sem auth → ele autentica com o proxy real.
      forwarder = await createProxyForwarder({
        proxyHost,
        proxyPort: parseInt(proxyPort, 10),
        username: url.username,
        password: url.password
      })

      proxyConfig = {
        // Chromium aponta para o tunel local sem auth — isolamento total mantido
        server: `socks5://127.0.0.1:${forwarder.port}`,
        username: undefined,
        password: undefined
      }
    } else {
      proxyConfig = {
        server: isSocks5
          ? `socks5://${proxyHost}:${proxyPort}`
          : `${url.protocol}//${proxyHost}:${proxyPort}`,
        username: url.username || undefined,
        password: url.password || undefined
      }
    }
  }

  console.log(`[Engine] Launching profile ${profile.id} (${profile.name})`)
  console.log(`[Engine] Directory: ${userDataDir}`)
  console.log(
    `[Engine] Proxy: ${proxyConfig ? (forwarder ? `Forwarder local → ${proxyHost}:${proxyPort}` : 'Direto') : 'None'}`
  )

  if (proxyConfig) {
    console.log(`[Engine] Proxy Server: ${proxyConfig.server}`)
  }

  // uaBundle sempre construído: se o perfil estiver vazio, usa um Chrome/Win padrão higienizado
  const uaBundle = buildUserAgentBundle(profile)

  try {
    const isSocks5Proxy = proxyProtocol === 'socks5' || proxyProtocol === 'socks5h'

    // Flags de isolamento de rede — eliminam DNS leak via proxy
    const networkIsolationArgs: string[] = proxyConfig
      ? [
          // Desativa prefetch de DNS que ocorre fora do proxy
          '--dns-prefetch-disable',
          // Desativa conexões especulativas (TCP e DNS) fora do proxy
          '--disable-background-networking',
          '--no-pings',
          // Kill Switch de DNS: bloqueia resolver local como fallback
          '--host-resolver-rules=MAP * ~NOTFOUND,EXCLUDE 127.0.0.1,EXCLUDE localhost',
          // Desativa os subsistemas de DNS/rede que operam fora do tunnel do proxy
          '--disable-features=AsyncDns,DnsOverHttpsUpgrade,PrivacyDnsTokenIssues,NetworkPrediction,ParallelDownloading',
          // Garante roteamento SOCKS5 via flag explícita do Chromium
          ...(isSocks5Proxy || forwarder
            ? [`--proxy-server=socks5://127.0.0.1:${forwarder?.port ?? proxyPort}`]
            : [])
        ]
      : []

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
        '--start-maximized',
        '--disable-infobars',
        '--test-type',
        '--disable-renderer-backgrounding',
        '--password-store=basic',
        '--use-mock-keychain',
        `--lang=${profile.locale || 'de-DE'}`,
        ...networkIsolationArgs
      ],
      // STEALTH: UA higienizado via uaBundle — version override forçado
      userAgent: uaBundle.userAgent,

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

    // Generate deterministic fingerprint data
    const fingerprintArgs = generateFingerprint(profile.id)
    console.log(`[Engine] Injecting Fingerprint Protection:`, fingerprintArgs)

    // STEALTH VIA JS (Recusa robusta de fingerprinting)
    await context.addInitScript(
      (args) => {
        const { seed, vendor, renderer, screenWidth, screenHeight } = args

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

        // --- CANVAS FINGERPRINT PROTECTION (NOISE INJECTION) ---
        try {
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
          const originalToBlob = HTMLCanvasElement.prototype.toBlob
          const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData

          // Deterministic PRNG based on Seed using Mulberry32
          const mulberry32 = (a: number) => {
            return function () {
              let t = (a += 0x6d2b79f5)
              t = Math.imul(t ^ (t >>> 15), t | 1)
              t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
              return ((t ^ (t >>> 14)) >>> 0) / 4294967296
            }
          }

          // Instancia o gerador
          const prng = mulberry32(seed)

          // Função de ruído sutil (-1, 0, 1) baseado no PRNG + index
          // Usa PRNG mas com base em um offset para não gerar a MESMA aleatoriedade em toda a tela sequencialmente.
          // Como precisamos de performance, pegamos um numero PRNG base para a "sessão" da função e aplicamos offsets rápidos
          const sessionRandom = prng()
          const getNoise = (index: number): number => {
            const raw = ((sessionRandom * 1000 + index) * 23.14) % 1
            if (raw < 0.3) return -1
            if (raw > 0.7) return 1
            return 0
          }

          // 1. Intercept getImageData (The core of 2D fingerprinting)
          // @ts-ignore: overwriting getImageData
          CanvasRenderingContext2D.prototype.getImageData = function (
            x: number,
            y: number,
            w: number,
            h: number,
            settings?: ImageDataSettings
          ) {
            // @ts-ignore: calling original
            const imageData = originalGetImageData.apply(this, [x, y, w, h, settings])
            if (!imageData) return imageData

            const { width, height, data } = imageData

            for (let i = 0; i < height; i++) {
              for (let j = 0; j < width; j++) {
                const pixelIndex = i * width + j
                const arrayIndex = pixelIndex * 4
                // Apenas modifica sutilmente o canal R (ou Alpha dependendo da escolha).
                // Vamos alterar apenas o Red channel neste caso para causar alteração de hash em vez de cor perceptivel
                const noise = getNoise(pixelIndex)
                data[arrayIndex] = Math.max(0, Math.min(255, data[arrayIndex] + noise))
              }
            }
            return imageData
          }
          makeNative(CanvasRenderingContext2D.prototype.getImageData, 'getImageData')

          // 2. Intercept toDataURL
          // @ts-ignore: overwriting toDataURL
          HTMLCanvasElement.prototype.toDataURL = function (
            type?: string,
            encoderOptions?: number | undefined
          ) {
            const context = this.getContext('2d')
            if (context) {
              const w = this.width
              const h = this.height
              const noisyData = context.getImageData(0, 0, w, h)
              const shadowCanvas = document.createElement('canvas')
              shadowCanvas.width = w
              shadowCanvas.height = h
              const shadowCtx = shadowCanvas.getContext('2d')
              if (shadowCtx) {
                shadowCtx.putImageData(noisyData, 0, 0)
                return originalToDataURL.apply(shadowCanvas, [type, encoderOptions])
              }
            }
            return originalToDataURL.apply(this, [type, encoderOptions])
          }
          makeNative(HTMLCanvasElement.prototype.toDataURL, 'toDataURL')

          // 3. Intercept toBlob
          // @ts-ignore: overwriting toBlob
          HTMLCanvasElement.prototype.toBlob = function (
            callback: BlobCallback,
            type?: string,
            quality?: number | undefined
          ) {
            const context = this.getContext('2d')
            if (context) {
              const w = this.width
              const h = this.height
              const noisyData = context.getImageData(0, 0, w, h)
              const shadowCanvas = document.createElement('canvas')
              shadowCanvas.width = w
              shadowCanvas.height = h
              const shadowCtx = shadowCanvas.getContext('2d')
              if (shadowCtx) {
                shadowCtx.putImageData(noisyData, 0, 0)
                return originalToBlob.apply(shadowCanvas, [callback, type, quality])
              }
            }
            return originalToBlob.apply(this, [callback, type, quality])
          }
          makeNative(HTMLCanvasElement.prototype.toBlob, 'toBlob')
        } catch {
          // ignore
        }

        // --- AUDIO FINGERPRINT PROTECTION ---
        try {
          // AnalyserNode protect (getFloatFrequencyData)
          if (typeof AnalyserNode !== 'undefined') {
            const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData
            // @ts-ignore: overwriting getFloatFrequencyData
            AnalyserNode.prototype.getFloatFrequencyData = function (array: Float32Array) {
              // @ts-ignore: array buffer type mismatch expected due to cross-world
              originalGetFloatFrequencyData.apply(this, [array])
              const prng = (Math.sin(seed) * 10000) % 1
              for (let i = 0; i < array.length; i++) {
                // Add imperceptible float noise to frequencies
                array[i] += prng * 0.0001 - 0.00005
              }
            }
            makeNative(AnalyserNode.prototype.getFloatFrequencyData, 'getFloatFrequencyData')
          }

          // AudioBuffer protect (getChannelData)
          if (typeof AudioBuffer !== 'undefined') {
            const originalGetChannelData = AudioBuffer.prototype.getChannelData
            // @ts-ignore: overwriting getChannelData
            AudioBuffer.prototype.getChannelData = function (channel: number) {
              const array = originalGetChannelData.apply(this, [channel])
              const sessionRandom = (Math.sin(seed + channel) * 10000) % 1
              for (let i = 0; i < array.length; i++) {
                // Add imperceptible noise to waveforms
                array[i] += sessionRandom * 0.0000001 - 0.00000005
              }
              return array
            }
            makeNative(AudioBuffer.prototype.getChannelData, 'getChannelData')
          }
        } catch {
          // ignore
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

        // --- 4. WEBGL VENDOR/RENDERER & READPIXELS (Dynamic Spoofing) ---
        try {
          // --- WebGL1 ---
          if (typeof WebGLRenderingContext !== 'undefined') {
            const getParameter = WebGLRenderingContext.prototype.getParameter
            // @ts-ignore: overwriting getParameter
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
              // UNMASKED_VENDOR_WEBGL
              if (parameter === 37445) return vendor
              // UNMASKED_RENDERER_WEBGL
              if (parameter === 37446) return renderer
              return getParameter.apply(this, [parameter])
            }
            makeNative(WebGLRenderingContext.prototype.getParameter, 'getParameter')

            const originalReadPixels = WebGLRenderingContext.prototype.readPixels
            // @ts-ignore: overwriting readPixels
            WebGLRenderingContext.prototype.readPixels = function (
              x,
              y,
              width,
              height,
              format,
              type,
              pixels
            ) {
              originalReadPixels.apply(this, [x, y, width, height, format, type, pixels])
              if (pixels && pixels.length) {
                const prngSession = (Math.sin(seed * 1.5) * 10000) % 1
                for (let i = 0; i < pixels.length; i += 4) {
                  // Modify Red channel or RGB subtly for 3D render extraction
                  const noise = ((prngSession + i) * 12.3) % 1
                  const shift = noise < 0.3 ? -1 : noise > 0.7 ? 1 : 0
                  // @ts-ignore: index set access on typed array abstraction
                  pixels[i] = Math.max(0, Math.min(255, pixels[i] + shift))
                }
              }
            }
            makeNative(WebGLRenderingContext.prototype.readPixels, 'readPixels')
          }

          // --- WebGL2 ---
          if (typeof WebGL2RenderingContext !== 'undefined') {
            const getParameter2 = WebGL2RenderingContext.prototype.getParameter
            // @ts-ignore: overwriting getParameter
            WebGL2RenderingContext.prototype.getParameter = function (parameter) {
              if (parameter === 37445) return vendor
              if (parameter === 37446) return renderer
              return getParameter2.apply(this, [parameter])
            }
            makeNative(WebGL2RenderingContext.prototype.getParameter, 'getParameter')

            const originalReadPixels2 = WebGL2RenderingContext.prototype.readPixels
            // @ts-ignore: overwriting readPixels
            WebGL2RenderingContext.prototype.readPixels = function (
              x,
              y,
              width,
              height,
              format,
              type,
              pixels,
              dstOffset
            ) {
              originalReadPixels2.apply(this, [
                x,
                y,
                width,
                height,
                format,
                type,
                pixels,
                dstOffset
              ])
              if (pixels && pixels.length) {
                const prngSession = (Math.sin(seed * 1.5) * 10000) % 1
                const start = dstOffset || 0
                for (let i = start; i < pixels.length; i += 4) {
                  const noise = ((prngSession + i) * 12.3) % 1
                  const shift = noise < 0.3 ? -1 : noise > 0.7 ? 1 : 0
                  // @ts-ignore: index set access on typed array abstraction
                  pixels[i] = Math.max(0, Math.min(255, pixels[i] + shift))
                }
              }
            }
            makeNative(WebGL2RenderingContext.prototype.readPixels, 'readPixels')
          }
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

        // --- 7. SCREEN FINGERPRINT PROTECTION ---
        // O CDP cobre a camada de rede, mas scripts agressivos leem window.screen diretamente.
        // Object.defineProperty garante que o valor retornado seja sempre o valor spoofado.
        try {
          const defineScreen = (prop: string, value: number): void => {
            Object.defineProperty(screen, prop, {
              get: () => value,
              configurable: true,
              enumerable: true
            })
          }

          defineScreen('width', screenWidth)
          defineScreen('height', screenHeight)
          defineScreen('availWidth', screenWidth)
          defineScreen('availHeight', screenHeight - 40) // 40px reservados para a taskbar
          defineScreen('colorDepth', 24)
          defineScreen('pixelDepth', 24)

          Object.defineProperty(window, 'devicePixelRatio', {
            get: () => 1,
            configurable: true,
            enumerable: true
          })
        } catch {
          // ignore
        }
      },
      { ...fingerprintArgs, screenWidth: SPOOFED_SCREEN.width, screenHeight: SPOOFED_SCREEN.height }
    )

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
    const setupPage = (page: Page): void => {
      // Sempre aplica o override para manter a consistência entre páginas
      applyUAOverride(page, uaBundle, profile.locale).catch((e) =>
        console.warn('[Engine] Erro ao aplicar UA override em nova página:', e)
      )

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

    // Atrela o encerramento do forwarder ao fechamento do context
    // Garante que nenhuma porta ou processo fique em background após o perfil fechar
    const originalClose = context.close.bind(context)
    context.close = async () => {
      await saveUsage()
      if (forwarder) {
        forwarder.close()
        forwarder = null
      }
      return originalClose()
    }

    // Update lastUsed
    await ProfileManager.update(profile.id, { lastUsed: new Date().toISOString() })

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage()

    await applyUAOverride(page, uaBundle, profile.locale)
    console.log(
      `[Engine] UA/Screen Override persistente aplicado. Chrome ${uaBundle.userAgentMetadata.fullVersionList[0]?.version}`
    )

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
