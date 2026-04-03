import { readFileSync } from 'fs'
import { resolve } from 'path'

const fixturesDir = resolve(__dirname, 'fixtures')

/** Read a fixture file as a Uint8Array */
export function readFixture(filename: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(fixturesDir, filename)))
}

/** Create a File object from a fixture */
export function createFixtureFile(filename: string, mimeType: string): File {
  const data = readFixture(filename)
  return new File([data.buffer as ArrayBuffer], filename, { type: mimeType })
}

/** Create a File object from arbitrary content */
export function createTestFile(
  name: string,
  content: string | Uint8Array,
  type: string,
): File {
  const part: BlobPart =
    typeof content === 'string' ? content : (content.buffer as ArrayBuffer)
  return new File([part], name, { type })
}

/** Commonly used test files */
export const fixtures = {
  png: () => createFixtureFile('sample.png', 'image/png'),
  jpg: () => createFixtureFile('sample.jpg', 'image/jpeg'),
  pdf: () => createFixtureFile('sample.pdf', 'application/pdf'),
  txt: () => createFixtureFile('sample.txt', 'text/plain'),
}
