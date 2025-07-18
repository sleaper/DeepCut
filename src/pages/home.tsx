import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Loader2,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Zap,
  Pencil
} from 'lucide-react'
import { Clip } from '@db/schema'
import { trpcReact } from '@/App'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router-dom'

export function HomePage() {
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=kOyIjt6FUrw')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [progress, setProgress] = useState(0)
  const [generatedClips, setGeneratedClips] = useState<Clip[]>([])
  const [expandedClip, setExpandedClip] = useState<string | null>(null)
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const navigate = useNavigate()

  const showInFolder = trpcReact.system.showInFolder.useMutation()
  const showClipInFolder = trpcReact.system.showClipInFolder.useMutation()
  const { data: tokenKeys, isLoading: isLoadingTokenKeys } =
    trpcReact.settings.getAllTokenKeys.useQuery()

  const areApiKeysSet = useMemo(() => {
    if (!tokenKeys) return false
    return tokenKeys.includes('GEMINI_API_KEY') && tokenKeys.includes('DEEPGRAM_API_KEY')
  }, [tokenKeys])

  const videoSubmission = trpcReact.videoOperations.videoSubmission.useMutation({
    onSuccess: (data) => {
      if (data.success && 'videoId' in data) {
        toast.success(data.message || 'Video submitted successfully!')
        setCurrentVideoId(data.videoId)
        setGeneratedClips([])
        setIsProcessing(true)
        setProcessingStage('Submitted. Waiting for pipeline to start...')
        setProgress(0)
      } else {
        toast.error((data as { error?: string }).error || 'An unknown error occurred.')
        setIsProcessing(false)
      }
    },
    onError: (error) => {
      toast.error(`Submission failed: ${error.message}`)
      setIsProcessing(false)
    }
  })

  useEffect(() => {
    const handleClipUpdate = (e: any) => {
      if (e.detail.videoId === currentVideoId) {
        setGeneratedClips((prev) =>
          prev.map((c) => (c.id === e.detail.clip.id ? { ...c, ...e.detail.clip } : c))
        )
      }
    }
    window.addEventListener('clip-update', handleClipUpdate)
    return () => window.removeEventListener('clip-update', handleClipUpdate)
  }, [currentVideoId])

  useEffect(() => {
    if (!currentVideoId) return

    const handleNewClips = (e: any) => {
      console.log('new clips event', e.detail)
      if (e.detail.videoId === currentVideoId) {
        setGeneratedClips(e.detail.clips)
        setIsProcessing(false)
      }
    }

    const handleProgress = (e: any) => {
      if (e.detail.videoId === currentVideoId) {
        setProcessingStage(e.detail.stage)
        setProgress(e.detail.progress)
      }
    }

    window.addEventListener('new-clips-generated', handleNewClips)
    window.addEventListener('processing-progress', handleProgress)

    return () => {
      window.removeEventListener('new-clips-generated', handleNewClips)
      window.removeEventListener('processing-progress', handleProgress)
    }
  }, [currentVideoId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl.trim() || videoSubmission.isLoading) {
      return
    }
    videoSubmission.mutate({ videoUrl })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'produced':
        return <Badge variant="default">Produced</Badge>
      case 'producing':
        return <Badge variant="secondary">Producing</Badge>
      case 'transcribing':
        return <Badge variant="secondary">Transcribing</Badge>
      case 'analyzing':
        return <Badge variant="secondary">Analyzing</Badge>
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
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const toggleClipExpansion = (clipId: string) => {
    setExpandedClip(expandedClip === clipId ? null : clipId)
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

  if (!areApiKeysSet && !currentVideoId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl">API Keys Required</CardTitle>
            <CardDescription className="text-center">
              To generate clips with AI, please set your Google Gemini and Deepgram API keys in the
              settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/settings')} className="w-full">
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentVideoId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Create New Clips</CardTitle>
            <CardDescription className="text-center">
              Enter a YouTube video URL to automatically generate AI-powered clips.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="videoUrl" className="sr-only">
                  YouTube Video URL
                </Label>
                <Input
                  id="videoUrl"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={videoSubmission.isLoading}
                  required
                  className="text-center"
                />
              </div>
              <Button
                type="submit"
                disabled={videoSubmission.isLoading || !videoUrl.trim()}
                className="w-full"
                size="lg"
              >
                {videoSubmission.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Generate Clips with AI
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Clips</CardTitle>
          <CardDescription>
            Enter a YouTube video URL to automatically generate AI-powered clips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="videoUrl">YouTube Video URL</Label>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isProcessing || videoSubmission.isLoading}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isProcessing || videoSubmission.isLoading || !videoUrl.trim()}
            >
              {isProcessing || videoSubmission.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {videoSubmission.isLoading ? 'Submitting...' : 'Processing...'}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Generate Clips with AI
                </>
              )}
            </Button>
            {!areApiKeysSet && (
              <p className="text-sm text-destructive mt-2">
                Warning: API keys are not configured. AI features will not work. Please go to{' '}
                <Link to="/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Status</CardTitle>
            <CardDescription>
              Your video is being processed. This may take a few minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
            <p className="text-sm text-muted-foreground">{processingStage}</p>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {generatedClips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Clips</CardTitle>
            <CardDescription>
              Click on any row to expand and see detailed information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedClips.map((clip) => (
                  <React.Fragment key={clip.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleClipExpansion(clip.id)}
                    >
                      <TableCell>
                        {expandedClip === clip.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {clip.proposedTitle || `Clip ${clip.id}`}
                      </TableCell>
                      <TableCell>
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                      </TableCell>
                      <TableCell>{getStatusBadge(clip.status)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {clip.status === 'produced' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                showClipInFolder.mutate({ clipId: clip.id })
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              showInFolder.mutate({
                                path: `https://youtube.com/watch?v=${clip.videoId}&t=${Math.floor(
                                  clip.startTime
                                )}s`
                              })
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link to={`/clip-editor/${clip.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedClip === clip.id && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="py-4 space-y-4">
                            {clip.llmReason && (
                              <div>
                                <h4 className="font-semibold mb-2">AI Analysis</h4>
                                <p className="text-sm text-muted-foreground">{clip.llmReason}</p>
                              </div>
                            )}

                            {clip.errorMessage && (
                              <div>
                                <h4 className="font-semibold mb-2 text-destructive">Error</h4>
                                <p className="text-sm text-destructive">{clip.errorMessage}</p>
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
