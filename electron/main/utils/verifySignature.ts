export async function verifySignature(request: Request, body: string, secret: string): Promise<boolean> {
  const signature = request.headers.get('X-Hub-Signature')
  if (!signature) {
    return false
  }

  const [algo, sig] = signature.split('=')
  if (algo !== 'sha1') {
    console.error('Unsupported signature algorithm:', algo)
    return false
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ])
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expectedSignature = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return sig === expectedSignature
}
