import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/images/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/images/metadata',
    })
  },
})
