import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowDown, ArrowUp, FileImage, Trash2 } from 'lucide-react'
import { arrayMove } from '@dnd-kit/sortable'
import { FileUpload } from '@/components/FileUpload'
import { ToolLayout } from '@/components/ToolLayout'
import { PDFAction } from '@/components/PDFAction'
import { PDFNavigation } from '@/components/PDFNavigation'
import { Button, Label } from '@/components/ui'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { imagesToPDF } from '@/lib/pdf-edit'

export const Route = createFileRoute('/pdfs/from-images')({
  component: ImagesToPDFRoute,
})

function ImagesToPDFRoute() {
  const { isProcessing } = useProcessing()
  const [images, setImages] = useWorkspaceState<{ id: string; file: File }[]>(
    'pdfs.photos.files',
    [],
  )
  const [layout, setLayout] = useWorkspaceState<'photo' | 'a4' | 'letter'>(
    'pdfs.photos.layout',
    'photo',
  )
  const [selectionError, setSelectionError] = useState('')
  const reset = () => {
    setImages([])
    setSelectionError('')
    invalidateWorkspaceState(['pdfs.photos.layout', 'result.pdfs.from-images'])
  }
  return (
    <ToolLayout
      title="Images to PDF"
      icon={FileImage}
      iconColor="text-primary"
      iconBgColor="bg-primary/10"
      navigationComponent={<PDFNavigation />}
      fileUploadComponent={
        <FileUpload
          selectedFiles={images.map(({ file }) => ({
            name: file.name,
            size: file.size,
          }))}
          onFileSelect={(files) => {
            const added = Array.from(files).filter(
              (file) =>
                ['image/jpeg', 'image/png'].includes(file.type) ||
                /\.(jpe?g|png)$/i.test(file.name),
            )
            if (added.length)
              setImages((current) => [
                ...current,
                ...added.map((file) => ({ id: crypto.randomUUID(), file })),
              ])
            setSelectionError(
              added.length === files.length ? '' : 'Choose JPG or PNG images.',
            )
          }}
          onClearFiles={reset}
          title="Choose your images"
          description="Add a JPG or PNG for each page."
          acceptedTypes="image/jpeg,image/png,.jpg,.jpeg,.png"
          supportedFormats={['JPG', 'PNG']}
          selectedActionLabel="Add images"
          multiple
          disabled={isProcessing}
        >
          <ol aria-label="Image order" className="space-y-2">
            {images.map(({ id, file }, index) => (
              <li key={id} className="rounded-md border p-2">
                <p className="break-all px-1 text-sm font-medium">
                  {index + 1}. {file.name}
                </p>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Move ${file.name} up`}
                    disabled={isProcessing || index === 0}
                    onClick={() =>
                      setImages(arrayMove(images, index, index - 1))
                    }
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Move ${file.name} down`}
                    disabled={isProcessing || index === images.length - 1}
                    onClick={() =>
                      setImages(arrayMove(images, index, index + 1))
                    }
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive"
                    aria-label={`Remove ${file.name}`}
                    disabled={isProcessing}
                    onClick={() =>
                      setImages(images.filter((image) => image.id !== id))
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </FileUpload>
      }
    >
      {selectionError && (
        <p role="alert" className="text-sm text-destructive">
          {selectionError}
        </p>
      )}
      <PDFAction
        file={images.at(0)?.file}
        sourceKey={JSON.stringify([images.map((image) => image.id), layout])}
        name="pdfs.from-images"
        label="Create PDF and download"
        onReset={reset}
        run={async (signal) => ({
          blob: await imagesToPDF(
            images.map((image) => image.file),
            layout,
            signal,
          ),
          filename: 'images.pdf',
          details: [
            `${images.length} ${images.length === 1 ? 'page' : 'pages'}`,
          ],
        })}
      >
        <h2 className="text-lg font-semibold">Put your images in one PDF</h2>
        <p className="text-sm text-muted-foreground">
          Use the arrows to arrange the images. Each image goes on its own page.
        </p>
        <div className="space-y-2">
          <Label htmlFor="image-pdf-page-size">Page size</Label>
          <select
            id="image-pdf-page-size"
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={layout}
            onChange={(event) =>
              setLayout(event.target.value as 'photo' | 'a4' | 'letter')
            }
          >
            <option value="photo">Fit each image</option>
            <option value="a4">A4</option>
            <option value="letter">US Letter</option>
          </select>
        </div>
      </PDFAction>
    </ToolLayout>
  )
}
