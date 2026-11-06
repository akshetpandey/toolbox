import { createFileRoute, redirect } from '@tanstack/react-router'
import { categoryRedirects } from '@/lib/seo'

export const Route = createFileRoute('/archives/')({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      to: categoryRedirects['/archives'],
    })
  },
})
