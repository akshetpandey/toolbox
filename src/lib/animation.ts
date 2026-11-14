export type AnimationFormat = 'gif' | 'apng' | 'webp'

export function isAnimationFormat(format: string): format is AnimationFormat {
  return format === 'gif' || format === 'apng' || format === 'webp'
}

export interface AnimationInfo {
  format: 'gif' | 'apng'
  width: number
  height: number
  duration?: number
}

/** Read APNG timing without decoding pixels; FFprobe omits its duration. */
export async function readAnimationInfo(
  file: Blob,
): Promise<AnimationInfo | null> {
  const header = new Uint8Array(await file.slice(0, 33).arrayBuffer())
  const name = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
  if (/^GIF8[79]a$/.test(name(header.slice(0, 6))) && header.length >= 13) {
    const view = new DataView(header.buffer)
    return {
      format: 'gif',
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    }
  }
  if (
    header.length < 33 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => header[index] === byte,
    ) ||
    name(header.slice(12, 16)) !== 'IHDR'
  )
    return null
  const dimensions = new DataView(header.buffer)
  let offset = 8
  let animated = false
  let frames = 0
  let expectedFrames = 0
  let duration = 0
  let complete = false
  while (offset + 12 <= file.size) {
    const chunk = new Uint8Array(
      await file.slice(offset, offset + 8).arrayBuffer(),
    )
    const length = new DataView(chunk.buffer).getUint32(0)
    const type = name(chunk.slice(4, 8))
    if (length > file.size - offset - 12)
      throw new Error('The animated PNG is incomplete. Choose another file.')
    if (type === 'acTL' && length === 8) {
      const data = new DataView(
        await file.slice(offset + 8, offset + 16).arrayBuffer(),
      )
      expectedFrames = data.getUint32(0)
      animated = expectedFrames > 0
    } else if (type === 'fcTL' && animated && length === 26) {
      const data = new DataView(
        await file.slice(offset + 8, offset + 34).arrayBuffer(),
      )
      const numerator = data.getUint16(20)
      const denominator = data.getUint16(22) || 100
      duration += numerator ? numerator / denominator : 1 / 15
      frames++
    } else if (type === 'IDAT' && !animated) return null
    else if (type === 'IEND') {
      complete = true
      break
    }
    offset += length + 12
  }
  if (!animated) return null
  if (!complete || !frames || frames !== expectedFrames)
    throw new Error('The animated PNG is missing frames. Choose another file.')
  return {
    format: 'apng',
    width: dimensions.getUint32(16),
    height: dimensions.getUint32(20),
    duration,
  }
}
