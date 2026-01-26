import { Profile } from './profiles'
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

export async function checkProxyHealth(profile: Profile): Promise<'online' | 'offline'> {
  if (!profile.proxy) return 'unknown' as any

  try {
    let agent: any
    const proxyUrl = profile.proxy

    if (proxyUrl.startsWith('socks')) {
      agent = new SocksProxyAgent(proxyUrl)
    } else {
      // http/https
      agent = new HttpsProxyAgent(proxyUrl)
    }

    const start = Date.now()
    await axios.get('https://www.google.com', {
      httpsAgent: agent,
      timeout: 10000, // 10s timeout
      validateStatus: (status) => status >= 200 && status < 400
    })
    const latency = Date.now() - start
    console.log(`Proxy check for ${profile.name}: ONLINE (${latency}ms)`)

    return 'online'
  } catch (error: any) {
    console.error(`Proxy check for ${profile.name} failed:`, error.message)
    return 'offline'
  }
}
