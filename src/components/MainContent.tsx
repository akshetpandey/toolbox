import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Image,
  Video,
  FileText,
  Github,
  Zap,
  Shield,
  Globe,
  ArrowRight,
  Heart,
  Hammer,
} from 'lucide-react'

const toolCategories = [
  {
    name: 'Image Tools',
    description: 'Transform and optimize images',
    icon: Image,
    route: '/images',
    color: 'text-blue-500',
    gradient: 'from-blue-500/10 to-blue-600/5',
  },
  {
    name: 'Video Tools',
    description: 'Process and convert videos',
    icon: Video,
    route: '/videos',
    color: 'text-purple-500',
    gradient: 'from-purple-500/10 to-purple-600/5',
  },
  {
    name: 'Document Tools',
    description: 'Manipulate PDF documents',
    icon: FileText,
    route: '/documents',
    color: 'text-green-500',
    gradient: 'from-green-500/10 to-green-600/5',
  },
]

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
      'Leverages WebAssembly for near-native performance using FFmpeg and ImageMagick',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description:
      'No uploads, no tracking, no data collection - completely offline capable',
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
              A powerful, privacy-focused web application for transforming your
              files. Process images, videos, and documents entirely in your
              browser with professional-grade tools powered by WebAssembly.
            </p>

            <div className="flex items-center justify-center">
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
            </div>
          </div>

          {/* Tool Categories */}
          <div className="mb-16">
            <div className="grid md:grid-cols-3 gap-4">
              {toolCategories.map((category) => (
                <Link
                  key={category.name}
                  to={category.route}
                  search={{ tab: undefined }}
                  className="group"
                >
                  <Card className="glass-card border-0 hover:shadow-lg transition-all duration-300 group-hover:scale-[1.02]">
                    <CardContent className="p-4">
                      <div
                        className={`w-10 h-10 bg-gradient-to-br ${category.gradient} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                      >
                        <category.icon
                          className={`h-5 w-5 ${category.color}`}
                        />
                      </div>

                      <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>

                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                        {category.description}
                      </p>

                      <div className="flex items-center text-sm text-primary group-hover:gap-2 transition-all">
                        <span>Open</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
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
                href="https://github.com/akshetpandey/toolbox"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a
                href="https://github.com/akshetpandey/toolbox/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Report Issues
              </a>
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
