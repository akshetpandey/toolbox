declare module 'wasm-pandoc' {
  export const pandoc: (
    args: string,
    input: Blob,
    additionalFiles: Blob[],
  ) => Promise<{
    out: Blob | string
    mediaFiles: Map<string, Map<string, Blob>>
  }>
}
