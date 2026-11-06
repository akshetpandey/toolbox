import { createFileRoute, redirect } from '@tanstack/react-router'
import { categoryRedirects } from '@/lib/toolPaths'

export const Route = createFileRoute('/utilities/')({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      to: categoryRedirects['/utilities'],
    })
  },
})
