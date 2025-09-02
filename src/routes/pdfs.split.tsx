import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Split } from 'lucide-react'

export const Route = createFileRoute('/pdfs/split')({
  component: PDFSplitRoute,
  head: () => ({
    meta: [
      {
        title: 'PDF Splitter - Free Browser-Based PDF Splitting Tool | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based PDF splitter. Split PDF files into separate documents or extract specific pages. Process PDFs entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'free PDF splitter, split PDF pages, extract PDF pages, browser PDF editor, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'PDF Splitter - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based PDF splitter. Split PDFs into separate documents with complete privacy.',
      },
    ],
  }),
})

function PDFSplitRoute() {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6">
        <div className="text-center py-12">
          <Split className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Split PDF Tool
          </h3>
          <p className="text-muted-foreground">
            Coming soon! This tool will allow you to split PDF files into
            separate PDFs.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
