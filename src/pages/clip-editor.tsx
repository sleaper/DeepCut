import React, { useState, useRef, useEffect, useMemo } from 'react'
import ReactPlayer from 'react-player/lazy'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Play,
  Pause,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Wand2,
  RefreshCw,
  Download,
  ExternalLink,
  Volume2,
  Folder
} from 'lucide-react'
import { Clip } from '@db/schema'
import { trpcReact } from '@/App'
import { Link } from 'react-router-dom'

// Helper function to extract YouTube video ID from various URL formats
const getYouTubeId = (url: string): string | null => {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function ClipEditorPage() {
  const [videoUrl, setVideoUrl] = useState('')
  const [videoId, setVideoId] = useState<string>('')
  const [promptType, setPromptType] = useState('default')
  const [customLookFor, setCustomLookFor] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set())
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [isLoadingClips, setIsLoadingClips] = useState(false)
  const [staggeredClips, setStaggeredClips] = useState<Clip[][]>([])

  const playerRef = useRef<ReactPlayer | null>(null)

  const { data: tokenKeys, isLoading: isLoadingTokenKeys } =
    trpcReact.settings.getAllTokenKeys.useQuery()

  const areApiKeysSet = useMemo(() => {
    if (!tokenKeys) return false
    return tokenKeys.includes('GEMINI_API_KEY') && tokenKeys.includes('DEEPGRAM_API_KEY')
  }, [tokenKeys])

  const getClipsQuery = trpcReact.clips.getClipsForVideo.useQuery(
    { videoId },
    {
      enabled: false,
      onSuccess: (data) => {
        console.log('DATA', data)
        const loadedClips = data
        setClips(loadedClips)
        setIsLoadingClips(false)
        if (loadedClips.length > 0) {
          toast.success(`Loaded ${loadedClips.length} existing clip(s)`)
        }
      },
      onError: (error) => {
        console.error('Failed to load clips:', error)
        setIsLoadingClips(false)
        toast.error('Failed to load existing clips')
      }
    }
  )
  const manualAnalyzeMutation = trpcReact.videoOperations.manualAnalyze.useMutation({
    onSuccess: (data) => {
      setClips(data)
      toast.success('Analysis complete!')
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`)
    },
    onMutate: () => {
      setIsAnalyzing(true)
    },
    onSettled: () => {
      setIsAnalyzing(false)
    }
  })

  const showClipInFolderMutation = trpcReact.system.showClipInFolder.useMutation()
  const openExternalMutation = trpcReact.system.openExternal.useMutation()

  const produceClipsMutation = trpcReact.clips.produceClips.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        if ('successfulClips' in result && 'failedClips' in result) {
          toast.success(`Started production for ${result.successfulClips.length} clips`)
          if (result.failedClips.length > 0) {
            toast.error(`${result.failedClips.length} clips failed to start production`)
          }
        } else {
          toast.success(result.message || 'Clip production started successfully')
        }
        // Refresh clips data
        getClipsQuery.refetch()
      } else {
        toast.error(result.message || 'Failed to start clip production')
      }
    },
    onError: (error) => {
      toast.error(`Failed to produce clips: ${error.message}`)
    }
  })

  // ReactPlayer configuration
  const playerConfig = useMemo(() => {
    return {
      youtube: {
        playerVars: {
          modestbranding: 1,
          rel: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          enablejsapi: 1,
          controls: 0,
          showinfo: 0,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          disablekb: 1,
          autoplay: 0,
          start: 0
        }
      }
    }
  }, [])

  const onPlayerError = (error: any) => {
    console.error('ReactPlayer Error:', error)
    console.error('ReactPlayer Error Details:', {
      error,
      videoUrl,
      videoId,
      playerConfig
    })
  }

  const onPlayerReady = (player: ReactPlayer) => {
    playerRef.current = player
    setPlayerReady(true)
  }

  const handleDuration = (duration: number) => {
    setDuration(duration)
  }

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)

  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds)
  }

  // Clean up everything when component mounts
  useEffect(() => {
    setClips([])
    setSelectedClipIds(new Set())
    setCurrentTime(0)
    setIsPlaying(false)
    setPlayerReady(false)
  }, [])

  // Load clips when videoId changes
  useEffect(() => {
    if (videoId) {
      loadExistingClips(videoId)
    }
  }, [videoId])

  // Allocate clips to lanes for timeline visualization
  useEffect(() => {
    const allocateClipsToLanes = (clips: Clip[]): Clip[][] => {
      if (!clips.length) return []

      const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime)
      const lanes: Clip[][] = []

      for (const clip of sortedClips) {
        let placed = false
        for (const lane of lanes) {
          const lastClipInLane = lane[lane.length - 1]
          if (clip.startTime >= lastClipInLane.endTime) {
            lane.push(clip)
            placed = true
            break
          }
        }
        if (!placed) {
          lanes.push([clip])
        }
      }
      return lanes
    }
    setStaggeredClips(allocateClipsToLanes(clips))
  }, [clips])

  const loadExistingClips = async (videoId: string) => {
    if (!videoId) return
    setIsLoadingClips(true)
    setClips([])
    getClipsQuery.refetch()
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setVideoUrl(url)
    const newVideoId = getYouTubeId(url)

    if (newVideoId && newVideoId !== videoId) {
      // Reset all state when changing video
      setVideoId(newVideoId)
      setSelectedClipIds(new Set())
      setCurrentTime(0)
      setIsPlaying(false)
      setPlayerReady(false)
      setClips([])
      // loadExistingClips will be called by useEffect
    } else if (!newVideoId && videoId) {
      // Clear everything when URL is invalid
      setVideoId('')
      setSelectedClipIds(new Set())
      setCurrentTime(0)
      setIsPlaying(false)
      setPlayerReady(false)
      setClips([])
    }
  }

  const handleAnalyzeVideo = async () => {
    if (!videoId) {
      toast.info('Please enter a valid YouTube video URL')
      return
    }

    setIsAnalyzing(true)
    try {
      manualAnalyzeMutation.mutate({
        videoId: videoId,
        promptType: promptType,
        customLookFor: promptType === 'custom' ? customLookFor : '',
        existingClips: []
      })
    } catch (error) {
      console.error('Failed to analyze video:', error)
      setIsAnalyzing(false)
    }
  }

  const handleClipSelect = (clip: Clip) => {
    const newSelectedIds = new Set(selectedClipIds)
    const wasSelected = newSelectedIds.has(clip.id)

    if (wasSelected) {
      newSelectedIds.delete(clip.id)
    } else {
      newSelectedIds.add(clip.id)
    }
    setSelectedClipIds(newSelectedIds)

    // If selecting a clip (not deselecting), seek to its start time
    if (!wasSelected && playerRef.current && playerReady) {
      playerRef.current.seekTo(clip.startTime)
      setCurrentTime(clip.startTime)
    }
  }

  const handleProduceSelectedClips = () => {
    if (selectedClips.length === 0) {
      toast.error('No clips selected for production')
      return
    }

    const clipsToProduceData = selectedClips.map((clip) => ({
      id: clip.id,
      startTime: clip.startTime,
      endTime: clip.endTime
    }))

    produceClipsMutation.mutate({
      clips: clipsToProduceData
    })
  }

  const playClip = (clip: Clip) => {
    if (playerRef.current && playerReady) {
      playerRef.current.seekTo(clip.startTime)
      setCurrentTime(clip.startTime)
      setIsPlaying(true)
      setSelectedClipIds(new Set([clip.id]))

      // Stop playing when we reach the end time
      const startTime = Date.now()
      const expectedDuration = (clip.endTime - clip.startTime) * 1000

      const checkTime = () => {
        const elapsed = Date.now() - startTime
        if (
          elapsed >= expectedDuration ||
          (playerRef.current && playerRef.current.getCurrentTime() >= clip.endTime)
        ) {
          setIsPlaying(false)
        } else if (isPlaying) {
          setTimeout(checkTime, 100) // Check every 100ms
        }
      }
      setTimeout(checkTime, 100)
    }
  }

  const filteredClips = clips.filter((clip) => !videoId || clip.videoId === videoId)
  const selectedClips = filteredClips.filter((clip) => selectedClipIds.has(clip.id))

  const renderTimelineMarkers = () => {
    if (!duration || staggeredClips.length === 0) return null

    const laneHeight = 32 // height for each lane in pixels
    const containerHeight = Math.max(laneHeight, staggeredClips.length * laneHeight)

    return (
      <div className="absolute top-0 left-0 right-0" style={{ height: `${containerHeight}px` }}>
        {staggeredClips.map((lane, laneIndex) => (
          <div
            key={laneIndex}
            className="absolute top-0 left-0 right-0"
            style={{ top: `${laneIndex * laneHeight}px`, height: `${laneHeight}px` }}
          >
            {lane.map((clip) => {
              const left = (clip.startTime / duration) * 100
              const width = ((clip.endTime - clip.startTime) / duration) * 100
              const isSelected = selectedClipIds.has(clip.id)
              return (
                <div
                  key={clip.id}
                  className={`absolute h-[90%] rounded-sm hover:bg-yellow-300 hover:z-10 cursor-pointer transition-all duration-200 ${
                    isSelected ? 'bg-yellow-400 z-20 ring-2 ring-yellow-500' : 'bg-yellow-400/50'
                  }`}
                  style={{ left: `${left}%`, width: `${width}%`, top: '5%' }}
                  onClick={() => handleClipSelect(clip)}
                  title={clip.proposedTitle || `Clip ${clip.id}`}
                >
                  <div className="absolute inset-0 overflow-hidden" />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  if (isLoadingTokenKeys) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle>Checking Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clip Editor</h1>
        <p className="text-muted-foreground">Create and edit video clips with precision timing</p>
      </div>

      {/* Video Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Video Source</CardTitle>
          <CardDescription>Enter a YouTube video URL to load and create clips</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoUrl">YouTube Video URL</Label>
            <Input
              id="videoUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={handleUrlChange}
              disabled={isAnalyzing}
            />
          </div>

          <div className="space-y-3">
            <Label>Analysis Type</Label>
            <ToggleGroup
              type="single"
              value={promptType}
              onValueChange={(value) => (value ? setPromptType(value) : setPromptType('default'))}
              className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full"
            >
              <ToggleGroupItem
                value="default"
                className="px-4 py-2 text-sm font-medium border rounded-md transition-all hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Default
              </ToggleGroupItem>
              <ToggleGroupItem
                value="funny"
                className="px-4 py-2 text-sm font-medium border rounded-md transition-all hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Funny
              </ToggleGroupItem>
              <ToggleGroupItem
                value="educational"
                className="px-4 py-2 text-sm font-medium border rounded-md transition-all hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Educational
              </ToggleGroupItem>
              <ToggleGroupItem
                value="custom"
                className="px-4 py-2 text-sm font-medium border rounded-md transition-all hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Custom
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {promptType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customLookFor">Describe what to look for</Label>
              <Input
                id="customLookFor"
                placeholder="e.g., 'funny moments', 'technical explanations', 'user reactions'"
                value={customLookFor}
                onChange={(e) => setCustomLookFor(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleAnalyzeVideo}
              disabled={isAnalyzing || !videoUrl.trim() || !areApiKeysSet}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Analyze Video
                </>
              )}
            </Button>
            <Button
              onClick={() => videoId && loadExistingClips(videoId)}
              variant="outline"
              disabled={!videoId || isLoadingClips}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isLoadingClips ? 'Loading...' : 'Refresh Clips'}
            </Button>
          </div>
          {!areApiKeysSet && (
            <p className="text-sm text-destructive mt-2">
              Warning: AI features require API keys. Please go to{' '}
              <Link to="/settings" className="underline">
                Settings
              </Link>{' '}
              to configure them.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Video Player Section */}
      {videoId && videoUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Video Player</CardTitle>
            <CardDescription>Preview and navigate through your video</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <ReactPlayer
                ref={playerRef}
                url={videoUrl}
                playing={isPlaying}
                volume={volume}
                onProgress={handleProgress}
                onDuration={handleDuration}
                onPlay={handlePlay}
                onPause={handlePause}
                onError={onPlayerError}
                onReady={onPlayerReady}
                config={playerConfig}
                controls={false}
                width="100%"
                height="100%"
                playsinline
              />
            </div>

            {duration > 0 && (
              <div className="space-y-4">
                <div
                  className="relative flex items-center group pt-4"
                  style={{ height: `${Math.max(32, staggeredClips.length * 32) + 20}px` }}
                >
                  <Slider
                    value={[currentTime]}
                    max={duration}
                    onValueChange={(value) => {
                      const newTime = value[0]
                      setCurrentTime(newTime)
                      playerRef.current?.seekTo(newTime, 'seconds')
                    }}
                    className="h-2 absolute top-0"
                  />
                  <div className="absolute top-0 left-0 right-0 h-full mt-4">
                    {renderTimelineMarkers()}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-mono">{formatTime(currentTime)}</span>
                  <div className="flex flex-row items-center justify-center gap-x-6">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (!playerRef.current) return
                          const newTime = Math.max(0, playerRef.current.getCurrentTime() - 5)
                          playerRef.current.seekTo(newTime, 'seconds')
                          setCurrentTime(newTime)
                        }}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button size="icon" onClick={isPlaying ? handlePause : handlePlay}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (!playerRef.current) return
                          const newTime = Math.min(duration, playerRef.current.getCurrentTime() + 5)
                          playerRef.current.seekTo(newTime, 'seconds')
                          setCurrentTime(newTime)
                        }}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 w-24">
                      <Volume2 className="h-4 w-4" />
                      <Slider
                        value={[volume]}
                        max={1}
                        step={0.05}
                        onValueChange={(newVolume) => setVolume(newVolume[0])}
                      />
                    </div>
                  </div>
                  <span className="font-mono">{formatTime(duration)}</span>
                </div>
                {selectedClips.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <Badge variant="secondary">
                      Selected:{' '}
                      {selectedClips
                        .map(
                          (clip) => `${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`
                        )
                        .join(', ')}
                    </Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleProduceSelectedClips}
                        disabled={produceClipsMutation.isLoading || !areApiKeysSet}
                        className="flex items-center gap-1"
                      >
                        {produceClipsMutation.isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                        Produce {selectedClips.length} Clip{selectedClips.length !== 1 ? 's' : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedClipIds(new Set())}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clips List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Clips</CardTitle>
          <CardDescription>
            {isLoadingClips
              ? 'Loading clips...'
              : `${filteredClips.length} clips ${videoId ? 'for this video' : 'total'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClips ? (
            <div className="text-center py-8">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading existing clips...</p>
            </div>
          ) : filteredClips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {videoId
                ? 'No clips found for this video. Analyze it to generate clips.'
                : 'Enter a video URL to view clips.'}
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2 pr-4">
                {filteredClips.map((clip) => (
                  <div
                    key={clip.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedClipIds.has(clip.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleClipSelect(clip)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{clip.proposedTitle || `Clip ${clip.id}`}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(clip.startTime)} - {formatTime(clip.endTime)} (
                          {Math.round(clip.endTime - clip.startTime)}s)
                        </p>
                        {clip.llmReason && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {clip.llmReason}
                          </p>
                        )}
                        {clip.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            Summary: {clip.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            clip.status === 'produced'
                              ? 'default'
                              : clip.status === 'error'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {clip.status}
                        </Badge>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            playClip(clip)
                          }}
                          title="Preview clip"
                        >
                          <Play className="h-3 w-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            showClipInFolderMutation.mutate({ clipId: clip.id })
                          }}
                          title="Show in folder"
                        >
                          <Folder className="h-3 w-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            openExternalMutation.mutate({
                              url: `https://youtube.com/watch?v=${clip.videoId}&t=${clip.startTime}s`
                            })
                          }}
                          title="Open in YouTube"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
