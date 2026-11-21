import { Suspense, lazy, useEffect, useState } from 'react'
import Home from './pages/Home.jsx'
import Discover from './pages/Discover.jsx'
import Sandbox from './pages/Sandbox.jsx'
import { CHAPTERS } from './pages/discoverData.js'

// Les parcours (et le code de simulation du prototype) ne sont chargés qu'à la demande.
const Guide = lazy(() => import('./discover/Guide.jsx'))

// Navigation par l'ancre de l'URL (mêmes noms que le prototype Aimantarium),
// compatible avec un hébergement statique (GitHub Pages).
const ROUTES = {
  accueil: Home,
  decouverte: Discover,
  'xp-sandbox': Sandbox,
}

function currentRoute() {
  const r = window.location.hash.replace(/^#\/?/, '')
  if (r.startsWith('guide-') && CHAPTERS.some((c) => 'guide-' + c.id === r)) return r
  return ROUTES[r] ? r : 'accueil'
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route.startsWith('guide-')) {
    const id = route.slice(6)
    return (
      <Suspense fallback={<div className="page" />}>
        <Guide key={id} id={id} />
      </Suspense>
    )
  }
  const Page = ROUTES[route]
  return <Page />
}
