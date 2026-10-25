import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'

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
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-6">
        <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
        <h2 className="text-lg font-semibold">Split PDFs</h2>
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
