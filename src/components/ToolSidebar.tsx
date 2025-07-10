import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Link, useLocation } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useRef, useEffect } from 'react'
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
} from 'lucide-react'

interface ToolCategory {
  name: string
  icon: React.ComponentType<{ className?: string }>
  route: string
  toolMap: Record<string, string>
  underConstructionTools?: string[]
  color: string
  bgColor: string
}

const toolCategories: ToolCategory[] = [
  {
    name: 'Image',
    icon: Image,
    route: '/images',
    toolMap: {
      'Image Metadata': 'metadata',
      'Resize Image': 'resize',
      'Convert Format': 'convert',
      'Compress Image': 'compress',
    },
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    name: 'Video',
    icon: Video,
    route: '/videos',
    toolMap: {
      'Video Metadata': 'metadata',
      'Convert Format': 'convert',
      'Compress Video': 'compress',
      'Trim Video': 'trim',
      'Extract Audio': 'audio',
    },
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    name: 'PDF',
    icon: FileText,
    route: '/pdfs',
    toolMap: {
      Merge: 'merge',
      Split: 'split',
      Compress: 'compress',
    },
    underConstructionTools: ['Split', 'Compress'],
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    name: 'Office Documents',
    icon: Building,
    route: '/office-documents',
    toolMap: {
      'Document to PDF': 'convert',
    },
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
  {
    name: 'Archives',
    icon: Archive,
    route: '/archives',
    toolMap: {
      'Compress Files': 'compress',
      'Extract Archive': 'decompress',
    },
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    name: 'Utilities',
    icon: Settings,
    route: '/utilities',
    toolMap: {
      'File Hash': 'hash',
      'File Metadata': 'metadata',
    },
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
]

export function ToolSidebar() {
  const location = useLocation()
  const { isProcessing } = useProcessing()
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
        behavior: 'auto',
        block: 'center',
      })
    }
  }, [location.pathname, location.search])

  return (
    <div className="w-80 glass border-r border-border/50 h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
            <Hammer className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-heading text-foreground">Toolbox</h2>
        </Link>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="py-2 px-2">
            {/* Tool categories */}
            <div className="flex flex-col gap-2">
              {toolCategories.map((category) => (
                <div key={category.name} className="flex flex-col">
                  {/* Category header */}
                  <Link 
                    to={category.route} 
                    search={{ tab: Object.values(category.toolMap)[0] }}
                    className="w-full"
                  >
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors group cursor-pointer ${
                        isProcessing
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={(e) => {
                        if (isProcessing) {
                          e.preventDefault()
                        }
                      }}
                    >
                      <div
                        className={`w-10 h-10 ${category.bgColor} rounded-xl flex items-center justify-center ${
                          isProcessing ? '' : 'group-hover:scale-110'
                        } transition-transform`}
                      >
                        <category.icon
                          className={`h-5 w-5 ${category.color}`}
                        />
                      </div>
                      <div className="flex-1">
                        <h3
                          className={`font-semibold text-foreground transition-colors ${
                            isProcessing ? '' : 'group-hover:text-primary'
                          }`}
                        >
                          {category.name}
                        </h3>
                      </div>
                    </div>
                  </Link>

                  {/* Tool list */}
                  <div className="ml-13 flex flex-col gap-1">
                    {Object.entries(category.toolMap).map(([tool, tab]) => {
                      const isActive = isToolActive(category.route, tab)
                      const isUnderConstruction =
                        category.underConstructionTools?.includes(tool)

                      return (
                        <div key={tool} ref={isActive ? activeToolRef : null}>
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
                              onClick={(e) => {
                                if (isProcessing) {
                                  e.preventDefault()
                                }
                              }}
                            >
                              <Button
                                variant="ghost"
                                disabled={isProcessing}
                                className={`w-full justify-start h-auto p-2 text-sm transition-all duration-200 rounded-lg ${
                                  isActive
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                } ${
                                  isProcessing
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                }`}
                              >
                                {tool}
                              </Button>
                            </Link>
                          )}
                        </div>
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
