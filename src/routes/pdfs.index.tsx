import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/pdfs/')({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      to: '/pdfs/merge',
    })
  },
})
