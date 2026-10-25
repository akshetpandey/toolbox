import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/office-documents/')({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      to: '/office-documents/convert',
    })
  },
})
