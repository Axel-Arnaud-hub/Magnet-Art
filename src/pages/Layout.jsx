import './pages.css'

// Cadre commun des pages de contenu (accueil, découverte, applications), au style
// d'Aimantarium V18 : en-tête collant, logo aimant, menu en pastilles.
export default function Layout({ current, wide, children }) {
  const link = (id, label) => (
    <a href={'#' + id} className={current === id ? 'on' : undefined} aria-current={current === id ? 'page' : undefined}>
      {label}
    </a>
  )
  return (
    <div className="page">
      <header className="page-top">
        <a className="brand" href="#accueil" aria-label="Aimantarium, accueil">
          <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M10 24V15a10 10 0 0 1 20 0v9" fill="none" stroke="#17140F" strokeWidth="7" />
            <rect x="6.5" y="23" width="7" height="9" fill="#D7301F" stroke="#17140F" strokeWidth="1.5" />
            <rect x="26.5" y="23" width="7" height="9" fill="#1F4E9C" stroke="#17140F" strokeWidth="1.5" />
            <path d="M6 37h28" stroke="#C98A00" strokeWidth="2" strokeDasharray="2 3" />
          </svg>
          <span className="brand-t">Aimantarium</span>
        </a>
        <nav className="nav" aria-label="Navigation principale">
          {link('accueil', 'Accueil')}
          {link('decouverte', 'Découverte')}
          {link('application', 'Applications')}
          {link('xp-sandbox', 'Bac à sable')}
        </nav>
      </header>
      <main className={'page-main' + (wide ? ' wide' : '')}>{children}</main>
    </div>
  )
}
