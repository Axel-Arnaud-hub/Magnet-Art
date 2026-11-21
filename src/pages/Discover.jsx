import Layout from './Layout.jsx'
import { CHAPTERS, GRANDEURS } from './discoverData.js'

export default function Discover() {
  return (
    <Layout current="decouverte">
      <p className="kicker">DÉCOUVERTE · 6 CHAPITRES</p>
      <h1>Les grandeurs qui gouvernent un aimant.</h1>
      <p className="lead">
        Pas besoin de connaître la physique. Dans chaque étape, tu fais d’abord une manipulation. Ensuite on te demande ce que tu as remarqué. Enfin, on explique ce qui
        s’est passé.
      </p>
      <div className="how">
        <span><b>1</b> Je fais</span>
        <span><b>2</b> Je remarque</span>
        <span><b>3</b> Je comprends</span>
      </div>

      <div className="chapters">
        {CHAPTERS.map((c, i) => (
          <article key={c.id} className="chapter">
            <div className="chapter-top">
              <span className="chapter-n">{String(i + 1).padStart(2, '0')}</span>
              <span aria-hidden="true">{c.icon}</span>
            </div>
            <p className="chapter-level">{c.level}</p>
            <h2>{c.short}</h2>
            <p>{c.summary}</p>
            <div className="chapter-qty">
              {c.qty.map((k) => (
                <span key={k} title={GRANDEURS[k].name}>
                  {GRANDEURS[k].sym}
                </span>
              ))}
            </div>
            <p className="chapter-bottom">{c.steps} étapes · bientôt disponible</p>
          </article>
        ))}
      </div>

      <section className="carnet">
        <h2>Les huit grandeurs</h2>
        <div className="carnet-grid">
          {Object.entries(GRANDEURS).map(([k, q]) => (
            <div key={k} className="carnet-card">
              <b>{q.sym}</b>
              <strong>{q.name}</strong>
              <p>{q.role}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="lead">
        En attendant les chapitres, va jouer dans le <a href="#xp-sandbox">bac à sable</a>.
      </p>
    </Layout>
  )
}
