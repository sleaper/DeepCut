import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Download, ExternalLink, Trash2, RefreshCw, Play, Share2, Wand2, Edit3 } from 'lucide-react'
import { Clip } from '@db/schema'
import { toast } from 'sonner'
import { trpcReact } from '@/App'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type ClipStatus = Clip['status'] | 'All'

// Component to handle secure video loading through assets API
function SecureVideo({
  clipId,
  className,
  variant = 'player'
}: {
  clipId: string
  className?: string
  variant?: 'thumbnail' | 'player'
}) {
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
        <div className={`${className} relative group`}>
          <video src={assetData} className="w-full h-full object-cover" muted preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <Play className="h-12 w-12 text-white opacity-80" fill="currentColor" />
          </div>
        </div>
      )
    }

    // Player variant
    return (
      <video
        key={`video-${clipId}`} // Stable key prevents recreation and play interruption
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

export function ClipsPage() {
  const [statusFilter, setStatusFilter] = useState<ClipStatus>('All')
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [editedSummary, setEditedSummary] = useState('')
  const [isEditingSummary, setIsEditingSummary] = useState(false)
  const openExternal = trpcReact.system.openExternal.useMutation()
  const showClipInFolder = trpcReact.system.showClipInFolder.useMutation()
  const publishX = trpcReact.clips.postClipToX.useMutation({
    onSuccess: (data) => {
      if (data) {
        toast.dismiss('posting-x')
        toast.success('Clip posted to X successfully')
        refetch()
      }
    },
    onError: (error) => {
      toast.error(`Failed to post to X: ${error.message}`)
    }
  })

  const {
    data: clips,
    isLoading,
    refetch
  } = trpcReact.clips.getClips.useQuery({
    status: statusFilter,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  const deleteClipMutation = trpcReact.clips.deleteClip.useMutation({
    onSuccess: () => {
      toast.success('Clip deleted successfully')
      refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const regenerateSummaryMutation = trpcReact.clips.regenerateClipSummary.useMutation({
    onSuccess: (newSummary) => {
      if (selectedClip && typeof newSummary === 'string') {
        setSelectedClip({ ...selectedClip, summary: newSummary })
        setEditedSummary(newSummary)
        toast.success('Summary regenerated successfully!')
        refetch()
      }
    },
    onError: (error) => {
      toast.error(`Failed to regenerate summary: ${error.message}`)
    }
  })

  const updateSummaryMutation = trpcReact.clips.updateClipSummary.useMutation({
    onSuccess: (updatedSummary) => {
      if (selectedClip) {
        setSelectedClip({ ...selectedClip, summary: updatedSummary })
        setIsEditingSummary(false)
        toast.success('Summary updated successfully!')
        refetch()
      }
    },
    onError: (error) => {
      toast.error(`Failed to update summary: ${error.message}`)
    }
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'produced':
        return <Badge variant="success">Produced</Badge>
      case 'posted':
        return <Badge variant="info">Posted</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
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

  const handleDeleteClip = async (clipId: string) => {
    if (confirm('Are you sure you want to delete this clip?')) {
      deleteClipMutation.mutate({ clipId })
    }
  }

  const handleClipClick = (clip: Clip) => {
    setSelectedClip(clip)
    setEditedSummary(clip.summary || '')
    setIsEditingSummary(false)
    setIsDetailDialogOpen(true)
  }

  const handlePublish = async (platform: 'x' | 'youtube' | 'tiktok' | 'instagram') => {
    if (!selectedClip) return

    switch (platform) {
      case 'x':
        toast.loading('Posting clip to X...', {
          id: 'posting-x',
          duration: Infinity
        })
        publishX.mutate({ clipId: selectedClip.id })
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
    setIsDetailDialogOpen(false)
  }

  const handleRegenerateSummary = () => {
    if (!selectedClip) return
    regenerateSummaryMutation.mutate({ clipId: selectedClip.id })
  }

  const handleSaveEditedSummary = () => {
    if (selectedClip && editedSummary.trim()) {
      updateSummaryMutation.mutate({
        clipId: selectedClip.id,
        summary: editedSummary.trim()
      })
    }
  }

  const handleCancelEdit = () => {
    setEditedSummary(selectedClip?.summary || '')
    setIsEditingSummary(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clips Gallery</h1>
          <p className="text-muted-foreground">Browse and manage all generated video clips</p>
        </div>

        {/* Filter Controls Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-[180px] h-10 bg-muted rounded-md animate-pulse" />
                <div className="w-16 h-4 bg-muted rounded animate-pulse" />
              </div>
              <div className="w-20 h-9 bg-muted rounded-md animate-pulse" />
            </div>
          </CardContent>
        </Card>

        {/* Clips Gallery Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="group">
              <CardContent className="p-4">
                {/* Video Thumbnail Skeleton */}
                <div className="bg-muted rounded-lg mb-4 aspect-square max-h-48 relative overflow-hidden animate-pulse">
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
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clips Gallery</h1>
        <p className="text-muted-foreground">Browse and manage all generated video clips</p>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Select
                value={statusFilter}
                onValueChange={(value: ClipStatus) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="produced">Produced</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">{clips?.length} clips</div>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clips Gallery */}
      {clips?.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              {statusFilter === 'All' ? 'No clips found' : `No clips with status "${statusFilter}"`}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.isArray(clips) &&
            clips.map((clip) => (
              <Card
                key={clip.id}
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                onClick={() => handleClipClick(clip)}
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
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClip(clip.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Clip Info */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm line-clamp-2">
                      {clip.proposedTitle || `Clip from ${clip.videoTitle}`}
                    </h3>

                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                      </span>
                      <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                    </div>

                    {clip.llmReason && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {clip.llmReason}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Detailed Clip Modal */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-7xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              {selectedClip?.proposedTitle || `Clip ${selectedClip?.id}`}
            </DialogTitle>
            <DialogDescription>
              {selectedClip && (
                <>
                  Duration: {formatDuration(selectedClip.startTime, selectedClip.endTime)}s{' • '}
                  Status: {selectedClip.status}
                  {' • '}
                  {new Date(selectedClip.createdAt).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[calc(95vh-8rem)] overflow-y-auto">
            {/* Left Column - Video Player */}
            <div className="lg:col-span-2 space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {selectedClip &&
                (selectedClip.status === 'produced' || selectedClip.status === 'posted') ? (
                  <SecureVideo
                    clipId={selectedClip.id}
                    className="w-full h-full"
                    variant="player"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-muted/50">
                    <div className="flex flex-col items-center gap-2">
                      <Play className="h-16 w-16 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        {selectedClip?.status === 'error'
                          ? 'Error producing clip'
                          : 'Video not ready yet'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 justify-center">
                {selectedClip &&
                  (selectedClip.status === 'produced' || selectedClip.status === 'posted') && (
                    <Button
                      variant="outline"
                      onClick={() => showClipInFolder.mutate({ clipId: selectedClip.id })}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Show in Folder
                    </Button>
                  )}
                {selectedClip && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      openExternal.mutate({
                        url: `https://youtube.com/watch?v=${selectedClip.videoId}&t=${selectedClip.startTime}s`
                      })
                    }
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on YouTube
                  </Button>
                )}
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
                      <p className="text-sm mt-1">{selectedClip?.proposedTitle}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Time Range</Label>
                      <p className="text-sm mt-1">
                        {selectedClip &&
                          `${formatTime(selectedClip.startTime)} - ${formatTime(selectedClip.endTime)}`}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">AI Reason</Label>
                      <p className="text-sm mt-1 text-muted-foreground">
                        {selectedClip?.llmReason}
                      </p>
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
                      <p className="text-sm">{selectedClip?.summary}</p>
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
                            onClick={() => handlePublish('instagram')}
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
                        disabled={selectedClip?.status !== 'produced'}
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

                    {selectedClip?.postUrl && (
                      <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-xs text-green-800 dark:text-green-200">
                        Already posted.{' '}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-green-800 dark:text-green-200 underline"
                          onClick={() => openExternal.mutate({ url: selectedClip.postUrl! })}
                        >
                          View post
                        </Button>
                      </div>
                    )}

                    {selectedClip?.status !== 'produced' && (
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
    </div>
  )
}
