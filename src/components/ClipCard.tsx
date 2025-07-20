import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Play,
  Download,
  ExternalLink,
  Share2,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { trpcReact } from '@/App'
import { Clip } from '@db/schema'

const SecureVideo = memo(
  ({
    clipId,
    className,
    variant = 'player'
  }: {
    clipId: string
    className?: string
    variant?: 'thumbnail' | 'player'
  }) => {
    const {
      data: assetData,
      isLoading,
      error
    } = trpcReact.assets.getClip.useQuery(
      { clipId },
      {
        enabled: !!clipId,
        staleTime: 5 * 60 * 1000,
        cacheTime: 10 * 60 * 1000
      }
    )

    if (isLoading) {
      return (
        <div className={`${className} flex items-center justify-center bg-muted/50`}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )
    }

    if (error || !assetData) {
      const errorMessage = error ? 'Load Error' : 'No Preview'

      return (
        <div className={`${className} flex items-center justify-center bg-muted/50`}>
          <div className="flex flex-col items-center gap-1">
            <Play className="h-10 w-10 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">{errorMessage}</span>
          </div>
        </div>
      )
    }

    if (typeof assetData === 'string') {
      if (variant === 'thumbnail') {
        return (
          <video
            key={`video-${clipId}`}
            src={assetData}
            className={className}
            muted
            autoPlay={false}
          />
        )
      }

      // Player variant
      return (
        <video
          key={`video-${clipId}`}
          src={assetData}
          className={className}
          controls
          autoPlay
          autoFocus
        />
      )
    }

    // Fallback
    return (
      <div className={`${className} flex items-center justify-center bg-muted/50`}>
        <div className="flex flex-col items-center gap-1">
          <Play className="h-10 w-10 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">No Preview</span>
        </div>
      </div>
    )
  }
)

SecureVideo.displayName = 'SecureVideo'

interface ClipCardProps {
  clip: Clip
  onClick: (clip: Clip) => void
  onDelete?: (clipId: string) => void
  showDeleteButton?: boolean
  isLoading?: boolean
  progress?: number
}

export const ClipCard = memo(
  ({
    clip,
    onClick,
    onDelete,
    showDeleteButton = false,
    isLoading = false,
    progress
  }: ClipCardProps) => {
    const openExternal = trpcReact.system.openExternal.useMutation()
    const showClipInFolder = trpcReact.system.showClipInFolder.useMutation()

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'produced':
          return (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Produced
            </Badge>
          )
        case 'posted':
          return (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Posted
            </Badge>
          )
        case 'pending':
          return (
            <Badge variant="outline" className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Pending
            </Badge>
          )
        case 'error':
          return (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Error
            </Badge>
          )
        default:
          return <Badge variant="outline">{status}</Badge>
      }
    }

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatDuration = (startTime: number, endTime: number) => {
      const duration = endTime - startTime
      return Math.round(duration)
    }

    const handleDeleteClip = (e: React.MouseEvent, clipId: string) => {
      e.stopPropagation()
      if (confirm('Are you sure you want to delete this clip?')) {
        onDelete?.(clipId)
      }
    }

    // Loading skeleton component
    if (isLoading) {
      return (
        <Card className="group">
          <CardContent className="p-4">
            {/* Video Thumbnail Skeleton */}
            <div className="bg-muted rounded-lg mb-4 aspect-video relative overflow-hidden animate-pulse">
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                <div className="w-8 h-5 bg-muted-foreground/20 rounded" />
                <div className="w-16 h-5 bg-muted-foreground/20 rounded" />
              </div>
            </div>

            {/* Clip Info Skeleton */}
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />

              <div className="flex justify-between items-center">
                <div className="h-3 bg-muted rounded w-20 animate-pulse" />
                <div className="h-3 bg-muted rounded w-16 animate-pulse" />
              </div>

              <div className="h-3 bg-muted rounded w-full animate-pulse" />
              <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card
        className={`group transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer`}
        onClick={() => onClick(clip)}
      >
        <CardContent className="p-4">
          {/* Video Thumbnail/Preview Area */}
          <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg mb-4 relative overflow-hidden aspect-video">
            {clip.status === 'produced' || clip.status === 'posted' ? (
              <SecureVideo
                clipId={clip.id}
                className="w-full h-full object-cover"
                variant="thumbnail"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-muted/50">
                <div className="flex flex-col items-center gap-1">
                  <Play className="h-10 w-10 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">
                    {clip.status === 'error' ? 'Error' : 'No Preview'}
                  </span>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {progress !== undefined && progress >= 0 && progress < 100 && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm">
                <div className="h-1 bg-muted/30 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                  />
                </div>
                <div className="px-2 py-1">
                  <span className="text-xs text-white font-medium">{Math.round(progress)}%</span>
                </div>
              </div>
            )}

            {/* Overlay with duration and status */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
              <Badge variant="secondary" className="text-xs">
                {formatDuration(clip.startTime, clip.endTime)}s
              </Badge>
              {getStatusBadge(clip.status)}
            </div>

            {/* Quick Actions on Hover */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-1">
                {(clip.status === 'produced' || clip.status === 'posted') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      showClipInFolder.mutate({ clipId: clip.id })
                    }}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
                {clip.postUrl && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      openExternal.mutate({ url: clip.postUrl! })
                    }}
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    openExternal.mutate({
                      url: `https://youtube.com/watch?v=${clip.videoId}&t=${clip.startTime}s`
                    })
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                {showDeleteButton && onDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 w-8 p-0"
                    onClick={(e) => handleDeleteClip(e, clip.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Clip Info */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm line-clamp-2">
              {clip.proposedTitle || `Clip ${clip.id}`}
            </h3>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
              </span>
              <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
            </div>

            {clip.llmReason && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{clip.llmReason}</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
)

ClipCard.displayName = 'ClipCard'
