import { createFileRoute, redirect } from '@tanstack/react-router'
import { categoryRedirects } from '@/lib/toolPaths'

export const Route = createFileRoute('/office-documents/')({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      to: categoryRedirects['/office-documents'],
    })
  },
})
