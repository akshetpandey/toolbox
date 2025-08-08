import { createFileRoute } from '@tanstack/react-router'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Github,
  Zap,
  Shield,
  Globe,
  Hammer,
  Bug,
  MessageCircle,
  Heart,
  Calendar,
} from 'lucide-react'

const features = [
  {
    icon: Globe,
    title: 'Client-Side Processing',
    description:
      'All processing happens in your browser - your files never leave your device',
  },
  {
    icon: Zap,
    title: 'Powered by WASM',
    description: 'Leverages WebAssembly for fast performance on your browser',
  },
  {
    icon: Shield,
    title: 'Built on Open Source',
    description:
      'Powered by FFmpeg, ImageMagick, 7z, pdf-lib, ExifTool, libmagic, Pandoc, and, more',
  },
]

const changelog = [
  {
    date: 'Aug 7',
    entries: ['Added metadata stripping for enhanced privacy'],
  },
  {
    date: 'Jul 11',
    entries: ['Added image redaction tool for privacy protection'],
  },
  {
    date: 'Jul 7',
    entries: ['Added office document to PDF conversion'],
  },
  {
    date: 'Jul 6',
    entries: ['Added archive compression and extraction support'],
  },
  {
    date: 'Jul 3',
    entries: ['Added utilities section with file hashing and metadata tools'],
  },
  {
    date: 'Jul 2',
    entries: [
      'Added EXIF data viewing for images',
      'Added PDF merge tool with reordering capability',
      'Added basic video tools (convert, trim, metadata)',
      'Added basic image tools (convert, resize, compress)',
    ],
  },
]

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 sm:px-8 py-8">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto mb-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
                <Hammer className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-display text-foreground">Toolbox</h1>
            </div>

            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Process files entirely in your browser. Built with privacy and
              performance in mind.
              <br />
              No signup, no ads, no tracking. Your files are never uploaded to
              our servers.
            </p>

            <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-xl"
              >
                <a
                  href="https://github.com/akshetpandey/toolbox"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="w-4 h-4 mr-2" />
                  View on GitHub
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-xl"
              >
                <a
                  href="https://github.com/akshetpandey/toolbox/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Bug className="w-4 h-4 mr-2" />
                  Report Issue
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-xl"
              >
                <a
                  href="https://github.com/akshetpandey/toolbox/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Request Tool
                </a>
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <div className="mb-8">
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature) => (
                <Card key={feature.title} className="flat-card border-0">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-subheading text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Changelog Section */}
          <div className="mb-8">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  Recent Updates
                </h2>
              </div>
            </div>

            <div className="max-w-2xl mx-auto">
              <Card className="flat-card border-0">
                <CardContent className="p-4">
                  <div className="h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                    <div className="space-y-3">
                      {changelog.map((entry, index) => (
                        <div key={index} className="space-y-1">
                          <div className="text-xs text-primary/60 font-mono font-medium">
                            {entry.date}
                          </div>
                          <div className="space-y-1 ml-2">
                            {entry.entries.map((item, itemIndex) => (
                              <div
                                key={itemIndex}
                                className="text-sm text-muted-foreground flex items-center gap-2"
                              >
                                <span className="text-primary flex-shrink-0">
                                  •
                                </span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t border-border/50 py-8 mt-16">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4 flex-nowrap">
              <span className="whitespace-nowrap">Made with</span>
              <Heart className="w-4 h-4 text-red-500 fill-current flex-shrink-0" />
              <span className="whitespace-nowrap">
                for the open source community
              </span>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm">
              <a
                href="https://github.com/akshetpandey/toolbox/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                MIT License
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
