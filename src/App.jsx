import { useEffect, useState } from 'react'
import Home from './pages/Home.jsx'
import Discover from './pages/Discover.jsx'
import Sandbox from './pages/Sandbox.jsx'

// Navigation par l'ancre de l'URL (mêmes noms que le prototype Aimantarium),
// compatible avec un hébergement statique (GitHub Pages).
const ROUTES = {
  accueil: Home,
  decouverte: Discover,
  'xp-sandbox': Sandbox,
}

function currentRoute() {
  const r = window.location.hash.replace(/^#\/?/, '')
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

  const Page = ROUTES[route]
  return <Page />
}
