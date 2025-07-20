import { memo, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RefreshCw } from 'lucide-react'
import { ClipCard } from '@/components/ClipCard'
import { ClipDetailsModal } from '@/components/ClipDetailsModal'
import { Clip } from '@db/schema'
import { trpcReact } from '@/App'
import { toast } from 'sonner'
import { useVideoProcessingStore } from '@/lib/stores/videoProcessingStore'

type ClipStatus = 'All' | 'pending' | 'produced' | 'posted' | 'error'

interface ClipsGalleryProps {
  clips: Clip[]
  page: 'home' | 'clips'
  clipsRefetch: () => void
}

export const ClipsGallery = memo(({ clips, page, clipsRefetch }: ClipsGalleryProps) => {
  const [statusFilter, setStatusFilter] = useState<ClipStatus>('All')
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const { setGeneratedClips, generatedClips, clipsProgress } = useVideoProcessingStore()

  // Delete clip mutation
  const deleteClipMutation = trpcReact.clips.deleteClip.useMutation({
    onSuccess: () => {
      toast.success('Clip deleted successfully!')
      handleCloseModal()
    },
    onError: (error) => {
      toast.error(`Failed to delete clip: ${error.message}`)
    }
  })

  // Filter clips based on status
  const filteredClips = clips.filter((clip) => {
    if (statusFilter === 'All') return true
    return clip.status === statusFilter
  })

  const handleClipClick = useCallback((clip: Clip) => {
    setSelectedClip(clip)
    setIsDetailModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsDetailModalOpen(false)
    setSelectedClip(null)
  }, [])

  const handleDeleteClip = useCallback(
    (clipId: string) => {
      if (confirm('Are you sure you want to delete this clip?')) {
        deleteClipMutation.mutate({ clipId })
        setGeneratedClips([...generatedClips.filter((clip) => clip.id !== clipId)])
      }
    },
    [deleteClipMutation, setGeneratedClips, generatedClips]
  )

  const handleRefresh = useCallback(() => {
    clipsRefetch()
  }, [clipsRefetch])

  return (
    <div className="space-y-6">
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
              <div className="text-sm text-muted-foreground">
                {filteredClips.length} clips
                {statusFilter !== 'All' && <span className="ml-1">({clips.length} total)</span>}
              </div>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clips Gallery */}
      {filteredClips.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              {statusFilter === 'All' ? 'No clips found' : `No clips with status "${statusFilter}"`}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onClick={handleClipClick}
              onDelete={handleDeleteClip}
              showDeleteButton={page === 'clips'}
              progress={clipsProgress.find((p) => p.clipId === clip.id)?.progress || undefined}
            />
          ))}
        </div>
      )}

      {/* Clip Details Modal */}
      <ClipDetailsModal
        clip={selectedClip}
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        onRefresh={handleRefresh}
      />
    </div>
  )
})

ClipsGallery.displayName = 'ClipsGallery'
