import * as net from 'net'
import { SocksClient } from 'socks'

export interface ForwarderOptions {
  proxyHost: string
  proxyPort: number
  username: string
  password: string
}

export interface ForwarderResult {
  port: number
  close: () => void
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        server.close()
        return reject(new Error('[Forwarder] Falha ao obter porta disponível'))
      }
      const port = addr.port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function destroySocket(socket: net.Socket, label: string): void {
  if (!socket.destroyed) {
    socket.destroy()
    console.debug(`[Forwarder] Socket destruído: ${label}`)
  }
}

async function handleSocks5Handshake(
  localSocket: net.Socket
): Promise<{ host: string; port: number } | null> {
  return new Promise((resolve) => {
    let buffer = Buffer.alloc(0)
    let state: 'auth-negotiation' | 'request' = 'auth-negotiation'

    const onData = (chunk: Buffer): void => {
      buffer = Buffer.concat([buffer, chunk])

      if (state === 'auth-negotiation') {
        // Espera pelo menos 3 bytes: VER(1) + NMETHODS(1) + METHODS(N)
        if (buffer.length < 2) return
        const nMethods = buffer[1]
        if (buffer.length < 2 + nMethods) return

        // Responde: VER=5, METHOD=0 (No Auth) — Chromium aceita sem autenticação local
        localSocket.write(Buffer.from([0x05, 0x00]))
        buffer = buffer.slice(2 + nMethods)
        state = 'request'
        return
      }

      if (state === 'request') {
        // Mínimo: VER(1) + CMD(1) + RSV(1) + ATYP(1) = 4 bytes
        if (buffer.length < 4) return

        const atyp = buffer[3]
        let host = ''
        let port = 0
        let offset = 4

        if (atyp === 0x01) {
          // IPv4: 4 bytes
          if (buffer.length < offset + 4 + 2) return
          host = `${buffer[offset]}.${buffer[offset + 1]}.${buffer[offset + 2]}.${buffer[offset + 3]}`
          offset += 4
        } else if (atyp === 0x03) {
          // Domain: 1 byte de tamanho + N bytes de hostname
          if (buffer.length < offset + 1) return
          const len = buffer[offset]
          offset += 1
          if (buffer.length < offset + len + 2) return
          host = buffer.slice(offset, offset + len).toString('utf8')
          offset += len
        } else if (atyp === 0x04) {
          // IPv6: 16 bytes
          if (buffer.length < offset + 16 + 2) return
          const parts: string[] = []
          for (let i = 0; i < 16; i += 2) {
            parts.push(buffer.slice(offset + i, offset + i + 2).toString('hex'))
          }
          host = parts.join(':')
          offset += 16
        } else {
          // Tipo de endereço desconhecido — envia COMMAND NOT SUPPORTED e encerra
          localSocket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
          resolve(null)
          return
        }

        port = buffer.readUInt16BE(offset)
        localSocket.removeListener('data', onData)
        resolve({ host, port })
      }
    }

    localSocket.on('data', onData)
    localSocket.once('error', () => resolve(null))
    localSocket.once('close', () => resolve(null))
  })
}

async function startForwarderServer(options: ForwarderOptions): Promise<ForwarderResult> {
  const { proxyHost, proxyPort, username, password } = options
  const localPort = await getAvailablePort()

  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.on('connection', async (localSocket: net.Socket) => {
      localSocket.once('error', (err) => {
        console.warn('[Forwarder] Erro no socket local:', err.message)
        destroySocket(localSocket, 'local')
      })

      const destination = await handleSocks5Handshake(localSocket)

      if (!destination) {
        destroySocket(localSocket, 'local (handshake falhou)')
        return
      }

      const { host: destHost, port: destPort } = destination

      try {
        const { socket: remoteSocket } = await SocksClient.createConnection({
          proxy: {
            host: proxyHost,
            port: proxyPort,
            type: 5,
            userId: username,
            password: password
          },
          command: 'connect',
          destination: { host: destHost, port: destPort }
        })

        // Resposta de sucesso ao Chromium: conexão estabelecida
        localSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))

        remoteSocket.once('error', (err) => {
          console.warn(`[Forwarder] Erro no socket remoto (${destHost}:${destPort}):`, err.message)
          destroySocket(remoteSocket, 'remote')
          destroySocket(localSocket, 'local')
        })

        localSocket.once('error', () => {
          destroySocket(remoteSocket, 'remote')
          destroySocket(localSocket, 'local')
        })

        remoteSocket.once('close', () => destroySocket(localSocket, 'local (remote closed)'))
        localSocket.once('close', () => destroySocket(remoteSocket, 'remote (local closed)'))

        remoteSocket.once('end', () => {
          if (!localSocket.destroyed) localSocket.end()
        })
        localSocket.once('end', () => {
          if (!remoteSocket.destroyed) remoteSocket.end()
        })

        // Pipe bidirecional — túnel completo entre Chromium e proxy real
        localSocket.pipe(remoteSocket)
        remoteSocket.pipe(localSocket)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(
          `[Forwarder] Falha ao conectar ao proxy remoto (${destHost}:${destPort}):`,
          msg
        )

        if (!localSocket.destroyed) {
          localSocket.write(
            Buffer.from([0x05, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
          )
          localSocket.end()
        }
      }
    })

    server.on('error', (err) => {
      console.error('[Forwarder] Erro no servidor local:', err.message)
      reject(err)
    })

    server.listen(localPort, '127.0.0.1', () => {
      console.log(`[Forwarder] Servidor local SOCKS5 sem auth iniciado em 127.0.0.1:${localPort}`)
      console.log(`[Forwarder] Tunelando para ${proxyHost}:${proxyPort} com credenciais`)

      resolve({
        port: localPort,
        close: () => {
          server.close(() => {
            console.log(`[Forwarder] Servidor local na porta ${localPort} encerrado`)
          })
        }
      })
    })
  })
}

export function createProxyForwarder(options: ForwarderOptions): Promise<ForwarderResult> {
  return startForwarderServer(options)
}
