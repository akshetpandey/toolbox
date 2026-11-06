export const supportedImageFormats = [
  'JPG',
  'PNG',
  'WebP',
  'GIF',
  'HEIC',
  'HEIF',
]
export const acceptedImageTypes =
  'image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif'

export function isHeifImage(file: { name: string; type: string }) {
  return (
    /^image\/hei[cf](?:-sequence)?$/i.test(file.type) ||
    /\.hei[cf]$/i.test(file.name)
  )
}

export function isSupportedImage(file: File) {
  return (
    file.type.startsWith('image/') ||
    /\.(?:jpe?g|png|webp|gif|hei[cf])$/i.test(file.name)
  )
}

export function imageOutputFilename(name: string, blob: Blob) {
  const extension = /\.([^.]+)$/.exec(name)?.[1].toLowerCase() ?? ''
  const expected = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }[blob.type]
  return !expected ||
    extension === expected ||
    (expected === 'jpg' && extension === 'jpeg')
    ? name
    : `${name.replace(/\.[^.]+$/, '')}.${expected}`
}
