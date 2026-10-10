import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'

// Pruebas del endpoint con una API key ficticia: solo se prueban los caminos
// que el servidor resuelve sin consultar a Groq (validaciones de entrada).
const PORT = 3999
const ENDPOINT = `http://127.0.0.1:${PORT}/api/ai/recommendation`
let srv
beforeAll(async () => {
  srv = spawn('node', ['server.js'], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, GROQ_API_KEY: 'clave-de-prueba', PORT: String(PORT) } })
  await new Promise((ok) => srv.stdout.on('data', (d) => String(d).includes('Servidor') && ok()))
})
afterAll(() => srv.kill())
const post = (body, headers = { 'Content-Type': 'application/json' }) => fetch(ENDPOINT, { method: 'POST', headers, body })

describe('API /api/ai/recommendation — validación de entradas', () => {
  it('PU-31 cuerpo que no es objeto (arreglo) responde 400', async () => {
    const r = await post('[]'); expect(r.status).toBe(400)
  })
  it('PU-32 JSON mal formado responde 400 sin exponer detalles', async () => {
    const r = await post('{"a":'); expect(r.status).toBe(400)
    const j = await r.json(); expect(j.error).toBe('JSON inválido')
  })
  it('PU-33 pedido incompleto se resuelve con reglas de producción (sin IA)', async () => {
    const r = await post(JSON.stringify({ garmentSource: 'inventory', product: 'Jersey', productType: 'Jersey', size: '', technique: 'DTF', quantity: 1, customizationSide: 'frente' }))
    const j = await r.json(); expect(j.source).toBe('production_rules'); expect(j.result.riskLevel).toBe('alto')
  })
  it('PU-34 imagen con formato no permitido (SVG) responde 400', async () => {
    const r = await post(JSON.stringify({ garmentSource: 'inventory', product: 'Jersey', productType: 'Jersey', size: 'M', technique: 'DTF', quantity: 1, customizationSide: 'frente', previewImage: 'data:image/svg+xml;base64,PHN2Zz4=' }))
    expect(r.status).toBe(400)
  })
  it('PU-35 solicitud mayor a 20 MB responde 413', async () => {
    const r = await post(JSON.stringify({ previewImage: 'A'.repeat(21 * 1024 * 1024) })); expect(r.status).toBe(413)
  })
  it('PU-36 origen no autorizado no recibe cabecera CORS', async () => {
    const r = await post('[]', { 'Content-Type': 'application/json', Origin: 'http://sitio-malicioso.com' })
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
  })
  it('PU-37 el servidor no revela la tecnología usada (X-Powered-By)', async () => {
    const r = await post('[]'); expect(r.headers.get('x-powered-by')).toBeNull()
  })
})
