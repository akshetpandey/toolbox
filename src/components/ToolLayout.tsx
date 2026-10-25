import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ShieldCheck } from 'lucide-react'
import { useLocation } from '@tanstack/react-router'
import { allTools } from '@/lib/tools'

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
  fileUploadComponent,
  toolsComponent,
  children,
}: ToolLayoutProps) {
  const { pathname } = useLocation()
  const tool = allTools.find((item) => item.route === pathname)
  const editor = pathname.endsWith('/redact')
  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="shrink-0 border-b border-border bg-card px-4 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto flex max-w-7xl items-start gap-3">
          <div className={`mt-1 rounded-lg bg-muted p-2.5 ${iconColor}`}>
            <Icon aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {tool?.category ?? 'File tools'}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {tool?.name ?? title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tool?.description}
            </p>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            <span>Processed here. Never uploaded.</span>
          </div>
          <div
            className={`grid min-w-0 items-start gap-5 ${editor || !fileUploadComponent ? '' : 'xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.75fr)]'}`}
          >
            {fileUploadComponent && (
              <div className={`min-w-0 ${editor ? 'editor-file-summary' : ''}`}>
                {fileUploadComponent}
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-5">
              {toolsComponent}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
