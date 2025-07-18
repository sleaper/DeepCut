import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { Layout } from '@/components/layout'
import { HomePage } from '@/pages/home'
import { ClipsPage } from '@/pages/clips'
import { VideosPage } from '@/pages/videos'
import { ClipEditorPage } from '@/pages/clip-editor'
import { SettingsPage } from '@/pages/settings'
import { Toaster } from '@/components/ui/sonner'
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ipcLink } from 'electron-trpc/renderer'
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../electron/main/ipc/index'

export const trpcReact = createTRPCReact<AppRouter>()

function App(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)

  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpcReact.createClient({
      links: [ipcLink()]
    })
  )

  //TODO: improve the start screen. There should be some better way
  useEffect(() => {
    // Hide loading screen after a short delay to ensure theme is applied
    const loadingScreen = document.getElementById('loading-screen')
    if (loadingScreen) {
      loadingScreen.classList.add('hidden')
      // Remove the loading screen element after transition
      loadingScreen.remove()
    }
    setIsLoading(false)
  }, [])

  return (
    <ThemeProvider>
      <trpcReact.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/clips" element={<ClipsPage />} />
                <Route path="/videos" element={<VideosPage />} />
                <Route path="/clip-editor" element={<ClipEditorPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
            <Toaster />
          </Router>
        </QueryClientProvider>
      </trpcReact.Provider>
    </ThemeProvider>
  )
}

export default App
