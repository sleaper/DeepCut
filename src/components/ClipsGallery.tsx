import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Play,
  Download,
  ExternalLink,
  Pencil,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { trpcReact } from '@/App'
import { Progress } from './ui/progress'

interface Clip {
  id: string
  title?: string
  proposedTitle?: string
  startTime: number
  endTime: number
  status: 'pending' | 'produced' | 'error' | 'producing'
  videoId: string
  llmReason?: string
  progress?: number
}

interface ClipsGalleryProps {
  clips: Clip[]
  onClipClick?: (clip: Clip) => void
}

export function ClipsGallery({ clips, onClipClick }: ClipsGalleryProps) {
  const showClipInFolder = trpcReact.system.showClipInFolder.useMutation()
  const openExternal = trpcReact.system.openExternal.useMutation()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'produced':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Produced
          </Badge>
        )
      case 'producing':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Producing
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3" />
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

  const handleClipClick = (clip: Clip) => {
    if (onClipClick) {
      onClipClick(clip)
    }
  }

  if (clips.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">No clips found.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {clips.map((clip) => (
        <Card
          key={clip.id}
          className={`group transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
            onClipClick ? 'cursor-pointer' : ''
          }`}
          onClick={() => handleClipClick(clip)}
        >
          <CardContent className="p-4">
            {/* Video Thumbnail/Preview Area */}
            <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg mb-4 relative overflow-hidden aspect-video">
              {clip.status === 'produced' ? (
                <div className="flex items-center justify-center w-full h-full bg-muted/50">
                  <div className="flex flex-col items-center gap-1">
                    <Play className="h-10 w-10 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Ready</span>
                  </div>
                </div>
              ) : clip.status === 'producing' ? (
                <div className="flex items-center justify-center w-full h-full bg-muted/50">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-medium">Producing...</span>
                    {clip.progress !== undefined && (
                      <Progress value={clip.progress} className="w-16 h-1" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-muted/50">
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-10 w-10 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {clip.status === 'error' ? 'Error' : 'Pending'}
                    </span>
                  </div>
                </div>
              )}

              {/* Overlay with duration and status */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                <Badge variant="secondary" className="text-xs">
                  {`${formatDuration(clip.startTime, clip.endTime)}s`}
                </Badge>
                {getStatusBadge(clip.status)}
              </div>

              {/* Quick Actions on Hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  {clip.status === 'produced' && (
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
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      openExternal.mutate({
                        url: `https://youtube.com/watch?v=${clip.videoId}&t=${Math.floor(
                          clip.startTime
                        )}s`
                      })
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to={`/clips`}>
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Clip Info */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm line-clamp-2">
                {clip.title || clip.proposedTitle || `Clip ${clip.id}`}
              </h3>

              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{`${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`}</span>
              </div>

              {clip.llmReason && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{clip.llmReason}</p>
              )}

              {clip.status === 'producing' && clip.progress !== undefined && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Progress</span>
                    <span>{clip.progress}%</span>
                  </div>
                  <Progress value={clip.progress} className="h-1" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
