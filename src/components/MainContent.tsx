import { useState } from 'react'
import { SearchBar } from './SearchBar'
import { Card, CardContent } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export function MainContent() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <div className="container mx-auto px-8">
          {/* Search Bar */}
          <div className="animate-fade-in max-w-2xl mx-auto">
            <SearchBar
              onSearch={setSearchQuery}
              placeholder="Search tools, upload files, or drag & drop to get started..."
            />
            {searchQuery && (
              <p className="text-center mt-6 text-caption animate-fade-in">
                Searching for:{' '}
                <span className="font-medium text-foreground">
                  "{searchQuery}"
                </span>
              </p>
            )}
          </div>

          {/* Search Results Placeholder */}
          {searchQuery && (
            <Card className="glass-card border-0 animate-fade-in">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-muted flex items-center justify-center">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-subheading text-foreground mb-2">
                  Search in Progress
                </h3>
                <p className="text-body text-muted-foreground">
                  Search functionality will be implemented when individual tools
                  are added.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
