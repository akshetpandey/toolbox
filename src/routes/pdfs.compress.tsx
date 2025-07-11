import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Minimize } from 'lucide-react'

export const Route = createFileRoute('/pdfs/compress')({
  component: PDFCompressRoute,
})

function PDFCompressRoute() {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6">
        <div className="text-center py-12">
          <Minimize className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Compress PDF Tool
          </h3>
          <p className="text-muted-foreground">
            Coming soon! This tool will allow you to compress PDF files to
            reduce their size.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
