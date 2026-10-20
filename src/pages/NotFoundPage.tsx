import { SearchX } from 'lucide-react'
import { AuroraBackground } from '../components/AuroraBackground'
import { ShimmerButton } from '../components/ShimmerButton'

export default function NotFoundPage() {
  return (
    <main className="relative grid min-h-[80svh] place-items-center overflow-hidden px-4 pt-24 text-center">
      <AuroraBackground />
      <div className="relative">
        <SearchX className="mx-auto size-12 text-muted" />
        <h1 className="mt-4 font-display text-5xl font-black tracking-tight sm:text-7xl">404</h1>
        <p className="mt-3 text-muted">This page wandered off into another isekai.</p>
        <div className="mt-8">
          <ShimmerButton to="/">Back to home</ShimmerButton>
        </div>
      </div>
    </main>
  )
}
