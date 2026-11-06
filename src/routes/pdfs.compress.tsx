import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { getPage } from '@/lib/seo'

export const Route = createFileRoute('/pdfs/compress')({
  component: PDFCompressRoute,
})

function PDFCompressRoute() {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-6">
        <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
        <p className="text-sm text-muted-foreground">
          {getPage('/pdfs/compress').intro}
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
