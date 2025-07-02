import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Sparkles } from 'lucide-react'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export function SearchBar({ onSearch, placeholder = "Search for tools..." }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    onSearch(value)
  }

  const clearSearch = () => {
    setSearchQuery('')
    onSearch('')
  }

  return (
    <div className="relative max-w-3xl mx-auto">
      <div className="relative flex items-center group">
        <div className="absolute left-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          {!searchQuery && !isFocused && (
            <Sparkles className="h-4 w-4 text-primary/60 animate-pulse" />
          )}
        </div>
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="pl-12 pr-12 h-14 text-lg glass border-2 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-2xl shadow-lg hover:shadow-xl"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-2 h-10 w-10 p-0 hover:bg-accent/50 rounded-xl transition-all duration-200"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </div>
      
      {/* Subtle glow effect when focused */}
      {isFocused && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl blur-xl -z-10 animate-pulse" />
      )}
    </div>
  )
} 