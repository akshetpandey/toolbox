import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/office-documents/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/office-documents/convert',
    })
  },
})
