import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Link, useLocation } from '@tanstack/react-router'
import {
  Image,
  Video,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Home,
} from 'lucide-react'

const toolCategories = [
  {
    name: 'Image',
    icon: Image,
    route: '/images',
    description: 'Resize, convert, compress',
    tools: ['Resize Image', 'Convert Format', 'Compress Image'],
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    name: 'Video',
    icon: Video,
    route: '/videos',
    description: 'Convert, compress, trim',
    tools: ['Convert Format', 'Compress Video', 'Trim Video', 'Extract Audio'],
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  // {
  //   name: 'Documents',
  //   icon: FileText,
  //   description: 'PDF, text, compression',
  //   tools: [
  //     'PDF Merge',
  //     'PDF Split',
  //     'Convert to PDF',
  //     'Extract Text',
  //     'Compress PDF',
  //   ],
  //   color: 'text-green-500',
  //   bgColor: 'bg-green-500/10',
  // },
  // {
  //   name: 'Archives',
  //   icon: Archive,
  //   description: 'Create, extract, compress',
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
  //   description: 'MD5, SHA256, checksums',
  //   tools: ['MD5 Hash', 'SHA256 Hash', 'File Checksum', 'Compare Hashes'],
  //   color: 'text-red-500',
  //   bgColor: 'bg-red-500/10',
  // },
]

export function ToolSidebar() {
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  // Default to expanded on home page, collapsed on others
  const [isCollapsed, setIsCollapsed] = useState(!isHomePage)

  // Update collapsed state when route changes
  useEffect(() => {
    setIsCollapsed(!isHomePage)
  }, [isHomePage])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div
      className={`${isCollapsed ? 'w-20' : 'w-80'} glass border-r border-border/50 h-screen transition-all duration-300 ease-in-out flex flex-col ${isCollapsed ? 'cursor-pointer' : ''}`}
      onClick={isCollapsed ? toggleSidebar : undefined}
    >
      {/* Header with toggle button */}
      <div className="p-6 border-b border-border/50 flex items-center justify-between shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <h2 className="text-heading text-foreground">Tools</h2>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-8 p-0 rounded-lg"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className={`${isCollapsed ? 'p-3' : 'p-6'} space-y-6`}>
            {isCollapsed ? (
              // Collapsed view - show only icons
              <div className="space-y-3">
                {/* Home button */}
                <div className="flex flex-col items-center">
                  <Link to="/">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-12 w-12 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl"
                      title="Home"
                    >
                      <Home className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>

                {toolCategories.map((category) => (
                  <div
                    key={category.name}
                    className="flex flex-col items-center"
                  >
                    {category.route ? (
                      <Link to={category.route}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-12 w-12 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl"
                          title={category.name}
                        >
                          <category.icon className="h-5 w-5" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-12 w-12 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl"
                        title={category.name}
                      >
                        <category.icon className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Expanded view - show menu-style navigation
              <>
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
                        <p className="text-xs text-muted-foreground">
                          Dashboard overview
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>

                {/* Tool categories */}
                <div className="space-y-2">
                  {toolCategories.map((category) => (
                    <div key={category.name} className="space-y-1">
                      {/* Category header */}
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
                          <p className="text-xs text-muted-foreground">
                            {category.description}
                          </p>
                        </div>
                        {category.route && (
                          <Link
                            to={category.route}
                            className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                          >
                            Open
                          </Link>
                        )}
                      </div>

                      {/* Tool list */}
                      <div className="ml-13 space-y-1">
                        {category.tools.map((tool) => {
                          // Create tool-specific links for image tools
                          if (category.name === 'Image' && category.route) {
                            const toolMap: Record<string, string> = {
                              'Resize Image': 'resize',
                              'Convert Format': 'convert',
                              'Compress Image': 'compress',
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
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
