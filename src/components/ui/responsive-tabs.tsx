import { useId } from 'react'
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
  const id = useId()
  if (tabs.length < 2) return null
  return (
    <div className={`xl:hidden ${className}`}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Tool
      </label>
      <select
        id={id}
        value={currentTab}
        disabled={isProcessing}
        onChange={(event) => onTabChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base focus-ring disabled:opacity-50"
      >
        {tabs.map((tab) => (
          <option key={tab.value} value={tab.value} disabled={tab.disabled}>
            {tab.label}
            {tab.disabled ? ' · Coming soon' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
