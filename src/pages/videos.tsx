import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Scissors,
  Clock,
  Play,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { trpcReact } from '@/App'

export function VideosPage() {
  const { data: videos, isLoading, refetch } = trpcReact.videos.getAll.useQuery()
  const [filteredVideos, setFilteredVideos] = useState<typeof videos>([])
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const deleteVideoMutation = trpcReact.videos.deleteVideo.useMutation({
    onSuccess: () => {
      toast.success('Video deleted successfully')
      refetch()
    },
    onError: (error) => {
      toast.error(`Failed to delete video: ${error.message}`)
    }
  })

  useEffect(() => {
    if (!videos) {
      setFilteredVideos([])
      return
    }

    // Filter videos based on status
    if (statusFilter === 'all') {
      setFilteredVideos(videos)
    } else {
      setFilteredVideos(videos.filter((video) => video.status === statusFilter))
    }
  }, [videos, statusFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'transcribed':
        return <Badge variant="secondary">Transcribed</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getClipStatusBadge = (status: string) => {
    switch (status) {
      case 'produced':
        return <Badge variant="success">Produced</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'posted':
        return <Badge variant="info">Posted</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const toggleVideoExpansion = (videoId: string) => {
    const newExpanded = new Set(expandedVideos)
    if (newExpanded.has(videoId)) {
      newExpanded.delete(videoId)
    } else {
      newExpanded.add(videoId)
    }
    setExpandedVideos(newExpanded)
  }

  const handleOpenExternal = (url: string) => {
    // Note: Using shell.openExternal through the main process would be safer
    // but for now we'll use the standard window.open as fallback
    window.open(url, '_blank')
  }

  const handleRefresh = () => {
    refetch()
    toast.success('Videos refreshed')
  }

  const handleDeleteVideo = (videoId: string, title: string) => {
    if (
      confirm(
        `Are you sure you want to delete "${title}" and all its associated clips? This action cannot be undone.`
      )
    ) {
      deleteVideoMutation.mutate({ videoId })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
        <p className="text-muted-foreground">Manage and monitor all processed videos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processed Videos</CardTitle>
          <CardDescription>
            Click on any row to expand and see associated clips and details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <Select
                value={statusFilter}
                onValueChange={(value: string) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="transcribed">Transcribed</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {!filteredVideos || filteredVideos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {statusFilter === 'all'
                ? 'No videos found'
                : `No videos with status "${statusFilter}"`}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Clips</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.map((video) => (
                  <React.Fragment key={video.videoId}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleVideoExpansion(video.videoId)}
                    >
                      <TableCell>
                        {expandedVideos.has(video.videoId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{video.title}</div>
                      </TableCell>
                      <TableCell>{new Date(video.publishedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Scissors className="h-4 w-4" />
                          {video.clips.length}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(video.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenExternal(`https://youtube.com/watch?v=${video.videoId}`)
                            }}
                            title="Open on YouTube"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteVideo(video.videoId, video.title)
                            }}
                            title="Delete video and all clips"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedVideos.has(video.videoId) && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Video ID:</span> {video.videoId}
                              </div>
                              <div>
                                <span className="font-medium">Created:</span>{' '}
                                {new Date(video.createdAt).toLocaleString()}
                              </div>
                              <div>
                                <span className="font-medium">Updated:</span>{' '}
                                {new Date(video.updatedAt).toLocaleString()}
                              </div>
                            </div>

                            {video.errorMessage && (
                              <div>
                                <h4 className="font-semibold mb-2 text-destructive">Error</h4>
                                <p className="text-sm text-destructive">{video.errorMessage}</p>
                              </div>
                            )}

                            {video.clips.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-3">Clips ({video.clips.length})</h4>
                                <div className="space-y-2">
                                  {video.clips.map((clip) => (
                                    <div
                                      key={clip.id}
                                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Play className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                          {clip.proposedTitle && (
                                            <div className="text-sm font-medium mb-1">
                                              {clip.proposedTitle}
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-sm font-mono">
                                              {formatTime(clip.startTime)} -{' '}
                                              {formatTime(clip.endTime)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              ({Math.round(clip.endTime - clip.startTime)}s)
                                            </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                            Created: {new Date(clip.createdAt).toLocaleString()}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {getClipStatusBadge(clip.status)}
                                        {clip.errorMessage && (
                                          <Badge variant="destructive" className="text-xs">
                                            Error
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {video.clips.length === 0 && (
                              <div>
                                <h4 className="font-semibold mb-2">Clips</h4>
                                <p className="text-sm text-muted-foreground">
                                  No clips have been created for this video yet.
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
