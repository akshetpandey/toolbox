import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUtilities } from '@/contexts/UtilitiesContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { Shield, Check, X, Loader2 } from 'lucide-react'

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

  const getHashMatch = () => {
    if (!expectedHash || !fileHashes) return null
    const normalizedExpected = expectedHash.toLowerCase().trim()

    if (normalizedExpected === fileHashes.md5.toLowerCase())
      return { type: 'MD5', matches: true }
    if (normalizedExpected === fileHashes.sha1.toLowerCase())
      return { type: 'SHA1', matches: true }
    if (normalizedExpected === fileHashes.sha256.toLowerCase())
      return { type: 'SHA256', matches: true }

    return { type: 'None', matches: false }
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">File Hashes</h3>
        </div>

        {selectedFile && (
          <div className="flex flex-col gap-4">
            {/* Expected Hash Input */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="expected-hash" className="text-sm font-medium">
                Expected Hash (Optional)
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="expected-hash"
                  type="text"
                  placeholder="Enter expected hash for verification"
                  value={expectedHash}
                  onChange={(e) => setExpectedHash(e.target.value)}
                  className="flex-1"
                />
                {expectedHash && fileHashes && getHashMatch() && (
                  <div className="flex items-center gap-2">
                    {getHashMatch()?.matches ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <Check className="h-4 w-4" />
                        <span className="text-xs">{getHashMatch()?.type}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <X className="h-4 w-4" />
                        <span className="text-xs">No match</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Hash Progress */}
            {hashProgress > 0 && hashProgress < 100 && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span>Generating hashes...</span>
                  <span>{hashProgress}%</span>
                </div>
                <Progress value={hashProgress} className="w-full h-2" />
              </div>
            )}

            {/* Hash Results */}
            {fileHashes && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 text-sm bg-muted/50 p-4 rounded-lg">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                    <span className="text-muted-foreground font-medium">
                      MD5:
                    </span>
                    <span className="font-mono text-xs bg-background p-1 rounded break-all">
                      {fileHashes.md5}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                    <span className="text-muted-foreground font-medium">
                      SHA1:
                    </span>
                    <span className="font-mono text-xs bg-background p-1 rounded break-all">
                      {fileHashes.sha1}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                    <span className="text-muted-foreground font-medium">
                      SHA256:
                    </span>
                    <span className="font-mono text-xs bg-background p-1 rounded break-all">
                      {fileHashes.sha256}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Loading state */}
            {isProcessing && !fileHashes && (
              <div className="flex items-center justify-center h-32">
                <div className="text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm">Calculating hashes...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedFile && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">
                Select a file to generate hashes automatically
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
