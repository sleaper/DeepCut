import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Eye,
  EyeOff,
  Save,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import { trpcReact } from '@/App'

interface ApiToken {
  key: string
  name: string
  description: string
  placeholder: string
  value: string
  isSet: boolean
  isLoading?: boolean
}

interface TokenGroup {
  title: string
  description: string
  icon?: string
  tokens: Omit<ApiToken, 'value' | 'isSet'>[]
}

const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: 'AI Services',
    description: 'AI APIs for content analysis and generation',
    tokens: [
      {
        key: 'GEMINI_API_KEY',
        name: 'Google Gemini',
        description: 'AI API for transcript analysis and clip generation',
        placeholder: 'Enter your Google Gemini API key'
      }
    ]
  },
  {
    title: 'Speech-to-Text',
    description: 'Audio transcription services',
    tokens: [
      {
        key: 'DEEPGRAM_API_KEY',
        name: 'Deepgram',
        description: 'Speech-to-text API for video transcription',
        placeholder: 'Enter your Deepgram API key'
      }
    ]
  },
  {
    title: 'X (Twitter)',
    description: 'Twitter/X platform integration for posting clips',
    tokens: [
      {
        key: 'X_APP_KEY',
        name: 'App Key',
        description: 'Twitter app key for authentication',
        placeholder: 'Enter your X/Twitter app key'
      },
      {
        key: 'X_APP_SECRET',
        name: 'App Secret',
        description: 'Twitter app secret for authentication',
        placeholder: 'Enter your X/Twitter app secret'
      },
      {
        key: 'X_ACCESS_TOKEN',
        name: 'Access Token',
        description: 'Twitter access token for posting',
        placeholder: 'Enter your X/Twitter access token'
      },
      {
        key: 'X_ACCESS_SECRET',
        name: 'Access Secret',
        description: 'Twitter access secret for posting',
        placeholder: 'Enter your X/Twitter access secret'
      }
    ]
  },
  {
    title: 'Instagram',
    description: 'Instagram platform integration',
    tokens: [
      {
        key: 'INSTAGRAM_API_KEY',
        name: 'Instagram API Key',
        description: 'API key for posting clips to Instagram',
        placeholder: 'Enter your Instagram API key'
      }
    ]
  },
  {
    title: 'YouTube',
    description: 'YouTube platform integration',
    tokens: [
      {
        key: 'YOUTUBE_API_KEY',
        name: 'YouTube API Key',
        description: 'API key for posting clips to YouTube',
        placeholder: 'Enter your YouTube API key'
      }
    ]
  },
  {
    title: 'TikTok',
    description: 'TikTok platform integration',
    tokens: [
      {
        key: 'TIKTOK_API_KEY',
        name: 'TikTok API Key',
        description: 'API key for posting clips to TikTok',
        placeholder: 'Enter your TikTok API key'
      }
    ]
  }
]

// Flatten all tokens for easier processing
const ALL_TOKENS = TOKEN_GROUPS.flatMap((group) => group.tokens)

export function SettingsPage() {
  const [tokens, setTokens] = useState<ApiToken[]>(() =>
    // Initialize with optimistic UI - show all tokens immediately with loading states
    ALL_TOKENS.map((tokenConfig) => ({
      ...tokenConfig,
      value: '',
      isSet: false,
      isLoading: true
    }))
  )
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({})
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    'AI Services': true,
    'Speech-to-Text': true,
    'X (Twitter)': false,
    Instagram: false,
    YouTube: false,
    TikTok: false
  })

  // TRPC queries and mutations
  const getAllTokenKeys = trpcReact.settings.getAllTokenKeys.useQuery(undefined, {
    enabled: false
  })

  const setApiTokenMutation = trpcReact.settings.setApiToken.useMutation({
    onSuccess: (result, variables) => {
      const token = tokens.find((t) => t.key === variables.tokenKey)
      if (result.success) {
        setTokens((prev) =>
          prev.map((t) => (t.key === variables.tokenKey ? { ...t, isSet: true } : t))
        )
        toast.success(`${token?.name} API token saved securely`)
      } else {
        const errorMessage = 'error' in result ? result.error : 'Unknown error'
        toast.error(`Failed to save ${token?.name} API token: ${errorMessage}`)
      }
      setSaving((prev) => ({ ...prev, [variables.tokenKey]: false }))
    },
    onError: (error, variables) => {
      const token = tokens.find((t) => t.key === variables.tokenKey)
      console.error('Failed to save token:', error)
      toast.error(`Failed to save ${token?.name} API token`)
      setSaving((prev) => ({ ...prev, [variables.tokenKey]: false }))
    }
  })

  const deleteApiTokenMutation = trpcReact.settings.deleteApiToken.useMutation({
    onSuccess: (result, variables) => {
      const token = tokens.find((t) => t.key === variables.tokenKey)
      if (result.success) {
        setTokens((prev) =>
          prev.map((t) => (t.key === variables.tokenKey ? { ...t, value: '', isSet: false } : t))
        )
        toast.success(`${token?.name} API token removed`)
      } else {
        const errorMessage = 'error' in result ? result.error : 'Unknown error'
        toast.error(`Failed to remove ${token?.name} API token: ${errorMessage}`)
      }
      setSaving((prev) => ({ ...prev, [variables.tokenKey]: false }))
    },
    onError: (error, variables) => {
      const token = tokens.find((t) => t.key === variables.tokenKey)
      console.error('Failed to delete token:', error)
      toast.error(`Failed to delete ${token?.name} API token`)
      setSaving((prev) => ({ ...prev, [variables.tokenKey]: false }))
    }
  })

  useEffect(() => {
    loadTokens()
  }, [])

  const loadTokens = async () => {
    try {
      const existingKeys = await getAllTokenKeys.refetch()

      const loadedTokens: ApiToken[] = await Promise.all(
        ALL_TOKENS.map(async (tokenConfig) => {
          const isSet = existingKeys.data?.includes(tokenConfig.key) || false
          let value = ''

          // Note: We'll load the actual values when needed to avoid multiple queries
          // The token values will be loaded individually when users want to edit them

          return {
            ...tokenConfig,
            value,
            isSet,
            isLoading: false
          }
        })
      )

      setTokens(loadedTokens)
    } catch (error) {
      console.error('Failed to load tokens:', error)
      toast.error('Failed to load API tokens')
      // Even on error, mark as not loading so UI shows properly
      setTokens((prev) => prev.map((token) => ({ ...token, isLoading: false })))
    } finally {
      setIsInitialLoad(false)
    }
  }

  const handleTokenChange = (key: string, value: string) => {
    setTokens((prev) => prev.map((token) => (token.key === key ? { ...token, value } : token)))
  }

  const toggleShowToken = (key: string) => {
    setShowTokens((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const toggleCardExpanded = (cardTitle: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardTitle]: !prev[cardTitle]
    }))
  }

  const saveToken = async (key: string) => {
    const token = tokens.find((t) => t.key === key)
    if (!token) return

    setSaving((prev) => ({ ...prev, [key]: true }))

    if (!token.value.trim()) {
      // Delete token if empty
      deleteApiTokenMutation.mutate({ tokenKey: key })
    } else {
      // Save token
      setApiTokenMutation.mutate({
        tokenKey: key,
        tokenValue: token.value
      })
    }
  }

  const deleteToken = async (key: string) => {
    const token = tokens.find((t) => t.key === key)
    if (!token) return

    if (!confirm(`Are you sure you want to delete the ${token.name} API token?`)) {
      return
    }

    setSaving((prev) => ({ ...prev, [key]: true }))
    deleteApiTokenMutation.mutate({ tokenKey: key })
  }

  const renderTokenInput = (token: ApiToken) => (
    <div key={token.key} className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor={token.key} className="text-sm font-medium">
            {token.name}
          </Label>
          <p className="text-xs text-muted-foreground">{token.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {token.isLoading ? (
            <Badge variant="outline" className="text-muted-foreground">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Loading...
            </Badge>
          ) : token.isSet ? (
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <XCircle className="h-3 w-3 mr-1" />
              Not Set
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={token.key}
            type={showTokens[token.key] ? 'text' : 'password'}
            value={token.value}
            onChange={(e) => handleTokenChange(token.key, e.target.value)}
            placeholder={token.isLoading ? 'Loading...' : token.placeholder}
            className="pr-10"
            disabled={token.isLoading}
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => toggleShowToken(token.key)}
            disabled={token.isLoading}
          >
            {showTokens[token.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        <Button
          onClick={() => saveToken(token.key)}
          disabled={saving[token.key] || token.isLoading}
          size="sm"
        >
          <Save className="h-4 w-4 mr-1" />
          {saving[token.key] ? 'Saving...' : 'Save'}
        </Button>

        {token.isSet && (
          <Button
            variant="outline"
            onClick={() => deleteToken(token.key)}
            disabled={saving[token.key] || token.isLoading}
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your API tokens for various services. All tokens are stored securely using
          encryption.
        </p>
      </div>

      <div className="grid gap-6">
        {TOKEN_GROUPS.map((group) => {
          const groupTokens = tokens.filter((token) =>
            group.tokens.some((groupToken) => groupToken.key === token.key)
          )

          const isAlwaysVisible = group.title === 'AI Services' || group.title === 'Speech-to-Text'
          const isExpanded = expandedCards[group.title] ?? false

          return (
            <Card key={group.title}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{group.title}</CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                  {!isAlwaysVisible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCardExpanded(group.title)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              {(isAlwaysVisible || isExpanded) && (
                <CardContent className="space-y-6">{groupTokens.map(renderTokenInput)}</CardContent>
              )}
            </Card>
          )
        })}

        <Card>
          <CardHeader>
            <CardTitle>Security Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Encrypted Storage</p>
                <p className="text-xs text-muted-foreground">
                  All API tokens are encrypted using Electron's safeStorage before being saved to
                  disk.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Local Storage</p>
                <p className="text-xs text-muted-foreground">
                  Tokens are stored locally on your device and never transmitted to external
                  servers.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">OS-Level Protection</p>
                <p className="text-xs text-muted-foreground">
                  Encryption keys are managed by your operating system's secure storage mechanisms.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
