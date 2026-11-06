import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUtilities } from '@/contexts/UtilitiesContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { Shield, Check, X, Loader2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/utilities/hash')({
  component: HashGenerationPage,
})

function HashGenerationPage() {
  const {
    selectedFile,
    fileHashes,
    expectedHash,
    setExpectedHash,
    hashProgress,
  } = useUtilities()
  const { isProcessing } = useProcessing()
  const [copyStatus, setCopyStatus] = useState('')
  useEffect(() => {
    setCopyStatus('')
  }, [selectedFile])
  const hashes = fileHashes
    ? [
        { label: 'MD5', value: fileHashes.md5 },
        { label: 'SHA1', value: fileHashes.sha1 },
        { label: 'SHA256', value: fileHashes.sha256 },
      ]
    : []
  const hashError = hashes.some(({ value }) => value === 'Error')
  const normalized = expectedHash.trim().toLowerCase()
  const match =
    normalized && !hashError
      ? hashes.find(({ value }) => value.toLowerCase() === normalized)
      : null

  const copy = async (label: string, value: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setCopyStatus(`${label} copied`)
    } catch {
      setCopyStatus(
        'Copy failed. Select the checksum text and copy it manually.',
      )
    }
  }

  return (
    <Card>
      <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="size-5 text-primary" />
            File checksums
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Copy a checksum or compare it with a value from the file’s source.
          </p>
        </div>
        {selectedFile ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="expected-hash">Expected hash (optional)</Label>
              <Input
                id="expected-hash"
                type="text"
                placeholder="Paste a checksum to compare"
                autoComplete="off"
                spellCheck={false}
                value={expectedHash}
                onChange={(event) => setExpectedHash(event.target.value)}
                aria-describedby="hash-match-status"
              />
              <p
                id="hash-match-status"
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 text-sm"
              >
                {normalized && fileHashes && !hashError ? (
                  match ? (
                    <>
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      Matches {match.label}
                    </>
                  ) : (
                    <>
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                      Does not match any calculated hash
                    </>
                  )
                ) : normalized && !fileHashes ? (
                  'Calculating checksums before comparing…'
                ) : (
                  ''
                )}
              </p>
            </div>
            {hashProgress > 0 && hashProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Generating hashes...</span>
                  <span>{hashProgress}%</span>
                </div>
                <Progress value={hashProgress} aria-label="Checksum progress" />
              </div>
            )}
            {hashError ? (
              <p role="alert" className="text-sm text-destructive">
                Checksums could not be calculated. Choose the file again to
                retry.
              </p>
            ) : fileHashes ? (
              <>
                <div className="divide-y divide-border">
                  {hashes.map(({ label, value }) => (
                    <div
                      key={label}
                      className="min-w-0 space-y-2 py-4 first:pt-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium">{label}</h3>
                        <Button
                          variant="outline"
                          aria-label={`Copy ${label}`}
                          onClick={() => void copy(label, value)}
                        >
                          <Copy className="size-4" />
                          Copy
                        </Button>
                      </div>
                      <p className="select-text break-all rounded-lg bg-muted/40 p-3 font-mono text-sm leading-relaxed">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto sm:self-start"
                  onClick={() =>
                    void copy(
                      'All checksums',
                      hashes
                        .map(({ label, value }) => `${label}: ${value}`)
                        .join('\n'),
                    )
                  }
                >
                  Copy all checksums
                </Button>
              </>
            ) : (
              isProcessing && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Loader2 className="size-4 animate-spin" />
                  Calculating hashes...
                </p>
              )
            )}
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {copyStatus}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a file to generate hashes automatically
          </p>
        )}
      </CardContent>
    </Card>
  )
}
