import { Heart } from 'lucide-react'

export function Footer() {
  return (
    <div className="text-center border-t border-border/50 py-4">
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
        <span>Made with</span>
        <Heart className="w-4 h-4 text-red-500 fill-current" />
        <span>for the open source community</span>
      </div>

      <div className="flex items-center justify-center gap-6 text-sm">
        <a
          href="https://github.com/akshetpandey/toolbox/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          MIT License
        </a>
      </div>
    </div>
  )
}
