import { describe, test, expect } from 'vitest'
import {
  compatibilityMatrix,
  getCompatibleCodecs,
  isCodecCompatible,
  getCommonResolutions,
  calculateAspectRatio,
  isAspectRatioCompatible,
  getCompatibleResolutions,
  formatOptions,
  videoCodecOptions,
  audioCodecOptions,
} from '../videoToolsUtils'

// ─── Constants ───────────────────────────────────────────────────────────────

describe('formatOptions', () => {
  test('contains expected video formats', () => {
    const values = formatOptions.map((o) => o.value)
    expect(values).toContain('mp4')
    expect(values).toContain('webm')
    expect(values).toContain('mkv')
    expect(values).toContain('avi')
  })

  test('each option has value, label, and description', () => {
    for (const option of formatOptions) {
      expect(option.value).toBeTruthy()
      expect(option.label).toBeTruthy()
      expect(option.description).toBeTruthy()
    }
  })
})

describe('videoCodecOptions', () => {
  test('contains expected codecs', () => {
    const values = videoCodecOptions.map((o) => o.value)
    expect(values).toContain('libx264')
    expect(values).toContain('libx265')
    expect(values).toContain('libvpx-vp9')
  })
})

describe('audioCodecOptions', () => {
  test('contains expected codecs', () => {
    const values = audioCodecOptions.map((o) => o.value)
    expect(values).toContain('aac')
    expect(values).toContain('mp3')
    expect(values).toContain('libopus')
  })
})

// ─── compatibilityMatrix ─────────────────────────────────────────────────────

describe('compatibilityMatrix', () => {
  test('defines video and audio codecs for each format', () => {
    for (const format of Object.keys(compatibilityMatrix)) {
      expect(compatibilityMatrix[format].video).toBeInstanceOf(Array)
      expect(compatibilityMatrix[format].audio).toBeInstanceOf(Array)
      expect(compatibilityMatrix[format].video.length).toBeGreaterThan(0)
      expect(compatibilityMatrix[format].audio.length).toBeGreaterThan(0)
    }
  })

  test('mp4 supports h264 and h265 video, aac and mp3 audio', () => {
    expect(compatibilityMatrix.mp4.video).toContain('libx264')
    expect(compatibilityMatrix.mp4.video).toContain('libx265')
    expect(compatibilityMatrix.mp4.audio).toContain('aac')
    expect(compatibilityMatrix.mp4.audio).toContain('mp3')
  })

  test('webm supports vp9 video and opus audio', () => {
    expect(compatibilityMatrix.webm.video).toContain('libvpx-vp9')
    expect(compatibilityMatrix.webm.audio).toContain('libopus')
  })

  test('mkv supports all codecs', () => {
    expect(compatibilityMatrix.mkv.video).toContain('libx264')
    expect(compatibilityMatrix.mkv.video).toContain('libx265')
    expect(compatibilityMatrix.mkv.video).toContain('libvpx-vp9')
    expect(compatibilityMatrix.mkv.audio).toContain('aac')
    expect(compatibilityMatrix.mkv.audio).toContain('mp3')
    expect(compatibilityMatrix.mkv.audio).toContain('libopus')
  })
})

// ─── getCompatibleCodecs ─────────────────────────────────────────────────────

describe('getCompatibleCodecs', () => {
  test('returns video codecs for a known format', () => {
    const codecs = getCompatibleCodecs('mp4', 'video')
    expect(codecs).toContain('libx264')
    expect(codecs).toContain('libx265')
  })

  test('returns audio codecs for a known format', () => {
    const codecs = getCompatibleCodecs('webm', 'audio')
    expect(codecs).toContain('libopus')
  })

  test('returns empty array for unknown format', () => {
    expect(getCompatibleCodecs('flv', 'video')).toEqual([])
    expect(getCompatibleCodecs('unknown', 'audio')).toEqual([])
  })
})

// ─── isCodecCompatible ──────────────────────────────────────────────────────

describe('isCodecCompatible', () => {
  test('returns true for compatible video codec', () => {
    expect(isCodecCompatible('mp4', 'libx264', 'video')).toBe(true)
    expect(isCodecCompatible('webm', 'libvpx-vp9', 'video')).toBe(true)
  })

  test('returns true for compatible audio codec', () => {
    expect(isCodecCompatible('mp4', 'aac', 'audio')).toBe(true)
    expect(isCodecCompatible('webm', 'libopus', 'audio')).toBe(true)
  })

  test('returns false for incompatible codec', () => {
    expect(isCodecCompatible('mp4', 'libvpx-vp9', 'video')).toBe(false)
    expect(isCodecCompatible('webm', 'aac', 'audio')).toBe(false)
  })

  test('returns false for unknown format', () => {
    expect(isCodecCompatible('flv', 'libx264', 'video')).toBe(false)
  })
})

// ─── calculateAspectRatio ───────────────────────────────────────────────────

describe('calculateAspectRatio', () => {
  test('calculates 16:9 aspect ratio', () => {
    expect(calculateAspectRatio(1920, 1080)).toBeCloseTo(16 / 9, 5)
  })

  test('calculates 4:3 aspect ratio', () => {
    expect(calculateAspectRatio(1024, 768)).toBeCloseTo(4 / 3, 5)
  })

  test('calculates 1:1 aspect ratio', () => {
    expect(calculateAspectRatio(1080, 1080)).toBe(1)
  })

  test('calculates portrait aspect ratio', () => {
    expect(calculateAspectRatio(1080, 1920)).toBeCloseTo(9 / 16, 5)
  })
})

// ─── isAspectRatioCompatible ─────────────────────────────────────────────────

describe('isAspectRatioCompatible', () => {
  test('returns true for identical ratios', () => {
    expect(isAspectRatioCompatible(1.778, 1.778)).toBe(true)
  })

  test('returns true for ratios within default tolerance', () => {
    expect(isAspectRatioCompatible(1.78, 1.77)).toBe(true)
  })

  test('returns false for ratios outside default tolerance', () => {
    expect(isAspectRatioCompatible(1.78, 1.33)).toBe(false) // 16:9 vs 4:3
  })

  test('respects custom tolerance', () => {
    expect(isAspectRatioCompatible(1.78, 1.7, 0.1)).toBe(true)
    expect(isAspectRatioCompatible(1.78, 1.7, 0.01)).toBe(false)
  })
})

// ─── getCommonResolutions ────────────────────────────────────────────────────

describe('getCommonResolutions', () => {
  test('returns a non-empty array', () => {
    const resolutions = getCommonResolutions()
    expect(resolutions.length).toBeGreaterThan(0)
  })

  test('each resolution has value, label, and description', () => {
    for (const res of getCommonResolutions()) {
      expect(res.value).toMatch(/^\d+x\d+$/)
      expect(res.label).toBeTruthy()
      expect(res.description).toBeTruthy()
    }
  })

  test('includes common resolutions', () => {
    const values = getCommonResolutions().map((r) => r.value)
    expect(values).toContain('1920x1080')
    expect(values).toContain('1280x720')
    expect(values).toContain('3840x2160')
  })

  test('includes portrait resolutions', () => {
    const values = getCommonResolutions().map((r) => r.value)
    expect(values).toContain('1080x1920')
    expect(values).toContain('720x1280')
  })

  test('includes square resolutions', () => {
    const values = getCommonResolutions().map((r) => r.value)
    expect(values).toContain('1080x1080')
    expect(values).toContain('720x720')
  })
})

// ─── getCompatibleResolutions ────────────────────────────────────────────────

describe('getCompatibleResolutions', () => {
  test('filters resolutions smaller than source for 1080p 16:9', () => {
    const resolutions = getCompatibleResolutions(1920, 1080)
    const values = resolutions.map((r) => r.value)

    // Should include smaller 16:9 resolutions
    expect(values).toContain('1280x720')
    expect(values).toContain('854x480')
    expect(values).toContain('640x360')

    // Should NOT include 4K (larger)
    expect(values).not.toContain('3840x2160')
    expect(values).not.toContain('2560x1440')

    // Should NOT include 4:3 or portrait (different aspect ratio)
    expect(values).not.toContain('1024x768')
    expect(values).not.toContain('1080x1920')
  })

  test('filters resolutions for portrait video', () => {
    const resolutions = getCompatibleResolutions(1080, 1920)
    const values = resolutions.map((r) => r.value)

    expect(values).toContain('720x1280')
    expect(values).not.toContain('1920x1080')
  })

  test('filters resolutions for square video', () => {
    const resolutions = getCompatibleResolutions(1080, 1080)
    const values = resolutions.map((r) => r.value)

    expect(values).toContain('720x720')
    expect(values).toContain('480x480')
    expect(values).not.toContain('1920x1080')
  })

  test('returns empty for very small source video', () => {
    const resolutions = getCompatibleResolutions(100, 56)
    expect(resolutions.length).toBe(0)
  })

  test('all returned resolutions are not larger than source', () => {
    const resolutions = getCompatibleResolutions(1920, 1080)
    for (const res of resolutions) {
      const [w, h] = res.value.split('x').map(Number)
      expect(w).toBeLessThanOrEqual(1920)
      expect(h).toBeLessThanOrEqual(1080)
    }
  })
})
