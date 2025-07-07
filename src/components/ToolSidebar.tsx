import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Link, useLocation } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useRef, useEffect } from 'react'
import {
  Image,
  Video,
  FileText,
  Hammer,
  Construction,
  Settings,
  Archive,
  Building,
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
    name: 'PDF Tools',
    icon: FileText,
    route: '/pdfs',
    tools: ['Merge', 'Split', 'Compress'],
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    name: 'Office Documents',
    icon: Building,
    route: '/office-documents',
    tools: ['Document to PDF'],
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
  {
    name: 'Archives',
    icon: Archive,
    route: '/archives',
    tools: ['Compress Files', 'Extract Archive'],
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    name: 'Utilities',
    icon: Settings,
    route: '/utilities',
    tools: ['File Hash', 'File Metadata'],
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
]

export function ToolSidebar() {
  const location = useLocation()
  const activeToolRef = useRef<HTMLDivElement>(null)

  // Function to determine if a tool is currently active
  const isToolActive = (categoryRoute: string, toolTab?: string) => {
    if (location.pathname !== categoryRoute) return false
    if (!toolTab) return !location.search?.tab
    return location.search?.tab === toolTab
  }

  // Scroll to active tool when location changes
  useEffect(() => {
    if (activeToolRef.current) {
      activeToolRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [location.pathname, location.search])

  return (
    <div className="w-80 glass border-r border-border/50 h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border/50 flex items-center justify-between shrink-0">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
            <Hammer className="w-4 h-4 text-primary-foreground" />
          </div>
          <h2 className="text-heading text-foreground">Toolbox</h2>
        </Link>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Tool categories */}
            <div className="space-y-2">
              {toolCategories.map((category) => (
                <div key={category.name} className="space-y-1">
                  {/* Category header */}
                  {category.route ? (
                    <Link to={category.route} className="w-full">
                      <div
                        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer ${
                          location.pathname === category.route &&
                          !location.search?.tab
                            ? 'bg-accent/70 border border-primary/20'
                            : ''
                        }`}
                      >
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
                          const isActive = isToolActive(category.route, tab)
                          return (
                            <div
                              key={tool}
                              ref={isActive ? activeToolRef : null}
                            >
                              <Link
                                to={category.route}
                                search={{ tab }}
                                className="w-full"
                              >
                                <Button
                                  variant="ghost"
                                  className={`w-full justify-start h-auto p-2 text-sm transition-all duration-200 rounded-lg ${
                                    isActive
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                  }`}
                                >
                                  {tool}
                                </Button>
                              </Link>
                            </div>
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
                          const isActive = isToolActive(category.route, tab)
                          return (
                            <div
                              key={tool}
                              ref={isActive ? activeToolRef : null}
                            >
                              <Link
                                to={category.route}
                                search={{ tab }}
                                className="w-full"
                              >
                                <Button
                                  variant="ghost"
                                  className={`w-full justify-start h-auto p-2 text-sm transition-all duration-200 rounded-lg ${
                                    isActive
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                  }`}
                                >
                                  {tool}
                                </Button>
                              </Link>
                            </div>
                          )
                        }
                      }

                      // Create tool-specific links for PDF tools
                      if (category.name === 'PDF Tools' && category.route) {
                        const toolMap: Record<string, string> = {
                          Merge: 'merge',
                          Split: 'split',
                          Compress: 'compress',
                        }
                        const tab = toolMap[tool]
                        const underConstructionTools = ['Split', 'Compress']
                        const isUnderConstruction =
                          underConstructionTools.includes(tool)

                        if (tab) {
                          const isActive = isToolActive(category.route, tab)
                          return (
                            <div
                              key={tool}
                              className="w-full"
                              ref={isActive ? activeToolRef : null}
                            >
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
                                    className={`w-full justify-start h-auto p-2 text-sm transition-all duration-200 rounded-lg ${
                                      isActive
                                        ? 'bg-primary/10 text-primary border border-primary/20'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                    }`}
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
                        }
                        const tab = toolMap[tool]
                        if (tab) {
                          const isActive = isToolActive(category.route, tab)
                          return (
                            <div
                              key={tool}
                              ref={isActive ? activeToolRef : null}
                            >
                              <Link
                                to={category.route}
                                search={{ tab }}
                                className="w-full"
                              >
                                <Button
                                  variant="ghost"
                                  className={`w-full justify-start h-auto p-2 text-sm transition-all duration-200 rounded-lg ${
                                    isActive
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                  }`}
                                >
                                  {tool}
                                </Button>
                              </Link>
                            </div>
                          )
                        }
                      }

                      // Create tool-specific links for archive tools
                      if (category.name === 'Archives' && category.route) {
                        const toolMap: Record<string, string> = {
                          'Compress Files': 'compress',
                          'Extract Archive': 'decompress',
                        }
                        const tab = toolMap[tool]
                        if (tab) {
                          const isActive = isToolActive(category.route, tab)
                          return (
                            <div
                              key={tool}
                              ref={isActive ? activeToolRef : null}
                            >
                              <Link
                                to={category.route}
                                search={{ tab }}
                                className="w-full"
                              >
                                <Button
                                  variant="ghost"
                                  className={`w-full justify-start h-auto p-2 text-sm transition-all duration-200 rounded-lg ${
                                    isActive
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                  }`}
                                >
                                  {tool}
                                </Button>
                              </Link>
                            </div>
                          )
                        }
                      }

                      // Create tool-specific links for office tools
                      if (
                        category.name === 'Office Documents' &&
                        category.route
                      ) {
                        const isActive = isToolActive(category.route)
                        return (
                          <div key={tool} ref={isActive ? activeToolRef : null}>
                            <Link to={category.route} className="w-full">
                              <Button
                                variant="ghost"
                                className={`w-full justify-start h-auto p-2 text-sm transition-all duration-200 rounded-lg ${
                                  isActive
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                              >
                                {tool}
                              </Button>
                            </Link>
                          </div>
                        )
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
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
