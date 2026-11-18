import { useLocation, useNavigate } from '@tanstack/react-router'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { getToolCatalog } from '@/lib/toolCatalog'

export function PDFNavigation() {
  const t = useTranslator()
  const tabs = getToolCatalog(t)
    .tools.filter((tool) => tool.categoryPath === '/pdfs')
    .map(({ route, name, icon }) => ({ value: route, label: name, icon }))
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
