import { MessageError } from '@/i18n/MessageError'
export interface QRSettings {
  type: 'url' | 'text' | 'wifi'
  content: string
  ssid: string
  password: string
  security: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
  format: 'png' | 'svg'
}

export function qrPayload(settings: QRSettings) {
  if (settings.type === 'wifi') {
    if (!settings.ssid.trim())
      throw new MessageError('qrEnterTheWiFiNetworkName')
    const escape = (value: string) => value.replace(/([\\;,:"])/g, '\\$1')
    return `WIFI:T:${settings.security};S:${escape(settings.ssid)};P:${settings.security === 'nopass' ? '' : escape(settings.password)};H:${settings.hidden};;`
  }
  const content = settings.content.trim()
  if (!content) throw new MessageError('qrEnterTheTextOrWebsiteAddress')
  if (settings.type === 'url') {
    try {
      const url = new URL(content)
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
    } catch {
      throw new MessageError('qrEnterAFullWebsiteAddressStarting')
    }
  }
  return content
}

export async function generateQRCode(settings: QRSettings): Promise<Blob> {
  const content = qrPayload(settings)
  const QRCode = await import('qrcode')
  const options = { errorCorrectionLevel: 'M' as const, margin: 4, width: 1024 }
  try {
    if (settings.format === 'svg') {
      const svg = await QRCode.toString(content, { ...options, type: 'svg' })
      return new Blob([svg], { type: 'image/svg+xml' })
    }
    const canvas = await QRCode.toCanvas(content, options)
    try {
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new MessageError('qrPNGExportFailed')),
          'image/png',
        )
      })
    } finally {
      canvas.width = 0
    }
  } catch {
    throw new MessageError('qrTheQRCodeCouldNotBe')
  }
}
