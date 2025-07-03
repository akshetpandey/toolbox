import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  Image,
  Video,
  Zap,
  Shield,
  Home,
  FileText,
  Hammer,
  Construction,
  Settings,
} from 'lucide-react'

const toolCategories = [
  {
    name: 'Image',
    icon: Image,
    route: '/images',
    tools: [
      'Image Metadata',
      'Resize Image',
      'Convert Format',
      'Compress Image',
    ],
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    name: 'Video',
    icon: Video,
    route: '/videos',
    tools: [
      'Video Metadata',
      'Convert Format',
      'Compress Video',
      'Trim Video',
      'Extract Audio',
    ],
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    name: 'Documents',
    icon: FileText,
    route: '/documents',
    tools: ['PDF Merge', 'PDF Split', 'Compress PDF', 'Convert to PDF'],
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    name: 'Utilities',
    icon: Settings,
    route: '/utilities',
    tools: ['File Hash', 'File Metadata', 'EXIF Metadata'],
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  // {
  //   name: 'Archives',
  //   icon: Archive,
  //   tools: [
  //     'Create Archive',
  //     'Extract Archive',
  //     'Compress Files',
  //     'Archive Info',
  //   ],
  //   color: 'text-orange-500',
  //   bgColor: 'bg-orange-500/10',
  // },
  // {
  //   name: 'Hashing',
  //   icon: Hash,
  //   tools: ['MD5 Hash', 'SHA256 Hash', 'File Checksum', 'Compare Hashes'],
  //   color: 'text-red-500',
  //   bgColor: 'bg-red-500/10',
  // },
]

export function ToolSidebar() {
  return (
    <div className="w-80 glass border-r border-border/50 h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
            <Hammer className="w-4 h-4 text-primary-foreground" />
          </div>
          <h2 className="text-heading text-foreground">Toolbox</h2>
        </div>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Home section */}
            <div className="mb-6">
              <Link to="/">
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      Home
                    </h3>
                  </div>
                </div>
              </Link>
            </div>

            {/* Tool categories */}
            <div className="space-y-2">
              {toolCategories.map((category) => (
                <div key={category.name} className="space-y-1">
                  {/* Category header */}
                  {category.route ? (
                    <Link to={category.route} className="w-full">
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer">
                        <div
                          className={`w-10 h-10 ${category.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                        >
                          <category.icon
                            className={`h-5 w-5 ${category.color}`}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {category.name}
                          </h3>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
                      <div
                        className={`w-10 h-10 ${category.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                      >
                        <category.icon
                          className={`h-5 w-5 ${category.color}`}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                      </div>
                    </div>
                  )}

                  {/* Tool list */}
                  <div className="ml-13 space-y-1">
                    {category.tools.map((tool) => {
                      // Create tool-specific links for image tools
                      if (category.name === 'Image' && category.route) {
                        const toolMap: Record<string, string> = {
                          'Resize Image': 'resize',
                          'Convert Format': 'convert',
                          'Compress Image': 'compress',
                          'Image Metadata': 'metadata',
                        }
                        const tab = toolMap[tool]
                        if (tab) {
                          return (
                            <Link
                              key={tool}
                              to={category.route}
                              search={{ tab }}
                              className="w-full"
                            >
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-auto p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
                              >
                                {tool}
                              </Button>
                            </Link>
                          )
                        }
                      }

                      // Create tool-specific links for video tools
                      if (category.name === 'Video' && category.route) {
                        const toolMap: Record<string, string> = {
                          'Convert Format': 'convert',
                          'Compress Video': 'compress',
                          'Extract Audio': 'audio',
                          'Trim Video': 'trim',
                          'Video Metadata': 'metadata',
                        }
                        const tab = toolMap[tool]
                        if (tab) {
                          return (
                            <Link
                              key={tool}
                              to={category.route}
                              search={{ tab }}
                              className="w-full"
                            >
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-auto p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
                              >
                                {tool}
                              </Button>
                            </Link>
                          )
                        }
                      }

                      // Create tool-specific links for document tools
                      if (category.name === 'Documents' && category.route) {
                        const toolMap: Record<string, string> = {
                          'PDF Merge': 'merge',
                          'PDF Split': 'split',
                          'Convert to PDF': 'convert',
                          'Compress PDF': 'compress',
                        }
                        const tab = toolMap[tool]
                        const underConstructionTools = [
                          'PDF Split',
                          'Compress PDF',
                          'Convert to PDF',
                        ]
                        const isUnderConstruction =
                          underConstructionTools.includes(tool)

                        if (tab) {
                          return (
                            <div key={tool} className="w-full">
                              {isUnderConstruction ? (
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start h-auto p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200 cursor-not-allowed opacity-60"
                                  disabled
                                >
                                  <Construction className="w-3 h-3 mr-2" />
                                  {tool}
                                </Button>
                              ) : (
                                <Link
                                  to={category.route}
                                  search={{ tab }}
                                  className="w-full"
                                >
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start h-auto p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
                                  >
                                    {tool}
                                  </Button>
                                </Link>
                              )}
                            </div>
                          )
                        }
                      }

                      // Create tool-specific links for utilities tools
                      if (category.name === 'Utilities' && category.route) {
                        const toolMap: Record<string, string> = {
                          'File Hash': 'hash',
                          'File Metadata': 'metadata',
                          'EXIF Metadata': 'metadata',
                        }
                        const tab = toolMap[tool]
                        if (tab) {
                          return (
                            <Link
                              key={tool}
                              to={category.route}
                              search={{ tab }}
                              className="w-full"
                            >
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-auto p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
                              >
                                {tool}
                              </Button>
                            </Link>
                          )
                        }
                      }

                      return (
                        <Button
                          key={tool}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
                        >
                          {tool}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>Powered by WebAssembly</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Shield className="w-3 h-3" />
                <span>100% Client-side</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
