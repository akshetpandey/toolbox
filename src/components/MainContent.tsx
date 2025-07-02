import { useState } from 'react'
import { SearchBar } from './SearchBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileUp, 
  Zap, 
  Shield, 
  Wrench, 
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  Globe
} from 'lucide-react'

export function MainContent() {
  const [searchQuery, setSearchQuery] = useState('')

  const features = [
    {
      icon: FileUp,
      title: 'Drag & Drop Interface',
      description: 'Intuitive file handling with instant visual feedback',
      color: 'text-blue-500'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Client-side processing for immediate results',
      color: 'text-yellow-500'
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Your files never leave your device',
      color: 'text-green-500'
    },
    {
      icon: Wrench,
      title: 'Professional Tools',
      description: 'Enterprise-grade file manipulation capabilities',
      color: 'text-purple-500'
    }
  ]

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
                Searching for: <span className="font-medium text-foreground">"{searchQuery}"</span>
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
                <h3 className="text-subheading text-foreground mb-2">Search in Progress</h3>
                <p className="text-body text-muted-foreground">
                  Search functionality will be implemented when individual tools are added.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 