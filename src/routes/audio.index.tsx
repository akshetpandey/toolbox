import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/audio/')({
  beforeLoad: () => redirect({ to: '/audio/convert' }),
})
