// Preuve client orcad (Forme B, D-F2-2) — stub local, stdlib Node seule.
// Le stub mime la forme de readiness du gel : ServeReadiness
// { runtimeId, boundEndpoint, advertisedEndpoint, pairing, health }
// (buildOrcadServeReadiness, src/main/orcad/orcad-serve-readiness.ts ;
// boundEndpoint = rpc.getWebSocketEndpoint(), src/main/server/serve-pairing-readiness.ts)
// + un endpoint WS loopback. Le client fait : readiness HTTP, connexion WS
// sur boundEndpoint, round-trip JSON-RPC server.status, ping/pong.
// Serveur : 127.0.0.1, port ephemere. Jamais contre un orcad V5 ni onorca.dev.
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'

const RUNTIME_ID = 'stub-orcad-f2'
let passed = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (ok) {
    passed += 1
  } else {
    process.exitCode = 1
  }
}

// --- Minimal WS server (RFC 6455, stdlib seule) ---
function wsAccept(key) {
  return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
}
function encodeFrame(opcode, payload) {
  const data = Buffer.from(payload)
  let header
  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, data.length])
  } else if (data.length < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x80 | opcode
    header[1] = 126
    header.writeUInt16BE(data.length, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x80 | opcode
    header[1] = 127
    header.writeBigUInt64BE(BigInt(data.length), 2)
  }
  return Buffer.concat([header, data])
}
function handleSocket(socket) {
  let buf = Buffer.alloc(0)
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk])
    for (;;) {
      if (buf.length < 2) {
        return
      }
      const fin = (buf[0] & 0x80) !== 0
      const opcode = buf[0] & 0x0f
      const masked = (buf[1] & 0x80) !== 0
      let len = buf[1] & 0x7f
      let off = 2
      if (len === 126) {
        if (buf.length < 4) {
          return
        }
        len = buf.readUInt16BE(2)
        off = 4
      } else if (len === 127) {
        if (buf.length < 10) {
          return
        }
        len = Number(buf.readBigUInt64BE(2))
        off = 10
      }
      const mask = masked ? buf.subarray(off, off + 4) : null
      if (masked) {
        off += 4
      }
      if (buf.length < off + len) {
        return
      }
      let payload = buf.subarray(off, off + len)
      if (masked) {
        payload = Buffer.from(payload)
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4]
        }
      }
      buf = buf.subarray(off + len)
      if (!fin) {
        continue
      }
      if (opcode === 0x9) {
        socket.write(encodeFrame(0xa, payload))
        continue
      }
      if (opcode === 0x8) {
        socket.end(encodeFrame(0x8, ''))
        continue
      }
      if (opcode === 0x1) {
        const text = payload.toString('utf8')
        if (text === 'ping') {
          socket.write(encodeFrame(0x1, 'pong'))
          continue
        }
        try {
          const msg = JSON.parse(text)
          if (msg.method === 'server.status') {
            socket.write(
              encodeFrame(
                0x1,
                JSON.stringify({
                  id: msg.id,
                  result: { ok: true, runtimeId: RUNTIME_ID, terminalDaemon: 'healthy' }
                })
              )
            )
          }
        } catch {
          /* ignore malformed */
        }
      }
    }
  })
}

const server = createServer((req, res) => {
  if (req.url === '/ready') {
    const port = server.address().port
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        runtimeId: RUNTIME_ID,
        boundEndpoint: `ws://127.0.0.1:${port}`,
        advertisedEndpoint: null,
        pairing: {
          available: false,
          reason: 'pairing not exposed by adapter',
          guidance: 'operator-only'
        },
        health: { terminalDaemon: { ok: true, verdict: 'healthy' } },
        managedWslCliReconciliation: 'settled'
      })
    )
    return
  }
  res.writeHead(404)
  res.end()
})
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key']
  if (!key) {
    socket.destroy()
    return
  }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${wsAccept(key)}\r\n\r\n`
  )
  handleSocket(socket)
})

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port
  try {
    // 1. Readiness HTTP
    const res = await fetch(`http://127.0.0.1:${port}/ready`)
    const readiness = await res.json()
    check(
      'readiness HTTP 200 + champs ServeReadiness',
      res.status === 200 &&
        readiness.runtimeId === RUNTIME_ID &&
        typeof readiness.boundEndpoint === 'string' &&
        readiness.boundEndpoint.startsWith('ws://127.0.0.1:') &&
        readiness.health?.terminalDaemon?.verdict === 'healthy'
    )
    // 2. WS connect sur boundEndpoint (loopback seul)
    const ws = new WebSocket(readiness.boundEndpoint)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('ws open failed'))
    })
    check('WS connect sur boundEndpoint loopback', ws.readyState === WebSocket.OPEN)
    // 3. Round-trip JSON-RPC server.status
    const status = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('server.status timeout')), 5000)
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.id === 1) {
            clearTimeout(to)
            resolve(msg)
          }
        } catch {
          /* ignore */
        }
      }
      ws.send(JSON.stringify({ id: 1, method: 'server.status', params: {} }))
    })
    check(
      'round-trip server.status',
      status.result?.ok === true && status.result?.runtimeId === RUNTIME_ID
    )
    // 4. ping/pong texte
    const pong = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('ping timeout')), 5000)
      ws.onmessage = (ev) => {
        if (ev.data === 'pong') {
          clearTimeout(to)
          resolve(true)
        }
      }
      ws.send('ping')
    })
    check('ping/pong texte', pong === true)
    ws.close()
    console.log(
      `PROOF: ${passed}/4 checks — stub orcad local 127.0.0.1:${port}, jamais contre un orcad V5 ni onorca.dev`
    )
    console.log(passed === 4 ? 'PROOF_EXIT:0' : 'PROOF_EXIT:1')
  } catch (err) {
    console.log(`FAIL exception: ${err.message}`)
    process.exitCode = 1
  } finally {
    server.close()
  }
})
