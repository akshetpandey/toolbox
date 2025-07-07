import { Heart, Zap, Shield } from 'lucide-react'

export function Footer() {
  return (
    <div className="text-center border-t border-border/50 py-4">
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
        <span>Made with</span>
        <Heart className="w-4 h-4 text-red-500 fill-current" />
        <span>for the open source community</span>
      </div>

      {/* WebAssembly and Client-side badges */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3 h-3" />
          <span>Powered by WebAssembly</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3 h-3" />
          <span>100% Client-side</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 text-sm">
        <a
          href="https://github.com/akshetpandey/toolbox"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Source Code
        </a>
        <a
          href="https://github.com/akshetpandey/toolbox/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Found an issue?
        </a>
        <a
          href="https://github.com/akshetpandey/toolbox/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Need a tool?
        </a>
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
