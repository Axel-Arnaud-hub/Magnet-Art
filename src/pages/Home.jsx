import Layout from './Layout.jsx'

export default function Home() {
  return (
    <Layout current="accueil">
      <p className="kicker">MAGNÉTISME · NANOMÈTRES · MÉMOIRE</p>
      <h1>Un aimant, ça se voit, ça se tord, et ça se souvient.</h1>
      <p className="lead">Descends à l’échelle du nanomètre, là où ton disque dur range tes données.</p>
      <div className="doors">
        <a className="door" href="#decouverte">
          <span className="door-n">1</span>
          <h2>Découvrir</h2>
          <p>Six chapitres courts. Tu fais, tu remarques, puis tu comprends. Au bout : les huit grandeurs qui gouvernent un aimant.</p>
          <strong>Commencer →</strong>
        </a>
        <a className="door" href="#xp-sandbox">
          <span className="door-n">2</span>
          <h2>Bac à sable</h2>
          <p>Fabrique ton propre film magnétique : un matériau, un champ, et des tourbillons dessinés à la lumière.</p>
          <strong>Jouer →</strong>
        </a>
      </div>
    </Layout>
  )
}
