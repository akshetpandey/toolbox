import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface ToolLayoutProps {
  title: string
  icon: LucideIcon
  iconColor: string
  iconBgColor: string
  fileUploadComponent: ReactNode
  toolsComponent: ReactNode
  children?: ReactNode
}

export function ToolLayout({
  title,
  icon: Icon,
  iconColor,
  iconBgColor,
  fileUploadComponent,
  toolsComponent,
  children,
}: ToolLayoutProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 ${iconBgColor} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <div>
                <h1 className="text-heading text-foreground">{title}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-4 sm:p-6">
          {/* Mobile: Vertical layout, Desktop: Horizontal layout */}
          <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* File Upload Area - Full width on mobile, 1/3 on desktop */}
            <div className="w-full lg:w-1/3 order-1 lg:order-1">
              {fileUploadComponent}
            </div>

            {/* Tools Area - Full width on mobile, 2/3 on desktop */}
            <div className="w-full lg:w-2/3 order-2 lg:order-2">
              <div className="animate-fade-in">
                <div className="flex flex-col gap-4">
                  {toolsComponent}

                  {/* Tool Content */}
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
