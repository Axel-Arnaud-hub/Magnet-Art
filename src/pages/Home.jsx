import { Suspense, lazy, useState } from 'react'
import Layout from './Layout.jsx'
import { pickFacts } from './facts.js'

// L'aimant à manipuler (et le code de simulation du prototype) est chargé à
// part : le texte de l'accueil s'affiche tout de suite.
const HeroMagnet = lazy(() => import('./HeroMagnet.jsx'))

export default function Home() {
  const [facts, setFacts] = useState(() => pickFacts(3))

  return (
    <Layout current="accueil">
      <div className="welcome-head">
        <p className="kicker">MAGNÉTISME · NANOMÈTRES · MÉMOIRE</p>
        <h1>Un aimant, ça se voit, ça se tord, et ça se souvient.</h1>
        <p className="lead">
          Attrape l’aimant : la limaille dessine son champ invisible. Ensuite, descends à l’échelle du nanomètre, là où ton disque dur range tes données.
        </p>
      </div>

      <div className="hero-band">
        <div className="hero-canvas">
          <Suspense fallback={null}>
            <HeroMagnet />
          </Suspense>
        </div>
        <p className="fig-cap">
          <b>Essaie</b> : attrape l’aimant par le milieu pour le déplacer, par un bout pour le tourner.
        </p>
      </div>

      <div className="doors">
        <a className="door" href="#decouverte">
          <span className="door-n">1</span>
          <h2>Découvrir</h2>
          <p>Essaie les cinq réglages du bac à sable et observe comment ils changent les motifs magnétiques.</p>
          <strong>Commencer →</strong>
        </a>
        <a className="door" href="#xp-sandbox">
          <span className="door-n">2</span>
          <h2>Bac à sable</h2>
          <p>Trois textures magnétiques à explorer. Cinq paramètres pour les transformer. Une nappe sonore pour les écouter.</p>
          <strong>Jouer →</strong>
        </a>
        <a className="door" href="#application">
          <span className="door-n">3</span>
          <h2>Applications</h2>
          <p>Écris une lettre sur un disque dur et fais vibrer la membrane d’un haut-parleur.</p>
          <strong>Expérimenter →</strong>
        </a>
      </div>

      <section className="facts" aria-label="Le savais-tu ?">
        {facts.map((f) => (
          <div key={f} className="fact">
            <b>Le savais-tu ?</b>
            <p>{f}</p>
          </div>
        ))}
      </section>
      <button className="link facts-more" onClick={() => setFacts((cur) => pickFacts(3, cur))}>
        D’autres faits →
      </button>
    </Layout>
  )
}
