import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/videos/')({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      to: '/videos/metadata',
    })
  },
})
