import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVideoProcessingStore } from '@/lib/stores/videoProcessingStore'
import { trpcReact } from '@/App'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { ClipsGallery } from '@/components/ClipsGallery'
import { Progress } from '@/components/ui/progress'
import { PipelineProgress } from 'electron/main/utils/progressTracker'

export function HomePage() {
  const navigate = useNavigate()

  const {
    videoUrl,
    setVideoUrl,
    isProcessing,
    setIsProcessing,
    processingStage,
    setProcessingStage,
    progress,
    setProgress,
    setGeneratedClips,
    setClipsProgress,
    generatedClips,
    clipsProgress,
    currentVideoId,
    setCurrentVideoId,
    reset
  } = useVideoProcessingStore()

  const [analysisComplete, setAnalysisComplete] = React.useState(false)

  const { data: tokenKeys, isLoading: isLoadingTokenKeys } =
    trpcReact.settings.getAllTokenKeys.useQuery()

  const { data: existingClips, refetch: refetchExistingClips } =
    trpcReact.clips.getClipsForVideo.useQuery(
      { videoId: currentVideoId || '' },
      {
        enabled: false,
        onSuccess: (clips) => {
          setGeneratedClips(clips)
        }
      }
    )

  console.log('current video ID', currentVideoId)
  console.log('generated clips', generatedClips)
  console.log('existing clips', existingClips)

  trpcReact.progress.subscribeToProgress.useSubscription(
    { videoId: currentVideoId || '' },
    {
      enabled: !!currentVideoId && isProcessing,
      onData: (data: PipelineProgress) => {
        console.log('Progress update received:', data)
        setProcessingStage(data.message)
        setProgress(data.progress)

        if (data.clips) {
          setClipsProgress(data.clips)
          refetchExistingClips()
        }

        if (data.stage === 'complete') {
          setIsProcessing(false)
          setProcessingStage('All clips produced successfully!')
          setProgress(100)
          setAnalysisComplete(false)
          toast.success('Processing complete!')
          refetchExistingClips()
        }
      },
      onError: () => {
        toast.error('Failed to receive progress updates')
        setIsProcessing(false)
        setAnalysisComplete(false)
      }
    }
  )

  const areApiKeysSet = useMemo(() => {
    if (!tokenKeys) return false
    return tokenKeys.includes('GEMINI_API_KEY') && tokenKeys.includes('DEEPGRAM_API_KEY')
  }, [tokenKeys])

  const videoSubmission = trpcReact.videoOperations.videoSubmission.useMutation({
    onError: (error) => {
      toast.error(`Submission failed: ${error.message}`)
      setIsProcessing(false)
      setAnalysisComplete(false)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl.trim() || videoSubmission.isLoading) {
      return
    }

    const videoIdMatch =
      videoUrl.match(/(?:v=)([\w-]{11})/) || videoUrl.match(/youtu\.be\/([\w-]{11})/)
    const videoId = videoIdMatch ? videoIdMatch[1] : null

    if (!videoId) {
      toast.error('Invalid YouTube video URL')
      return
    }

    reset()
    setCurrentVideoId(videoId)
    setIsProcessing(true)
    setProcessingStage('Submitting video...')
    setProgress(0)
    setAnalysisComplete(false)

    videoSubmission.mutate({ videoId })
    await refetchExistingClips()
  }

  if (isLoadingTokenKeys) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!areApiKeysSet) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl">API Keys Required</CardTitle>
            <CardDescription className="text-center">
              Please set your API keys in the settings to generate clips.
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Clips</CardTitle>
          <CardDescription>
            Enter a YouTube video URL to automatically generate AI-powered clips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex items-center gap-4">
            <Input
              id="videoUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={isProcessing}
              required
              className="flex-grow"
            />
            <Button type="submit" disabled={isProcessing || !videoUrl.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Find Clips'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Processing Video</h3>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">{processingStage}</p>

              {analysisComplete && clipsProgress.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">
                    AI Analysis Complete! Found {clipsProgress.length} clips.
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Now generating video clips... They will appear below as they're ready.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(generatedClips.length > 0 || existingClips?.length) && (
        <div>
          <h2 className="text-2xl font-bold mb-4">
            {isProcessing ? 'Completed Clips' : 'Generated Clips'}
          </h2>
          <ClipsGallery clips={generatedClips} page={'home'} clipsRefetch={refetchExistingClips} />
        </div>
      )}
    </div>
  )
}
