import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Split } from 'lucide-react'

export const Route = createFileRoute('/pdfs/split')({
  component: PDFSplitRoute,
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
