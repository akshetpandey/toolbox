import type { MessageText } from '@/i18n/messages'
import { message, renderMessage } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
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
  const t = useTranslator()
  const {
    selectedFile,
    fileHashes,
    expectedHash,
    setExpectedHash,
    hashProgress,
  } = useUtilities()
  const { isProcessing } = useProcessing()
  const [copyStatus, setCopyStatus] = useState<MessageText>('')
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

  const copy = async (label: string | undefined, value: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setCopyStatus(
        label
          ? message('utilitiesHashCopied', { label })
          : message('utilitiesHashAllCopied'),
      )
    } catch {
      setCopyStatus(message('utilitiesHashCopyFailedSelectTheChecksumText'))
    }
  }

  return (
    <Card>
      <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="size-5 text-primary" />
            {t('utilitiesHashFileChecksums')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('utilitiesHashCopyAChecksumOrCompareIt')}
          </p>
        </div>
        {selectedFile ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="expected-hash">
                {t('utilitiesHashExpectedHashOptional')}
              </Label>
              <Input
                id="expected-hash"
                type="text"
                placeholder={t('utilitiesHashPasteAChecksumToCompare')}
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
                      {t('utilitiesHashMatches') + ' '}
                      {match.label}
                    </>
                  ) : (
                    <>
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                      {t('utilitiesHashDoesNotMatchAnyCalculatedHash')}
                    </>
                  )
                ) : normalized && !fileHashes ? (
                  t('utilitiesHashCalculatingChecksumsBeforeComparing')
                ) : (
                  ''
                )}
              </p>
            </div>
            {hashProgress > 0 && hashProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('utilitiesHashGeneratingHashes')}</span>
                  <span>{hashProgress}%</span>
                </div>
                <Progress
                  value={hashProgress}
                  aria-label={t('utilitiesHashChecksumProgress')}
                />
              </div>
            )}
            {hashError ? (
              <p role="alert" className="text-sm text-destructive">
                {t('utilitiesHashChecksumsCouldNotBeCalculatedChoose')}
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
                          aria-label={t('utilitiesHashCopy', { label })}
                          onClick={() => void copy(label, value)}
                        >
                          <Copy className="size-4" />
                          {t('utilitiesHashCopyText')}
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
                      undefined,
                      hashes
                        .map(({ label, value }) => `${label}: ${value}`)
                        .join('\n'),
                    )
                  }
                >
                  {t('utilitiesHashCopyAllChecksums')}
                </Button>
              </>
            ) : (
              isProcessing && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Loader2 className="size-4 animate-spin" />
                  {t('utilitiesHashCalculatingHashes')}
                </p>
              )
            )}
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {renderMessage(t, copyStatus)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('utilitiesHashSelectAFileToGenerateHashes')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
