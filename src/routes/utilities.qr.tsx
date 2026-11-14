import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui'
import { useFileOperation } from '@/contexts/FileOperation'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { generateQRCode, type QRSettings } from '@/lib/qr'
import { downloadBlob } from '@/lib/shared'

export const Route = createFileRoute('/utilities/qr')({ component: QRCodePage })

const defaults: QRSettings = {
  type: 'url',
  content: '',
  ssid: '',
  password: '',
  security: 'WPA',
  hidden: false,
  format: 'png',
}

function QRCodePage() {
  const [settings, setSettings] = useWorkspaceState('qr.settings', defaults)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(
    null,
  )
  const { isProcessing } = useProcessing()
  const begin = useFileOperation(undefined)
  const { result, setResult } = useToolResult(JSON.stringify(settings), 'qr')
  useEffect(() => {
    if (!result) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(result.blob)
    setPreview({ blob: result.blob, url })
    return () => URL.revokeObjectURL(url)
  }, [result])

  function change(update: Partial<QRSettings>) {
    setError('')
    setSettings((previous) => ({ ...previous, ...update }))
  }

  async function generate() {
    if (isProcessing) return
    const operation = begin()
    setError('')
    setResult(null)
    try {
      const blob = await generateQRCode(settings)
      if (!operation.isCurrent()) return
      const filename = `qr-code.${settings.format}`
      setResult({
        blob,
        filename,
        details: ['Static QR code · scan to read the encoded content'],
      })
      downloadBlob(blob, filename)
    } catch (cause) {
      if (operation.isCurrent())
        setError(
          cause instanceof Error
            ? cause.message
            : 'The QR code could not be created.',
        )
    } finally {
      operation.finish()
    }
  }

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="grid gap-6 p-4 sm:p-6 md:grid-cols-2">
          <fieldset disabled={isProcessing} className="min-w-0 space-y-4">
            <legend className="mb-4 text-lg font-semibold">
              Create a QR code
            </legend>
            <div className="space-y-2">
              <Label htmlFor="qr-type">Code type</Label>
              <select
                id="qr-type"
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={settings.type}
                onChange={(event) =>
                  change({ type: event.target.value as QRSettings['type'] })
                }
              >
                <option value="url">Website address</option>
                <option value="text">Text</option>
                <option value="wifi">Wi-Fi network</option>
              </select>
            </div>
            {settings.type === 'wifi' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="qr-ssid">Network name (SSID)</Label>
                  <Input
                    id="qr-ssid"
                    autoComplete="off"
                    value={settings.ssid}
                    maxLength={128}
                    onChange={(event) => change({ ssid: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qr-security">Wi-Fi security</Label>
                  <select
                    id="qr-security"
                    className="min-h-11 w-full rounded-md border bg-background px-3"
                    value={settings.security}
                    onChange={(event) =>
                      change({
                        security: event.target.value as QRSettings['security'],
                      })
                    }
                  >
                    <option value="WPA">WPA / WPA2 / WPA3 personal</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">No password</option>
                  </select>
                </div>
                {settings.security !== 'nopass' && (
                  <div className="space-y-2">
                    <Label htmlFor="qr-password">Network password</Label>
                    <Input
                      id="qr-password"
                      type="password"
                      autoComplete="off"
                      value={settings.password}
                      maxLength={256}
                      onChange={(event) =>
                        change({ password: event.target.value })
                      }
                    />
                  </div>
                )}
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.hidden}
                    onChange={(event) =>
                      change({ hidden: event.target.checked })
                    }
                  />
                  Hidden network
                </label>
                <p className="text-sm text-muted-foreground">
                  Anyone who scans this code can read the network credentials.
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="qr-content">
                  {settings.type === 'url'
                    ? 'Website address'
                    : 'Text to encode'}
                </Label>
                <textarea
                  id="qr-content"
                  rows={4}
                  maxLength={2500}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    settings.type === 'url'
                      ? 'https://example.com'
                      : 'Enter your text'
                  }
                  className="w-full rounded-md border bg-background p-3 text-base"
                  value={settings.content}
                  onChange={(event) => change({ content: event.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="qr-format">Download format</Label>
              <select
                id="qr-format"
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={settings.format}
                onChange={(event) =>
                  change({ format: event.target.value as QRSettings['format'] })
                }
              >
                <option value="png">PNG — 1024 × 1024</option>
                <option value="svg">SVG — scalable for printing</option>
              </select>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="w-full sm:w-auto"
              disabled={isProcessing}
              onClick={() => void generate()}
            >
              Generate and download QR code
            </Button>
          </fieldset>
          <div className="flex min-h-56 min-w-0 items-center justify-center rounded-lg border bg-muted/30 p-4">
            {result && preview?.blob === result.blob ? (
              <img
                src={preview.url}
                alt="Generated QR code"
                className="aspect-square w-full max-w-80 bg-white"
              />
            ) : (
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                Your QR code preview will appear here. Scan the downloaded code
                to check it before printing.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <ResultCard
        result={result}
        disabled={isProcessing}
        onReset={() => {
          invalidateWorkspaceState(['qr.', 'result.qr'])
          setError('')
        }}
      />
    </>
  )
}
