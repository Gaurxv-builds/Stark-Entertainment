import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { Toaster } from './components/Toaster'
import { ShieldGate } from './components/ShieldGate'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { MobileDock } from './components/MobileDock'
import { SearchModal } from './components/SearchModal'
import { MovieSearchModal } from './components/MovieSearchModal'
import { TopLoader } from './components/TopLoader'
import { ScrollProgress } from './components/ScrollProgress'
import { ScrollToTop } from './components/ScrollToTop'
import { StarkLoginGate } from './components/StarkLoginGate'
import { StarkLoadingScreen } from './components/StarkLoadingScreen'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { useStarkAuth } from './lib/starkAuth'
import { MusicPlayerProvider } from './context/MusicContext'
import { MusicMiniPlayer } from './components/music/MusicMiniPlayer'
import { MusicPlayerExpanded } from './components/music/MusicPlayerExpanded'
import { isDetailsPath, isReaderPath, isWatchPath, sectionOf } from './lib/sections'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const DetailsPage = lazy(() => import('./pages/DetailsPage'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const ListPage = lazy(() => import('./pages/ListPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const AppPage = lazy(() => import('./pages/AppPage'))
const EbooksHomePage = lazy(() => import('./pages/EbooksHomePage'))
const EbookReaderPage = lazy(() => import('./pages/EbookReaderPage'))
const NovelHomePage = lazy(() => import('./pages/NovelHomePage'))
const NovelDetailsPage = lazy(() => import('./pages/NovelDetailsPage'))
const NovelReaderPage = lazy(() => import('./pages/NovelReaderPage'))
const MangaHomePage = lazy(() => import('./pages/MangaHomePage'))
const MangaBrowsePage = lazy(() => import('./pages/MangaBrowsePage'))
const MangaDetailsPage = lazy(() => import('./pages/MangaDetailsPage'))
const MangaReaderPage = lazy(() => import('./pages/MangaReaderPage'))
const MoviesHomePage = lazy(() => import('./pages/MoviesHomePage'))
const MoviesBrowsePage = lazy(() => import('./pages/MoviesBrowsePage'))
const MovieDetailsPage = lazy(() => import('./pages/MovieDetailsPage'))
const MovieWatchPage = lazy(() => import('./pages/MovieWatchPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AniListCallbackPage = lazy(() => import('./pages/AniListCallbackPage'))
const FindPage = lazy(() => import('./pages/FindPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const MusicPage = lazy(() => import('./pages/MusicPage'))

export default function App() {
  const { authenticated, loading, unlock } = useStarkAuth()
  const { pathname } = useLocation()
  const bare = pathname === '/' || isReaderPath(pathname) || isWatchPath(pathname)
  const isDetails = isDetailsPath(pathname)
  const prevDetails = useRef(isDetails)
  const section = sectionOf(pathname)

  // Details pages drop the top padding so the backdrop artwork can bleed up behind the browser chrome.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('has-bleed-header', isDetails)
    if (prevDetails.current !== isDetails) {
      window.scrollTo(0, 0)
      prevDetails.current = isDetails
    }
  }, [isDetails, pathname])

  // Each section has its own colour identity (see index.css).
  useEffect(() => {
    document.documentElement.dataset.section = section ?? 'hub'
  }, [section])

  if (pathname.startsWith('/profile') || pathname.startsWith('/admin')) {
    document.documentElement.dataset.zkMono = '1'
  } else {
    delete document.documentElement.dataset.zkMono
  }

  // 1. Initial verification loading state: show security clearance verification screen
  if (loading) {
    return (
      <>
        <TopLoader />
        <StarkLoadingScreen />
        <ShieldGate />
      </>
    )
  }

  // 2. Unauthenticated state: display Stark Login Gate (blocks all protected content and subroutes)
  if (!authenticated) {
    return (
      <>
        <TopLoader />
        <StarkLoginGate onUnlock={unlock} />
        <Toaster />
        <ShieldGate />
      </>
    )
  }

  // 3. Authenticated state: render normal application and protected routes
  return (
    <MusicPlayerProvider>
      <TopLoader />
      {!bare && <ScrollProgress />}
      <ScrollToTop />
      {!bare && !isDetailsPath(pathname) && <Navbar />}
      <Suspense fallback={<div className="min-h-[70svh]" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/anime" element={<HomePage />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/trending" element={<CatalogPage preset="trending" />} />
          <Route path="/popular" element={<CatalogPage preset="popular" />} />
          <Route path="/top" element={<CatalogPage preset="top" />} />
          <Route path="/browse" element={<CatalogPage preset="browse" />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auth/anilist" element={<AniListCallbackPage />} />
          {/* Ebooks */}
          <Route path="/ebooks" element={<EbooksHomePage />} />
          <Route path="/ebooks/read/:id" element={<EbookReaderPage />} />
          {/* Music */}
          <Route path="/music" element={<MusicPage />} />
          {/* Novels */}
          <Route path="/novel" element={<NovelHomePage />} />
          <Route path="/novel/find" element={<FindPage />} />
          <Route path="/manga/find" element={<FindPage />} />
          <Route path="/novel/:source/:slug" element={<NovelDetailsPage />} />
          <Route path="/novel/:source/:slug/read/:chapter" element={<NovelReaderPage />} />
          {/* Manga */}
          <Route path="/manga" element={<MangaHomePage />} />
          <Route path="/manga/browse" element={<MangaBrowsePage />} />
          <Route path="/manga/:id" element={<MangaDetailsPage />} />
          <Route path="/manga/:id/read/:chapterId" element={<MangaReaderPage />} />
          {/* Movies & TV */}
          <Route path="/movies" element={<MoviesHomePage />} />
          <Route path="/movies/browse" element={<MoviesBrowsePage />} />
          <Route path="/movies/watch/:type/:id" element={<MovieWatchPage />} />
          <Route path="/movies/:type/:id" element={<MovieDetailsPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/anime/:id" element={<DetailsPage />} />
          <Route path="/mal/:id" element={<DetailsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {!bare && <Footer />}
      {!bare && <MobileDock />}
      {!bare && section === 'anime' && <SearchModal />}
      {!bare && section === 'movies' && <MovieSearchModal />}
      <Toaster />
      <ShortcutsHelp />
      <ShieldGate />
      {!bare && (
        <PwaInstallPrompt className="fixed bottom-20 left-4 right-4 z-40 md:bottom-6 md:left-auto md:right-6 md:w-96" />
      )}
      <MusicMiniPlayer />
      <MusicPlayerExpanded />
    </MusicPlayerProvider>
  )
}
