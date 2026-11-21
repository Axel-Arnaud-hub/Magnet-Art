import './pages.css'

// Cadre commun des pages de contenu (accueil, découverte).
export default function Layout({ current, children }) {
  const link = (id, label) => (
    <a href={'#' + id} aria-current={current === id ? 'page' : undefined}>
      {label}
    </a>
  )
  return (
    <div className="page">
      <header className="page-top">
        <a className="brand" href="#accueil">
          Magnet’Art
        </a>
        <nav>
          {link('accueil', 'Accueil')}
          {link('decouverte', 'Découverte')}
          {link('xp-sandbox', 'Bac à sable')}
        </nav>
      </header>
      <main className="page-main">{children}</main>
    </div>
  )
}
