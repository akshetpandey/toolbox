import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Hammer, Menu, X, ArrowUpRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useProcessing } from '@/contexts/ProcessingContext'
import { toolCategories } from '@/lib/tools'

export function ToolSidebar() {
  const pathname = useLocation().pathname.replace(/\/$/u, '') || '/'
  const { isProcessing } = useProcessing()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  useEffect(() => {
    setOpen(false)
  }, [pathname])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)')
    const onResize = () => {
      if (media.matches) setOpen(false)
    }
    media.addEventListener('change', onResize)
    return () => media.removeEventListener('change', onResize)
  }, [])
  useLayoutEffect(() => {
    const current = sidebar.current?.querySelector('ul [aria-current="page"]')
    const submenu = current?.closest('ul')
    if (!current || !submenu) return
    const reveal = () => {
      if (!submenu.clientHeight) return
      const item = current.getBoundingClientRect()
      const viewport = submenu.getBoundingClientRect()
      submenu.scrollTop +=
        Math.max(0, item.bottom - viewport.bottom) +
        Math.min(0, item.top - viewport.top)
    }
    reveal()
    window.addEventListener('resize', reveal)
    return () => window.removeEventListener('resize', reveal)
  }, [pathname])

  const navigation = (
    <>
      <nav
        aria-label="File tools"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 xl:flex xl:flex-col xl:py-3"
      >
        <p className="shrink-0 px-3 pb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Your toolbox
        </p>
        <div className="space-y-1 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:gap-1 xl:space-y-0">
          {toolCategories.map((category) => {
            const active =
              pathname.startsWith(`${category.path}/`) ||
              pathname === category.path
            const expanded = active && category.tools.length > 1
            return (
              <div
                key={category.path}
                className={
                  expanded ? 'xl:flex xl:min-h-26 xl:flex-col' : 'xl:shrink-0'
                }
              >
                <Link
                  to={category.tools[0].route}
                  aria-disabled={isProcessing || undefined}
                  onClick={(event) => {
                    if (isProcessing) event.preventDefault()
                    else close()
                  }}
                  className={`nav-link flex min-h-12 shrink-0 items-center gap-3 rounded-lg px-3 py-2 font-medium xl:min-h-10 ${active ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  <category.icon
                    aria-hidden="true"
                    className={`size-5 shrink-0 ${category.color}`}
                  />
                  {category.name}
                </Link>
                {expanded && (
                  <ul className="ml-5 space-y-1 border-l border-border pl-3 pb-2 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:[scrollbar-gutter:stable]">
                    {category.tools.map((tool) => (
                      <li key={tool.route}>
                        <Link
                          to={tool.route}
                          aria-current={
                            pathname === tool.route ? 'page' : undefined
                          }
                          aria-disabled={isProcessing || undefined}
                          onClick={(event) => {
                            if (isProcessing) event.preventDefault()
                            else close()
                          }}
                          className={`nav-link flex min-h-11 items-center rounded-lg px-3 py-2 text-sm ${pathname === tool.route ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                        >
                          {tool.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </nav>
      <div className="shrink-0 space-y-4 border-t border-border px-5 py-5 xl:space-y-2 xl:py-3">
        <p className="flex gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Files stay on your device.
        </p>
        <ThemeToggle />
        <a
          href="https://github.com/akshetpandey/toolbox"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Open source on GitHub
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </>
  )
  const brand = (
    <Link
      to="/"
      aria-label="Toolbox home"
      onClick={(event) => {
        if (isProcessing) event.preventDefault()
        else close()
      }}
      className="flex min-h-11 items-center gap-2.5 font-semibold text-xl tracking-tight"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Hammer aria-hidden="true" className="size-5" />
      </span>
      Toolbox
    </Link>
  )
  return (
    <>
      <header className="mobile-app-bar fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 xl:hidden">
        {brand}
        <Button
          variant="outline"
          aria-expanded={open}
          aria-controls="tools-drawer"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" />
          Tools
        </Button>
      </header>
      <aside
        ref={sidebar}
        className="hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card xl:flex"
      >
        <div className="shrink-0 px-6 py-4">{brand}</div>
        {navigation}
      </aside>
      <dialog
        ref={dialog}
        id="tools-drawer"
        aria-labelledby="tools-drawer-title"
        onCancel={close}
        onClose={close}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.target === event.currentTarget &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom)
          )
            close()
        }}
        className="tool-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-80 max-w-[calc(100vw-24px)] border-0 border-r border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="tools-drawer-title" className="text-lg font-semibold">
              Choose a tool
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close tools menu"
              onClick={close}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {navigation}
        </div>
      </dialog>
    </>
  )
}
