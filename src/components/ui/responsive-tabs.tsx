import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LucideIcon } from 'lucide-react'

interface TabItem {
  value: string
  label: string
  icon: LucideIcon
  disabled?: boolean
}

interface ResponsiveTabsProps {
  tabs: TabItem[]
  currentTab: string
  onTabChange: (value: string) => void
  isProcessing?: boolean
  className?: string
}

export function ResponsiveTabs({
  tabs,
  currentTab,
  onTabChange,
  isProcessing = false,
  className = '',
}: ResponsiveTabsProps) {
  return (
    <Tabs
      value={currentTab}
      onValueChange={onTabChange}
      className={`w-full ${className}`}
    >
      {/* Mobile: Horizontal scrolling tabs */}
      <div className="lg:hidden relative">
        <TabsList className="w-full flex overflow-x-auto scrollbar-hide gap-1 py-1 justify-start">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={isProcessing || tab.disabled}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap min-w-[100px] px-3 py-2 flex-shrink-0"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Desktop: Grid layout tabs */}
      <TabsList className={`hidden lg:flex w-full`}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={isProcessing || tab.disabled}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
