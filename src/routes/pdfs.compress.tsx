import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/pdfs/compress')({
  component: PDFCompressRoute,
  head: () => ({
    meta: [
      {
        title: 'PDF Compressor - Free Browser-Based PDF Compression | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based PDF compression tool. Reduce PDF file sizes while maintaining quality. Process PDFs entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'free PDF compressor, reduce PDF size, PDF compression, browser PDF editor, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'PDF Compressor - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based PDF compression. Reduce file sizes while maintaining quality.',
      },
    ],
  }),
})

function PDFCompressRoute() {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-6">
        <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
        <h2 className="text-lg font-semibold">Compress PDFs</h2>
        <p className="text-sm text-muted-foreground">
          This tool is not available yet. You can merge PDF files today.
        </p>
        <Link
          to="/pdfs/merge"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Go to Merge PDFs
        </Link>
      </CardContent>
    </Card>
  )
}
