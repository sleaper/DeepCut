import { trpcReact } from '@/App'
import { ClipsGallery } from '@/components/ClipsGallery'
import { Card, CardContent } from '@/components/ui/card'

// Skeleton loader component for individual clip cards
function ClipCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Video thumbnail skeleton */}
        <div className="aspect-video bg-muted animate-pulse" />

        <div className="p-4 space-y-3">
          {/* Title skeleton */}
          <div className="h-4 bg-muted animate-pulse rounded w-3/4" />

          {/* Metadata skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
            <div className="h-6 bg-muted animate-pulse rounded-full w-16" />
          </div>

          {/* Duration and date skeleton */}
          <div className="flex items-center justify-between text-sm">
            <div className="h-3 bg-muted animate-pulse rounded w-12" />
            <div className="h-3 bg-muted animate-pulse rounded w-20" />
          </div>

          {/* Action buttons skeleton */}
          <div className="flex gap-2 pt-2">
            <div className="h-8 bg-muted animate-pulse rounded w-8 flex-shrink-0" />
            <div className="h-8 bg-muted animate-pulse rounded w-8 flex-shrink-0" />
            <div className="h-8 bg-muted animate-pulse rounded w-8 flex-shrink-0" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Loading state component that mimics the ClipsGallery structure
function ClipsGalleryLoading() {
  return (
    <div className="space-y-6">
      {/* Filter Controls Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="h-10 bg-muted animate-pulse rounded w-[180px]" />
              <div className="h-4 bg-muted animate-pulse rounded w-20" />
            </div>
            <div className="h-9 bg-muted animate-pulse rounded w-20" />
          </div>
        </CardContent>
      </Card>

      {/* Clips Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <ClipCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

export function ClipsPage() {
  const {
    data: clips,
    isLoading,
    refetch
  } = trpcReact.clips.getClips.useQuery({
    status: 'All',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clips Gallery</h1>
          <p className="text-muted-foreground">Browse and manage all generated video clips</p>
        </div>
        <ClipsGalleryLoading />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clips Gallery</h1>
        <p className="text-muted-foreground">Browse and manage all generated video clips</p>
      </div>
      <ClipsGallery clips={clips || []} page={'clips'} clipsRefetch={refetch} />
    </div>
  )
}
