import { useLocation, useNavigate } from '@tanstack/react-router'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { useProcessing } from '@/contexts/ProcessingContext'
import { allTools } from '@/lib/tools'

const tabs = allTools
  .filter((tool) => tool.category === 'PDFs')
  .map(({ route, name, icon }) => ({ value: route, label: name, icon }))

export function PDFNavigation() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isProcessing } = useProcessing()

  return (
    <ResponsiveTabs
      tabs={tabs}
      currentTab={pathname.replace(/\/$/u, '')}
      isProcessing={isProcessing}
      onTabChange={(value) => {
        const tab = tabs.find((item) => item.value === value)
        if (tab && !isProcessing) void navigate({ to: tab.value })
      }}
    />
  )
}
