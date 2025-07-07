import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Github,
  Zap,
  Shield,
  Globe,
  Heart,
  Hammer,
  Bug,
  MessageCircle,
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
    description:
      'Leverages WebAssembly for the fastest possible performance on a browser',
  },
  {
    icon: Shield,
    title: 'Built on Open Source',
    description:
      'Powered by the best OSS projects: FFmpeg, ImageMagick, 7z, pdf-lib, ExifTool, and libmagic',
  },
]

export function MainContent() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-8 py-12">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto mb-16 animate-fade-in">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
                <Hammer className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-display text-foreground">Toolbox</h1>
            </div>

            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              A powerful web application for transforming your files. Process
              images, videos, and documents entirely in your browser with
              professional-grade tools powered by WebAssembly.
            </p>

            <div className="flex items-center justify-center gap-4">
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
          <div className="mb-16">
            <div className="text-center mb-8">
              <p className="text-muted-foreground">
                Built with privacy and performance in mind
              </p>
            </div>

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

          {/* Footer */}
          <div className="text-center border-t border-border/50 pt-8">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-red-500 fill-current" />
              <span>for the open source community</span>
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
