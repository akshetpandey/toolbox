declare module 'pandoc-wasm' {
  export const convert: (
    options: Record<string, unknown>,
    stdin: string | null,
    files?: Record<string, string | Blob>,
  ) => Promise<{
    stdout: string
    stderr: string
    warnings: unknown[]
    files: Record<string, string | Blob>
    mediaFiles: Record<string, Blob>
  }>

  export const query: (options: Record<string, unknown>) => unknown
}
