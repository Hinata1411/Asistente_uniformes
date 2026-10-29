import { createPublicKey, verify } from 'node:crypto'

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'asistente-uniformes'

const CERT_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let certCache = new Map()
let certCacheExpiresAt = 0

const decodeBase64Url = (value) =>
  Buffer.from(value, 'base64url')

async function getSigningKey(kid) {
  if (Date.now() >= certCacheExpiresAt || certCache.size === 0) {
    const response = await fetch(CERT_URL)
    if (!response.ok) throw new Error('No se pudieron cargar las llaves de Firebase.')

    const body = await response.json()
    const cacheControl = response.headers.get('cache-control') || ''
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 3600)

    certCache = new Map(
      (body.keys || []).map((key) => [key.kid, createPublicKey({ key, format: 'jwk' })])
    )
    certCacheExpiresAt = Date.now() + maxAge * 1000
  }

  return certCache.get(kid)
}

export async function verifyFirebaseIdToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw new Error('Token inválido.')

  const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'))
  const claims = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'))

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Token inválido.')

  const publicKey = await getSigningKey(header.kid)
  if (!publicKey) throw new Error('La llave de firma del token no es válida.')

  const isValidSignature = verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    decodeBase64Url(parts[2])
  )

  const now = Math.floor(Date.now() / 1000)
  const validClaims =
    claims.aud === FIREBASE_PROJECT_ID &&
    claims.iss === `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` &&
    typeof claims.sub === 'string' && claims.sub.length > 0 &&
    claims.sub.length <= 128 &&
    Number(claims.exp) > now &&
    Number(claims.iat) <= now &&
    Number(claims.auth_time) <= now

  if (!isValidSignature || !validClaims) throw new Error('Token de Firebase inválido o vencido.')

  return { uid: claims.sub, claims }
}

export function requireFirebaseUser(req, res, next) {
  const authorization = req.get('authorization') || ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión para usar el asistente.' })
  }

  verifyFirebaseIdToken(token)
    .then((user) => {
      req.firebaseUser = user
      next()
    })
    .catch(() => {
      res.status(401).json({ error: 'La sesión no es válida. Inicia sesión nuevamente.' })
    })
}
