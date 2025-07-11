import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Link, useLocation } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useRef, useState, useEffect } from 'react'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  Image,
  Video,
  FileText,
  Hammer,
  Construction,
  Settings,
  Archive,
  Building,
  // Tool icons
  Info,
  Maximize,
  Zap,
  Eye,
  Scissors,
  Volume2,
  Package,
  FileArchive,
  Merge,
  Split,
  Minimize,
  Hash,
  // UI icons
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface ToolItem {
  name: string
  route: string
  icon: React.ComponentType<{ className?: string }>
  underConstruction?: boolean
}

interface ToolCategory {
  name: string
  icon: React.ComponentType<{ className?: string }>
  route: string
  tools: ToolItem[]
  color: string
  bgColor: string
}

const toolCategories: ToolCategory[] = [
  {
    name: 'Image',
    icon: Image,
    route: '/images',
    tools: [
      { name: 'Image Metadata', route: '/images/metadata', icon: Info },
      { name: 'Resize Image', route: '/images/resize', icon: Maximize },
      { name: 'Convert Format', route: '/images/convert', icon: Settings },
      { name: 'Compress Image', route: '/images/compress', icon: Zap },
      { name: 'Redact Image', route: '/images/redact', icon: Eye },
    ],
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    name: 'Video',
    icon: Video,
    route: '/videos',
    tools: [
      { name: 'Video Metadata', route: '/videos/metadata', icon: Info },
      { name: 'Convert Format', route: '/videos/convert', icon: Settings },
      { name: 'Compress Video', route: '/videos/compress', icon: Zap },
      { name: 'Trim Video', route: '/videos/trim', icon: Scissors },
      { name: 'Extract Audio', route: '/videos/extract', icon: Volume2 },
    ],
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    name: 'PDF',
    icon: FileText,
    route: '/pdfs',
    tools: [
      { name: 'Merge', route: '/pdfs/merge', icon: Merge },
      {
        name: 'Split',
        route: '/pdfs/split',
        icon: Split,
        underConstruction: true,
      },
      {
        name: 'Compress',
        route: '/pdfs/compress',
        icon: Minimize,
        underConstruction: true,
      },
    ],
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    name: 'Office Documents',
    icon: Building,
    route: '/office-documents',
    tools: [
      {
        name: 'Document to PDF',
        route: '/office-documents/convert',
        icon: FileText,
      },
    ],
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
  {
    name: 'Archives',
    icon: Archive,
    route: '/archives',
    tools: [
      { name: 'Compress Files', route: '/archives/compress', icon: Package },
      {
        name: 'Extract Archive',
        route: '/archives/extract',
        icon: FileArchive,
      },
    ],
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    name: 'Utilities',
    icon: Settings,
    route: '/utilities',
    tools: [
      { name: 'File Hash', route: '/utilities/hash', icon: Hash },
      { name: 'File Metadata', route: '/utilities/metadata', icon: Info },
    ],
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
]

export function ToolSidebar() {
  const location = useLocation()
  const { isProcessing } = useProcessing()
  const activeToolRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Check if mobile on mount and set collapsed state accordingly
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768 // Tailwind's md breakpoint
      setIsCollapsed(isMobile)
    }

    checkMobile()

    // Optional: Listen to window resize events to adjust dynamically
    window.addEventListener('resize', checkMobile)

    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // Function to determine if a tool is currently active
  const isToolActive = (toolRoute: string) => {
    return location.pathname === toolRoute
  }

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div
      className={`glass border-r border-border/50 h-screen flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Header */}
      <div
        className={`border-b border-border/50 shrink-0 ${
          isCollapsed ? 'p-2' : 'p-4'
        }`}
      >
        <div className="flex flex-col gap-3">
          {/* First row: Logo/Title */}
          <div
            className={`flex items-center ${
              isCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div
                className={`${
                  isCollapsed ? 'w-8 h-8' : 'w-12 h-12'
                } bg-gradient-to-br from-primary/20 to-primary/10 ${
                  isCollapsed ? 'rounded-xl' : 'rounded-2xl'
                } flex items-center justify-center`}
              >
                <Hammer
                  className={`${
                    isCollapsed ? 'w-4 h-4' : 'w-6 h-6'
                  } text-primary`}
                />
              </div>
              {!isCollapsed && (
                <h2 className="text-heading text-foreground">Toolbox</h2>
              )}
            </Link>
          </div>

          {/* Second row: Collapse Button and Theme Toggle */}
          <div className="pl-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="h-8 w-8 p-0 hover:bg-accent/50"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            {!isCollapsed && <ThemeToggle />}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className={`py-2 ${isCollapsed ? 'px-1' : 'px-2'}`}>
            {/* Tool categories */}
            <div className="flex flex-col gap-2">
              {toolCategories.map((category) => (
                <div key={category.name} className="flex flex-col">
                  {/* Category header */}
                  <Link to={category.route} className="w-full">
                    <div
                      className={`flex items-center rounded-lg transition-colors group cursor-pointer ${
                        isCollapsed ? 'p-2 justify-center' : 'gap-3 p-3'
                      } ${
                        isProcessing
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={(e) => {
                        if (isProcessing) {
                          e.preventDefault()
                        }
                      }}
                      title={isCollapsed ? category.name : ''}
                    >
                      <div
                        className={`${isCollapsed ? 'w-8 h-8' : 'w-10 h-10'} ${category.bgColor} rounded-xl flex items-center justify-center ${
                          isProcessing ? '' : 'group-hover:scale-110'
                        } transition-transform`}
                      >
                        <category.icon
                          className={`${isCollapsed ? 'h-4 w-4' : 'h-5 w-5'} ${category.color}`}
                        />
                      </div>
                      {!isCollapsed && (
                        <div className="flex-1">
                          <h3
                            className={`font-semibold text-foreground transition-colors ${
                              isProcessing ? '' : 'group-hover:text-primary'
                            }`}
                          >
                            {category.name}
                          </h3>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Tool list */}
                  {!isCollapsed && (
                    <div className="ml-12 flex flex-col gap-1">
                      {category.tools.map((tool) => {
                        const isActive = isToolActive(tool.route)

                        return (
                          <div
                            key={tool.name}
                            ref={isActive ? activeToolRef : null}
                          >
                            {tool.underConstruction ? (
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-auto p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg cursor-not-allowed opacity-60"
                                disabled
                              >
                                <Construction className="w-3 h-3 mr-2" />
                                {tool.name}
                              </Button>
                            ) : (
                              <Link
                                to={tool.route}
                                className="w-full"
                                onClick={(e) => {
                                  if (isProcessing) {
                                    e.preventDefault()
                                  }
                                }}
                              >
                                <Button
                                  variant="ghost"
                                  disabled={isProcessing}
                                  className={`w-full justify-start h-auto p-2 text-sm rounded-lg ${
                                    isActive
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                  } ${
                                    isProcessing
                                      ? 'opacity-50 cursor-not-allowed'
                                      : 'cursor-pointer'
                                  }`}
                                >
                                  <tool.icon className="w-3 h-3 mr-2" />
                                  {tool.name}
                                </Button>
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
