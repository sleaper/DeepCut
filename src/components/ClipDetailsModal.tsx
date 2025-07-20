import React, { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Play, Download, ExternalLink, Edit3, Wand2 } from 'lucide-react'
import { trpcReact } from '@/App'
import { Clip } from '@db/schema'
import { toast } from 'sonner'

// Component to handle secure video loading through assets API
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
            src={assetData}
            className={className}
            style={{ objectFit: 'cover' }}
            controls={false}
            autoPlay={false}
            loop={false}
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

    // Fallback (should not reach here due to earlier checks)
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

interface ClipDetailsModalProps {
  clip: Clip | null
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

export const ClipDetailsModal = memo(
  ({ clip, isOpen, onClose, onRefresh }: ClipDetailsModalProps) => {
    const [editedSummary, setEditedSummary] = useState('')
    const [isEditingSummary, setIsEditingSummary] = useState(false)

    // Initialize editedSummary when clip changes
    React.useEffect(() => {
      if (clip) {
        setEditedSummary(clip.summary || '')
        setIsEditingSummary(false)
      }
    }, [clip])

    const openExternal = trpcReact.system.openExternal.useMutation()
    const showClipInFolder = trpcReact.system.showClipInFolder.useMutation()

    const publishX = trpcReact.clips.postClipToX.useMutation({
      onSuccess: (data) => {
        if (data) {
          toast.dismiss('posting-x')
          toast.success('Clip posted to X successfully')
          onRefresh?.()
        }
      },
      onError: (error) => {
        toast.error(`Failed to post to X: ${error.message}`)
      }
    })

    const regenerateSummaryMutation = trpcReact.clips.regenerateClipSummary.useMutation({
      onSuccess: (newSummary) => {
        if (clip && typeof newSummary === 'string') {
          setEditedSummary(newSummary)
          toast.success('Summary regenerated successfully!')
          onRefresh?.()
        }
      },
      onError: (error) => {
        toast.error(`Failed to regenerate summary: ${error.message}`)
      }
    })

    const updateSummaryMutation = trpcReact.clips.updateClipSummary.useMutation({
      onSuccess: () => {
        if (clip) {
          setIsEditingSummary(false)
          toast.success('Summary updated successfully!')
          onRefresh?.()
        }
      },
      onError: (error) => {
        toast.error(`Failed to update summary: ${error.message}`)
      }
    })

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatDuration = (startTime: number, endTime: number) => {
      const duration = endTime - startTime
      return Math.round(duration)
    }

    const handlePublish = async (platform: 'x' | 'youtube' | 'tiktok' | 'instagram') => {
      if (!clip) return

      switch (platform) {
        case 'x':
          toast.loading('Posting clip to X...', {
            id: 'posting-x',
            duration: Infinity
          })
          publishX.mutate({ clipId: clip.id })
          break
        case 'youtube':
          toast.info('YouTube Shorts publishing is coming soon!', {
            description: 'This feature is currently in development.'
          })
          break
        case 'tiktok':
          toast.info('TikTok publishing is coming soon!', {
            description: 'This feature is currently in development.'
          })
          break
        case 'instagram':
          toast.info('Instagram Reels publishing is coming soon!', {
            description: 'This feature is currently in development.'
          })
          break
        default:
          toast.error(`Unsupported platform: ${platform}`)
      }
      onClose()
    }

    const handleRegenerateSummary = () => {
      if (!clip) return
      regenerateSummaryMutation.mutate({ clipId: clip.id })
    }

    const handleSaveEditedSummary = () => {
      if (clip && editedSummary.trim()) {
        updateSummaryMutation.mutate({
          clipId: clip.id,
          summary: editedSummary.trim()
        })
      }
    }

    const handleCancelEdit = () => {
      setEditedSummary(clip?.summary || '')
      setIsEditingSummary(false)
    }

    if (!clip) return null

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-7xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              {clip.proposedTitle || `Clip ${clip.id}`}
            </DialogTitle>
            <DialogDescription>
              Duration: {formatDuration(clip.startTime, clip.endTime)}s{' • '}
              Status: {clip.status}
              {' • '}
              {new Date(clip.createdAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[calc(95vh-8rem)] overflow-y-auto">
            {/* Left Column - Video Player */}
            <div className="lg:col-span-2 space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {clip.status === 'produced' || clip.status === 'posted' ? (
                  <SecureVideo clipId={clip.id} className="w-full h-full" variant="player" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-muted/50">
                    <div className="flex flex-col items-center gap-2">
                      <Play className="h-16 w-16 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        {clip.status === 'error' ? 'Error producing clip' : 'Video not ready yet'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 justify-center">
                {(clip.status === 'produced' || clip.status === 'posted') && (
                  <Button
                    variant="outline"
                    onClick={() => showClipInFolder.mutate({ clipId: clip.id })}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Show in Folder
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    openExternal.mutate({
                      url: `https://youtube.com/watch?v=${clip.videoId}&t=${clip.startTime}s`
                    })
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on YouTube
                </Button>
              </div>
            </div>

            {/* Right Column - Details and Actions */}
            <div className="space-y-4">
              {/* Clip Details */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Title</Label>
                      <p className="text-sm mt-1">{clip.proposedTitle}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Time Range</Label>
                      <p className="text-sm mt-1">
                        {`${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">AI Reason</Label>
                      <p className="text-sm mt-1 text-muted-foreground">{clip.llmReason}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Section with Edit */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Summary</Label>
                      <div className="flex gap-2">
                        {!isEditingSummary && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditingSummary(true)}
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRegenerateSummary}
                              disabled={regenerateSummaryMutation.isLoading}
                            >
                              <Wand2 className="h-3 w-3 mr-1" />
                              {regenerateSummaryMutation.isLoading ? 'Generating...' : 'Regenerate'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditingSummary ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedSummary}
                          onChange={(e) => setEditedSummary(e.target.value)}
                          placeholder="Enter clip summary..."
                          rows={4}
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveEditedSummary}
                            disabled={updateSummaryMutation.isLoading || !editedSummary.trim()}
                          >
                            {updateSummaryMutation.isLoading ? 'Saving...' : 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{clip.summary}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Publishing Section */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Publish to Platforms</Label>

                    <div className="grid grid-cols-2 gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" className="justify-start" disabled>
                            YouTube Shorts
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Coming soon</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => handlePublish('instagram')}
                            disabled
                          >
                            Instagram Reels
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Coming soon</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => handlePublish('tiktok')}
                            disabled
                          >
                            TikTok
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Coming soon</TooltipContent>
                      </Tooltip>

                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => handlePublish('x')}
                        disabled={clip.status !== 'produced'}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        X (Twitter)
                      </Button>
                    </div>

                    {clip.postUrl && (
                      <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-xs text-green-800 dark:text-green-200">
                        Already posted.{' '}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-green-800 dark:text-green-200 underline"
                          onClick={() => openExternal.mutate({ url: clip.postUrl! })}
                        >
                          View post
                        </Button>
                      </div>
                    )}

                    {clip.status !== 'produced' && (
                      <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-2 rounded">
                        This clip must be fully produced before it can be published.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
)

ClipDetailsModal.displayName = 'ClipDetailsModal'
