const PACKS = [
  { id: 'lab', name: 'Laboratoire libre', icon: '🔬', color: '#ffc857' },
  { id: 'bases', name: 'Pack Bases', icon: '🧭', color: '#37e6ff' },
  { id: 'textures', name: 'Pack Textures', icon: '🌀', color: '#ff4fd8' },
  { id: 'dynamique', name: 'Pack Dynamique', icon: '🌊', color: '#5dff9e' },
  { id: 'spintro', name: 'Pack Spintronique', icon: '⚡', color: '#ffc857' }
];

const MODELS = [
  {
    id: 'sandbox', pack: 'lab', icon: '🔬', name: 'Sandbox — film 2D',
    tagline: 'Curseurs, matériaux et skyrmion relaxé',
    intro: 'Film 2D réglable par curseurs. Le préréglage Co/Pt effectif maintient une graine de skyrmion plus de 3 ns dans ce solveur sans magnétostatique. Le préréglage alternatif FFT utilise K=800 kJ/m³ comme coefficient uniaxial (convention du solveur, non un Ku mesuré). Une injection dite « laser » impose seulement la graine, sans modéliser la chaleur ni la nucléation.',
    params: [
      { id: 'material', type: 'select', label: 'Jeu de paramètres', value: 'sky', options: [['sky', 'Co/Pt effectif — skyrmion (rapide)'], ['skyfft', 'Co/Pt — skyrmion + FFT (plus lent)'], ['cop', 'Co/Pt (paramètres de simulation publiés)'], ['py', 'Permalloy (µMAG #4)'], ['custom', 'Personnalisé']], help: 'Les valeurs sont des jeux de paramètres publiés, pas des constantes universelles. Sources dans SOURCES.md.' },
      { id: 'Lx', type: 'number', label: 'Longueur Lx (nm)', min: 30, max: 2000, step: 10, value: 192, help: 'Changer la taille relance la simulation.' },
      { id: 'Ly', type: 'number', label: 'Largeur Ly (nm)', min: 30, max: 2000, step: 10, value: 192, help: 'Changer la taille relance la simulation.' },
      { id: 'thick', type: 'number', label: 'Épaisseur t (nm)', min: 0.5, max: 100, step: 0.5, value: 1, help: 'Aimantation supposée uniforme selon z ; l’épaisseur intervient dans la magnétostatique approximative.' },
      { id: 'nx', type: 'number', label: 'Cellules Nx', min: 12, max: 96, step: 1, value: 64, help: 'Nombre de cellules suivant x, maximum 96.' },
      { id: 'ny', type: 'number', label: 'Cellules Ny', min: 12, max: 96, step: 1, value: 64, help: 'Nombre de cellules suivant y, maximum 96.' },
      { id: 'shape', type: 'select', label: 'Géométrie', value: 'rectangle', options: [['rectangle', 'Rectangle'], ['disk', 'Disque inscrit']], help: 'Le disque est inscrit dans les dimensions choisies ; son bord reste pixellisé.' },
      { id: 'Ms', type: 'number', label: 'Aimantation Ms (kA/m)', min: 10, max: 2500, step: 10, value: 580, help: 'Aimantation à saturation. Mise à jour sans réinitialisation du champ magnétique.' },
      { id: 'A', type: 'number', label: 'Échange A (pJ/m)', min: 0.1, max: 100, step: 0.1, value: 15, help: 'Raideur d’échange ; A > 0.' },
      { id: 'K', type: 'number', label: 'Anisotropie K (kJ/m³)', min: -2000, max: 3000, step: 10, value: 600, help: 'Coefficient dans l’énergie K(1−mz²). Sans magnétostatique, K=600 kJ/m³ approxime K_eff plutôt que le Ku intrinsèque publié (800 kJ/m³).' },
      { id: 'D', type: 'number', label: 'DMI D (mJ/m²)', min: -10, max: 10, step: 0.1, value: 3.5, help: 'DMI interfaciale ; condition naturelle échange+DMI imposée aux arêtes discrétisées. La convergence reste à vérifier.' },
      { id: 'alpha', type: 'number', label: 'Amortissement α', min: 0, max: 1, step: 0.01, value: 0.3, help: 'Sans dimension. α = 0 : pas de dissipation par Gilbert.' },
      { id: 'Bx', type: 'number', label: 'Champ Bx (mT)', min: -1000, max: 1000, step: 5, value: 0, help: 'Champ extérieur uniforme selon x. Le capteur du téléphone peut y ajouter une modulation.' },
      { id: 'By', type: 'number', label: 'Champ By (mT)', min: -1000, max: 1000, step: 5, value: 0, help: 'Champ extérieur uniforme selon y.' },
      { id: 'Bz', type: 'number', label: 'Champ Bz (mT)', min: -1000, max: 1000, step: 5, value: 20, help: 'Champ extérieur uniforme selon z.' },
      { id: 'demag', type: 'check', label: 'Champ démagnétisant (FFT approchée)', value: false, help: 'Coût CPU élevé. Modèle de film uniforme en épaisseur, non équivalent à un solveur 3D validé.' },
      { id: 'sensorGain', type: 'number', label: 'Amplitude inclinaison (mT)', min: 0, max: 250, step: 5, value: 50, help: 'Le téléphone commande un champ virtuel : ce n’est PAS une mesure de champ magnétique.' },
      { id: 'drawMode', type: 'select', label: 'Carte de couleur', value: 'wheel', options: [['wheel', 'Direction (roue)'], ['mz', 'Composante mz'], ['mx', 'Composante mx'], ['my', 'Composante my']] },
      { id: 'arrows', type: 'check', label: 'Afficher les flèches', value: false },
      { id: 'brush', type: 'select', label: 'Toucher le film', value: 'laser', options: [['laser', 'Laser idéalisé → graine de skyrmion'], ['sky', 'Graine de skyrmion (sans laser)'], ['reverse', 'Retourner localement mz'], ['none', 'Ne rien modifier']], help: 'La variante « laser idéalisé » initialise une texture chirale localisée : elle NE calcule PAS le chauffage, les photons, ni les fluctuations thermiques. La stabilité résulte ensuite de la LLG.' },
      { id: 'radius', type: 'number', label: 'Rayon de graine (nm)', min: 5, max: 180, step: 5, value: 25 }
    ],
    buttons: [
      { id: 'laser', label: '⚡ Impulsion laser idéalisée' },
      { id: 'seed', label: '🌀 Graine centrale (sans laser)' },
      { id: 'up', label: '↑ Uniforme +z' },
      { id: 'inplane', label: '→ Uniforme +x' },
      { id: 'stripes', label: '▥ Bandes' },
      { id: 'random', label: '🎲 Aléatoire' }
    ],
    whatIf: [
      { label: 'Co/Pt — skyrmion rapide (K eff.)', set: { material: 'sky' } },
      { label: 'Co/Pt — skyrmion + FFT (K=800)', set: { material: 'skyfft' } },
      { label: 'Co/Pt publié', set: { material: 'cop' } },
      { label: 'Permalloy publié', set: { material: 'py' } },
      { label: 'Enlever la DMI', set: { D: 0 } },
      { label: 'Renforcer le champ Bz', set: { Bz: 150 } }
    ],
    observe: [
      'La taille réelle est Lx × Ly × t ; Nx × Ny détermine le pas discret Δx, Δy.',
      'Les valeurs publiées sont des points de départ, pas des paramètres expérimentaux validés de votre échantillon.',
      'Le curseur et la saisie exacte pilotent les mêmes paramètres ; pour le maillage et les dimensions, la modification est appliquée au relâchement.',
      'Le mode « laser idéalisé » crée une graine topologique : il ne simule pas la nucléation thermiquement activée. Vérifiez si |Q| persiste ; la stabilité n’est pas garantie hors du préréglage ou au-delà du temps testé.',
      'La FFT est facultative : le modèle effectif rapide utilise K=600 kJ/m³ ; le préréglage FFT passe à K=800 kJ/m³ pour ne pas compter deux fois la démagnétisation.',
      'Activez les capteurs depuis le bouton du haut : les inclinaisons commandent un champ virtuel Bx, By.'
    ],
    why: '<p>Cette simulation résout la LLG avec échange A, anisotropie uniaxiale Ku, DMI interfaciale D et champ extérieur B. L’option magnétostatique ajoute une approximation de film mince uniforme en z. Le pas doit rester suffisamment petit vis-à-vis des longueurs caractéristiques : les avertissements de maillage sont importants.</p><p class="eq">ℓex = √(2A / μ₀Ms²) ; Δ = √(A / |Ku|)</p><p><b>Injection laser :</b> une impulsion réelle modifie la température et peut déclencher une nucléation stochastique. Ici, une graine est imposée à t = 0 avant relaxation LLG : c’est un modèle effectif, et non une prédiction de seuil de fluence. <b>Limites :</b> pas de bruit thermique, pas de maillage 3D, bords DMI discrétisés à l’ordre un (disque en escalier), pas de minimiseur convergé ni contrôle automatique d’erreur temporelle. Pour une publication, comparer à un code validé.</p>',
    ub: { classes: ['df.Mesh', 'mm.Exchange', 'mm.UniaxialAnisotropy', 'mm.DMI', 'mm.Demag', 'oc.TimeDriver'], text: 'Pour valider une texture, utiliser OOMMF via Ubermag ou MuMax3, en raffinant progressivement le maillage.' },
    challenges: [],
    create: function (h, d) { return new SandboxSim(h, d); }
  },
  {
    id: 'compass',
    pack: 'bases',
    icon: '🧭',
    name: 'Boussole magnétique',
    tagline: 'Un aimant qui danse autour du champ',
    intro: 'La flèche blanche est l’aimantation m. La flèche orange est le champ B. Observe : m ne se range pas tout de suite, elle tourne autour de B avant de s’aligner.',
    params: [
      { id: 'B', label: 'Champ magnétique B', unit: 'mT', min: 0, max: 400, step: 1, value: 100, digits: 0, help: 'Plus B est fort, plus m tourne vite autour de lui.' },
      { id: 'thB', label: 'Inclinaison du champ', unit: '°', min: 0, max: 90, step: 1, value: 0, digits: 0, help: '0° : champ vertical. 90° : champ horizontal.' },
      { id: 'alpha', label: 'Frottement α (amortissement)', unit: '', min: 0, max: 1, step: 0.01, value: 0.1, digits: 2, help: 'α = 0 : aucune perte. α grand : m se range presque directement.' },
      { id: 'th0', label: 'Angle initial de m', unit: '°', min: 5, max: 175, step: 1, value: 60, digits: 0, help: 'Angle de départ entre m et B (relance la simulation).' }
    ],
    buttons: [
      { id: 'kick', label: '👆 Pichenette' },
      { id: 'flip', label: '🔄 Inverser le champ' },
      { id: 'reset', label: '↺ Recommencer' }
    ],
    whatIf: [
      { label: 'Et sans frottement ? (α = 0)', set: { alpha: 0 } },
      { label: 'Et un champ ×4 ?', set: { B: 400 } },
      { label: 'Et un frottement énorme ?', set: { alpha: 1 } }
    ],
    observe: [
      'Mets le frottement α à 0 : l’aimant tourne pour toujours. Pourquoi ne s’aligne-t-il jamais sur B ?',
      'Double le champ B. Que devient la fréquence ? Vérifie la règle : f ≈ 28 GHz × B (en tesla).',
      'Inverse le champ : m ne bascule pas d’un coup, il fait un grand demi-tour en spirale.',
      'Attrape la sphère à la souris et fais-la tourner pour la regarder sous un autre angle.'
    ],
    why: '<p>Le champ B exerce un <b>couple</b> sur m. Comme m est un moment cinétique (un spin), ce couple ne la tire pas vers B : il la fait <b>tourner autour de B</b>. C’est la <b>précession de Larmor</b>, à la fréquence <b>f = γB / 2π ≈ 28 GHz par tesla</b>.</p><p>Le frottement α (amortissement de Gilbert) dissipe de l’énergie : la spirale se resserre et m finit alignée sur B. Tout cela tient dans l’équation de Landau-Lifshitz-Gilbert :</p><p class="eq">dm/dt = −γ m × B + α m × dm/dt</p>',
    ub: { classes: ['mm.Zeeman', 'mm.Precession', 'mm.Damping'], text: 'Ubermag résout exactement cette équation pour des millions de cellules, avec OOMMF.' },
    challenges: [
      { id: 'cmp1', text: 'Fais précesser l’aimantation à plus de 10 GHz', test: function (o) { return o.f > 10; } },
      { id: 'cmp2', text: 'Aligne m sur B en moins de 0,5 ns (départ à plus de 60°)', test: function (o) { return o.alignedDur !== null && o.alignedDur < 0.5e-9; } },
      { id: 'cmp3', text: 'Précession éternelle : α = 0 et rien ne s’aligne pendant 3 ns', test: function (o, p) { return p.alpha === 0 && o.sinceEvent > 3e-9 && o.angle > 30; } }
    ],
    create: function (h, d) { return new CompassSim(h, d); }
  },
  {
    id: 'hysteresis',
    pack: 'bases',
    icon: '🔁',
    name: 'Hystérésis (Stoner-Wohlfarth)',
    tagline: 'Pourquoi un aimant a de la mémoire',
    intro: 'On balaie le champ de +B_max à −B_max puis on revient. Le cycle se dessine en direct. Retrouve la formule de Stoner-Wohlfarth en jouant avec l’angle ψ.',
    params: [
      { id: 'BK', label: 'Anisotropie B_K (dureté de l’aimant)', unit: 'mT', min: 20, max: 300, step: 5, value: 100, digits: 0, help: 'Champ qu’il faut pour retourner l’aimant quand le champ est aligné avec l’axe facile.' },
      { id: 'psi', label: 'Angle ψ champ / axe facile', unit: '°', min: 0, max: 90, step: 1, value: 20, digits: 0, help: '0° : champ le long de l’axe. 90° : champ perpendiculaire.' },
      { id: 'Bmax', label: 'Champ maximal du balayage', unit: 'mT', min: 50, max: 400, step: 5, value: 200, digits: 0, help: 'Si B_max est trop petit, l’aimant ne se retourne jamais.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.5, digits: 2, help: 'Un frottement élevé rend le balayage quasi-statique.' },
      { id: 'rate', label: 'Vitesse de balayage', unit: 'mT/ns', min: 10, max: 200, step: 5, value: 40, digits: 0, help: 'Plus lent = plus proche de la théorie statique.' },
      { id: 'auto', type: 'check', label: 'Balayage automatique', value: true, help: 'Décoche pour piloter le champ à la main.' },
      { id: 'B', label: 'Champ appliqué (manuel)', unit: 'mT', min: -400, max: 400, step: 1, value: 200, digits: 0, help: 'Touche ce curseur pour passer en mode manuel.' }
    ],
    buttons: [{ id: 'reset', label: '↺ Nouveau cycle' }],
    whatIf: [
      { label: 'Cycle carré (ψ = 0°)', set: { psi: 0 } },
      { label: 'ψ = 45° : le plus facile à retourner', set: { psi: 45 } },
      { label: 'Champ perpendiculaire (ψ = 90°)', set: { psi: 90 } }
    ],
    observe: [
      'Pour ψ = 0°, le cycle est un carré parfait : l’aimant se retourne d’un coup à B = B_K. Pourquoi si brutal ?',
      'Passe à ψ = 45° : retourner l’aimant devient 2× plus facile ! Regarde l’astroïde : la droite du champ la touche plus tôt.',
      'À ψ = 90° le cycle se referme : plus de mémoire. Pourquoi ?',
      'Baisse B_max sous le champ de retournement : l’aimant garde sa mémoire sans jamais basculer.'
    ],
    why: '<p>L’aimant a un <b>axe facile</b> (z) : deux directions stables, ↑ et ↓, séparées par une barrière d’énergie. Le champ <b>incline</b> ce paysage jusqu’à ce qu’un des deux creux disparaisse : l’aimant bascule alors d’un coup, de façon irréversible.</p><p class="eq">B_sw = B_K / (cos<sup>2/3</sup>ψ + sin<sup>2/3</sup>ψ)<sup>3/2</sup></p><p>La surface du cycle est l’énergie perdue en chaleur à chaque aller-retour : c’est le prix de la mémoire magnétique.</p>',
    ub: { classes: ['mm.UniaxialAnisotropy', 'mm.Zeeman', 'oc.HysteresisDriver'], text: 'Avec Ubermag, le même cycle se calcule pour un vrai nanomatériau, cellule par cellule.' },
    challenges: [
      { id: 'hys1', text: 'Retourne l’aimant avec un champ ≤ 60 % de B_K', test: function (o, p) { return o.swAbs !== null && o.swAbs <= 0.6 * p.BK; } },
      { id: 'hys2', text: 'Supprime l’hystérésis : champ perpendiculaire à l’axe', test: function (o, p) { return p.psi >= 89; } },
      { id: 'hys3', text: 'Mesure un retournement à ±10 % de la formule théorique', test: function (o, p) { return o.swAbs !== null && p.psi < 89 && Math.abs(o.swAbs - o.th) < 0.1 * o.th; } }
    ],
    create: function (h, d) { return new HysteresisSim(h, d); }
  },
  {
    id: 'wall',
    pack: 'textures',
    icon: '🧱',
    name: 'Paroi de domaine',
    tagline: 'La frontière entre deux mondes magnétiques',
    intro: 'À gauche l’aimantation pointe vers le haut, à droite vers le bas. Entre les deux, une paroi. Un champ B_z la pousse. La DMI lui donne sa forme.',
    params: [
      { id: 'A', label: 'Échange A', unit: 'pJ/m', min: 8, max: 30, step: 1, value: 15, digits: 0, help: 'Veut élargir la paroi (les spins voisins veulent rester parallèles).' },
      { id: 'K', label: 'Anisotropie K', unit: 'kJ/m³', min: 150, max: 800, step: 10, value: 500, digits: 0, help: 'Veut rétrécir la paroi (les spins veulent pointer ↑ ou ↓).' },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 5, step: 0.1, value: 2, digits: 1, help: 'Interaction de Dzyaloshinskii-Moriya : impose un sens de rotation.' },
      { id: 'Bz', label: 'Champ B_z', unit: 'mT', min: -100, max: 100, step: 1, value: 40, digits: 0, help: 'Pousse la paroi : le domaine aligné sur le champ grandit.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.02, max: 1, step: 0.01, value: 0.3, digits: 2, log: true, help: 'Freine la paroi.' }
    ],
    buttons: [{ id: 'reset', label: '↺ Recommencer' }],
    whatIf: [
      { label: 'Et sans DMI ? (D = 0)', set: { D: 0 } },
      { label: 'Et avec beaucoup de DMI ?', set: { D: 4.5 } },
      { label: 'Et un champ nul ?', set: { Bz: 0 } }
    ],
    observe: [
      'Sans DMI, la direction interne de la paroi dépend ici de la condition initiale : sans magnétostatique, Bloch et Néel ne sont pas distinguées énergétiquement. Une DMI non nulle favorise une chiralité Néel.',
      'Applique un champ B_z : la paroi avance. Mesure sa vitesse, puis double α. Que se passe-t-il ?',
      'Largeur Δ = √(A/K) : augmente K et vérifie que la paroi s’amincit.',
      'Monte D au-dessus de D_c : le critère de stabilité de la paroi isolée est dépassé. Ce modèle 1D ne peut pas représenter un plissement 2D.'
    ],
    why: '<p>Entre un domaine ↑ et un domaine ↓, l’aimantation tourne progressivement : c’est la <b>paroi</b>, de largeur <b>Δ = √(A/K)</b>. L’échange A veut l’élargir, l’anisotropie K veut la rétrécir.</p><p>La <b>DMI</b> favorise une rotation dans un seul sens (la <b>chiralité</b>). Sans champ démagnétisant, les géométries Bloch et Néel restent dégénérées si D = 0. Sous champ, la paroi avance à environ <b>v ≈ γΔB/α</b> : sans DMI elle tourne sur elle-même et avance bien plus lentement.</p>',
    ub: { classes: ['mm.Exchange', 'mm.DMI', 'mm.UniaxialAnisotropy', 'mm.Zeeman'], text: 'Ce sont exactement les termes d’énergie qu’on ajoute à un mm.System dans Ubermag.' },
    challenges: [
      { id: 'wal1', text: 'Obtiens une paroi de Néel', test: function (o, p) { return p.D > 0.5 && o.type === 'Néel'; } },
      { id: 'wal2', text: 'Fais avancer la paroi à plus de 150 m/s', test: function (o) { return o.v !== null && o.v > 150; } },
      { id: 'wal3', text: 'Amincis la paroi sous 4 nm', test: function (o) { return o.wallW < 4e-9; } }
    ],
    create: function (h, d) { return new WallSim(h, d); }
  },
  {
    id: 'wallpin',
    pack: 'textures',
    icon: '📌',
    name: 'Paroi — Pinning',
    tagline: 'Piéger puis libérer une paroi',
    intro: 'Observe l’approche, l’accrochage puis le dépiégeage : le défaut est indiqué directement sur la paroi lorsqu’elle le recouvre, et reste fixe dans le matériau. LLG 1D à anisotropie spatiale.',
    params: [
      { id: 'A', label: 'Échange A', unit: 'pJ/m', min: 8, max: 30, step: 1, value: 15, digits: 0 },
      { id: 'K', label: 'Anisotropie de fond K₀', unit: 'kJ/m³', min: 150, max: 800, step: 10, value: 500, digits: 0 },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 4, step: 0.1, value: 1.5, digits: 1 },
      { id: 'Bz', label: 'Champ de propulsion Bz', unit: 'mT', min: -150, max: 150, step: 1, value: 12, digits: 0, help: 'Bz > 0 pousse la paroi vers la droite. Le seuil indiqué est une approximation quasi-statique.' },
      { id: 'alpha', label: 'Amortissement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.4, digits: 2 },
      { id: 'xPin', label: 'Position du défaut xₚ', unit: 'nm', min: 75, max: 405, step: 3, value: 240, digits: 0, help: 'Déplacer le défaut relance la paroi en amont pour comparer les essais.' },
      { id: 'sigma', label: 'Largeur σ du défaut', unit: 'nm', min: 3, max: 60, step: 1, value: 12, digits: 0, help: 'Écart-type de la gaussienne. Attention si σ est voisin du pas de grille 3 nm.' },
      { id: 'depth', label: 'Réduction locale ΔK / K₀', unit: '%', min: 0, max: 90, step: 5, value: 35, digits: 0, help: '0 % supprime le pinning, 90 % donne un puits d’anisotropie prononcé.' }
    ],
    buttons: [{ id: 'reset', label: '↺ Repartir avant le défaut' }, { id: 'capture', label: '📌 Piéger (12 mT)' }, { id: 'release', label: '↗ Dépiéger (110 mT)' }],
    whatIf: [
      { label: 'Aucun défaut', set: { depth: 0 }, act: 'reset' },
      { label: 'Piégeage fort', set: { depth: 70, Bz: 8 }, act: 'reset' },
      { label: 'Dépiéger (champ fort)', set: { Bz: 110 } },
      { label: 'Champ nul', set: { Bz: 0 }, act: 'reset' }
    ],
    observe: [
      'L’orange apparaît sur les spins de la paroi lorsqu’ils recouvrent le défaut fixe. Le graphique K/K₀ montre sa position et sa largeur dans le matériau.',
      'À champ faible, regarde la paroi se rapprocher du défaut ; vérifie si sa position cesse d’évoluer.',
      'Augmente Bz progressivement jusqu’à ce que la paroi traverse le défaut : le seuil dépend du défaut et de la dynamique.',
      'Compare avec « Aucun défaut » en conservant les autres constantes.',
      'L’estimation affichée de B de dépiégeage vient d’un modèle de paroi rigide quasi-statique : le seuil simulé peut différer.'
    ],
    why: '<p>Une paroi coûte de l’énergie d’anisotropie là où m<sub>z</sub>² &lt; 1. Un défaut où K<sub>u</sub> diminue abaisse cette énergie : il crée un <b>puits de potentiel</b> pour la paroi, pas une force rajoutée arbitrairement.</p><p class="eq">K<sub>u</sub>(x) = K₀ [1 − δ exp(−(x−xₚ)² / 2σ²)]</p><p>Le solveur utilise localement B<sub>anis,z</sub>(x) = 2 K<sub>u</sub>(x) m<sub>z</sub> / M<sub>s</sub>. Le champ B<sub>z</sub> incline le potentiel avec une force 2M<sub>s</sub>B<sub>z</sub> par unité de section. Le seuil affiché est obtenu à partir du maximum de pente de U(q) calculé pour une paroi rigide de largeur Δ = √(A/K₀).</p><p><b>Limites :</b> modèle 1D, sans magnétostatique, désordre thermique, courbure des parois ni effets de bord réalistes. Une paroi proche du défaut et momentanément immobile n’est pas une preuve de piégeage stationnaire. Sources : <a href="https://doi.org/10.1088/0953-8984/24/2/024216" target="_blank" rel="noopener">pinning par variation locale de K</a> ; <a href="https://arxiv.org/abs/1112.1259" target="_blank" rel="noopener">Pt/Co/Pt</a>.</p>',
    ub: { classes: ['mm.Exchange', 'mm.UniaxialAnisotropy', 'mm.Zeeman', 'oc.TimeDriver'], text: 'OOMMF autorise une anisotropie variant d’une cellule à l’autre. Reproduire le profil K(x) et balayer Bz pour comparer les champs de dépiégeage.' },
    challenges: [],
    create: function (h, d) { return new WallSim(h, d, true); }
  },
  {
    id: 'vortex',
    pack: 'textures',
    icon: '🌪️',
    name: 'Vortex dans un disque',
    tagline: 'Une tornade magnétique de 10 nm',
    intro: 'Dans un petit disque doux, l’aimantation s’enroule en cercle autour d’un cœur qui pointe hors du plan. Pousse-le et regarde-le tourner en spirale.',
    params: [
      { id: 'diam', label: 'Diamètre du disque', unit: 'nm', min: 60, max: 150, step: 5, value: 120, digits: 0, help: 'Relance la simulation.' },
      { id: 'thick', label: 'Épaisseur', unit: 'nm', min: 5, max: 40, step: 1, value: 20, digits: 0, help: 'Relance la simulation.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.5, step: 0.005, value: 0.05, digits: 3, log: true, help: 'Petit α : le cœur fait beaucoup de tours.' },
      { id: 'Bx', label: 'Champ B_x (dans le plan)', unit: 'mT', min: -150, max: 150, step: 1, value: 0, digits: 0, help: 'Décale le cœur perpendiculairement au champ.' },
      { id: 'By', label: 'Champ B_y (dans le plan)', unit: 'mT', min: -150, max: 150, step: 1, value: 0, digits: 0, help: 'Même effet, dans l’autre direction.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'wheel', options: [['wheel', 'Roue des couleurs'], ['mz', 'Composante z']], help: 'La roue montre la direction dans le plan.' },
      { id: 'arrows', type: 'check', label: 'Afficher les flèches', value: false, help: '' }
    ],
    buttons: [
      { id: 'pulse', label: '💥 Impulsion de champ' },
      { id: 'vortex', label: '🌀 Vortex décalé' },
      { id: 'random', label: '🎲 État aléatoire' },
      { id: 'uniform', label: '➡ Uniforme' }
    ],
    whatIf: [
      { label: 'Et un frottement minuscule ?', set: { alpha: 0.008 } },
      { label: 'Et un disque plus épais ?', set: { thick: 35 } },
      { label: 'Et un champ fort ?', set: { Bx: 120 } }
    ],
    observe: [
      'Les couleurs tournent autour du centre : c’est la circulation. Au centre, le cœur est blanc ou noir : c’est la polarité (↑ ou ↓).',
      'Le cœur décalé revient en spirale (mouvement gyrotropique) : il ne revient jamais en ligne droite. Baisse α pour compter plus de tours.',
      'Applique un champ dans le plan : le cœur se déplace perpendiculairement au champ. Trop fort : le vortex est expulsé !',
      'Lance « État aléatoire » : l’aimantation s’organise toute seule en vortex.'
    ],
    why: '<p>Dans un disque doux, l’énergie magnétostatique est minimale quand l’aimantation tourne en cercle : <b>aucun pôle magnétique sur le bord</b>. Au centre, l’aimantation doit sortir du plan : c’est le <b>cœur</b>, large d’environ deux longueurs d’échange.</p><p>Quand on décale le cœur, la force de rappel magnétostatique et l’effet gyroscopique le font <b>spiraler</b> autour du centre : c’est le mode gyrotropique, à quelques centaines de MHz jusqu’au GHz.</p>',
    ub: { classes: ['mm.Demag', 'mm.Exchange', 'df.Field'], text: 'Le champ démagnétisant (mm.Demag) est ce qui crée ce vortex. Ici il est calculé par transformée de Fourier rapide.' },
    challenges: [
      { id: 'vor1', text: 'Fais naître un vortex depuis l’état aléatoire', test: function (o) { return o.mode === 'random' && o.circAbs > 0.6 && o.t > 3e-10; } },
      { id: 'vor2', text: 'Déplace le cœur à plus de 25 nm du centre', test: function (o) { return o.coreR > 25 && o.circAbs > 0.4; } }
    ],
    create: function (h, d) { return new VortexSim(h, d); }
  },
  {
    id: 'skyrmion',
    pack: 'textures',
    icon: '🌀',
    name: 'Skyrmions',
    tagline: 'Des particules magnétiques topologiques',
    intro: 'Un skyrmion est un nœud d’aimantation protégé topologiquement. Joue avec la DMI et le champ : tu verras apparaître des bulles, des labyrinthes, ou plus rien.',
    params: [
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 6, step: 0.1, value: 3.5, digits: 1, help: 'Favorise l’enroulement. Au-dessus de D_c, l’état uniforme devient instable.' },
      { id: 'K', label: 'Anisotropie effective K', unit: 'kJ/m³', min: 300, max: 1000, step: 10, value: 600, digits: 0, help: 'Garde l’aimantation perpendiculaire au film.' },
      { id: 'Bz', label: 'Champ perpendiculaire B_z', unit: 'mT', min: -50, max: 250, step: 5, value: 0, digits: 0, help: 'Un champ ↑ fait rétrécir les zones ↓.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.1, max: 1, step: 0.01, value: 0.5, digits: 2, log: true, help: 'Fort α : relaxation rapide.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'wheel', options: [['wheel', 'Roue des couleurs'], ['mz', 'Composante z']], help: '' },
      { id: 'arrows', type: 'check', label: 'Afficher les flèches', value: false, help: '' }
    ],
    buttons: [
      { id: 'seed', label: '🌀 Un skyrmion' },
      { id: 'random', label: '🎲 Aléatoire' },
      { id: 'uniform', label: '⬆ Uniforme' }
    ],
    whatIf: [
      { label: 'Et plus de DMI ? (labyrinthe)', set: { D: 4.6 } },
      { label: 'Et un champ fort ?', set: { Bz: 220 } },
      { label: 'Et sans DMI ?', set: { D: 0 } }
    ],
    observe: [
      'Appuie sur « Un skyrmion » : une boule d’aimantation inversée, enroulée sur elle-même. Q = ±1 : on ne peut pas la défaire sans casser la structure (protection topologique).',
      'Monte D au-dessus de D_c (D/D_c > 1) puis lance « Aléatoire » : l’état uniforme est instable, un labyrinthe de rubans apparaît.',
      'Applique un champ B_z : les rubans se cassent en skyrmions isolés (|Q| augmente).',
      'Trop de champ : le skyrmion rétrécit puis disparaît. Q retombe à 0.'
    ],
    why: '<p>La <b>DMI</b> favorise l’enroulement de l’aimantation. En compétition avec l’échange et l’anisotropie, elle stabilise des tourbillons localisés : les <b>skyrmions</b>.</p><p>Leur <b>charge topologique</b> vaut Q = (1/4π) ∫ m · (∂ₓm × ∂ᵧm) dx dy = ±1. Ce nombre entier ne change pas sous une déformation continue : un skyrmion est donc très robuste, et peut être déplacé par des courants très faibles.</p>',
    ub: { classes: ['mm.DMI(crystalclass="Cnv_z")', 'mm.UniaxialAnisotropy', 'mm.Zeeman', 'oc.MinDriver'], text: 'Ubermag fournit des exemples complets de skyrmions, avec calcul de la charge topologique.' },
    challenges: [
      { id: 'sky1', text: 'Crée un skyrmion stable : |Q| ≈ 1 après 0,4 ns', test: function (o) { return Math.abs(Math.abs(o.Q) - 1) < 0.2 && o.t > 4e-10; } },
      { id: 'sky2', text: 'Fais naître un labyrinthe de rubans', test: function (o) { return o.maze; } },
      { id: 'sky3', text: 'Fabrique au moins 4 skyrmions (|Q| ≥ 4)', test: function (o) { return Math.abs(o.Q) >= 3.6 && o.t > 4e-10; } }
    ],
    create: function (h, d) { return new SkyrmionSim(h, d, 'static'); }
  },
  {
    id: 'fmr',
    pack: 'dynamique',
    icon: '🔔',
    name: 'Résonance ferromagnétique',
    tagline: 'Faire chanter un aimant à la bonne fréquence',
    intro: 'Un champ micro-onde b(t) secoue l’aimant. À une fréquence précise, tout s’emballe. Trouve-la à l’oreille, puis vérifie avec la formule de Kittel.',
    params: [
      { id: 'B0', label: 'Champ statique B₀ (dans le plan)', unit: 'mT', min: 0, max: 300, step: 1, value: 100, digits: 0, help: 'Fixe la note de l’aimant.' },
      { id: 'mat', type: 'select', label: 'Matériau', value: 'py', options: [['py', 'Permalloy (μ₀Ms = 1,0 T)'], ['cofeb', 'CoFeB (1,6 T)'], ['yig', 'YIG (0,18 T)']], help: 'μ₀Ms change la fréquence de résonance.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.002, max: 0.2, step: 0.001, value: 0.02, digits: 3, log: true, help: 'Petit α : résonance fine et haute.' },
      { id: 'f', label: 'Fréquence de pilotage', unit: 'GHz', min: 1, max: 40, step: 0.1, value: 5, digits: 1, help: 'Fréquence du champ micro-onde.' },
      { id: 'bac', label: 'Amplitude du champ micro-onde', unit: 'mT', min: 0.1, max: 5, step: 0.1, value: 1, digits: 1, help: 'Le « coup de marteau » à chaque période.' }
    ],
    buttons: [
      { id: 'tune', label: '🎯 Accorder sur la résonance' },
      { id: 'kick', label: '🔔 Taper l’aimant' },
      { id: 'reset', label: '↺ Recommencer' }
    ],
    whatIf: [
      { label: 'Et un matériau très amorti ?', set: { alpha: 0.2 } },
      { label: 'Et un amortissement minimal ?', set: { alpha: 0.002 } },
      { label: 'Et du CoFeB ?', set: { mat: 'cofeb' } }
    ],
    observe: [
      'Balaie la fréquence de pilotage : à quelle valeur l’amplitude explose ? Compare à la formule de Kittel affichée.',
      'Baisse α : la résonance devient plus fine et plus haute. C’est le facteur de qualité d’un diapason magnétique.',
      'Appuie sur « Taper l’aimant » : le spectre à droite montre la note que l’aimant joue tout seul.',
      'Change de matériau : μ₀Ms change la note. Le YIG a un amortissement record : descends α au minimum !'
    ],
    why: '<p>Dans un film mince aimanté dans son plan, la fréquence de résonance (<b>formule de Kittel</b>) est</p><p class="eq">f = (γ/2π) · √( B₀ (B₀ + μ₀Ms) )</p><p>Si on pousse l’aimantation exactement à cette fréquence, chaque poussée s’ajoute à la précédente : l’amplitude grandit, limitée seulement par l’amortissement α. C’est le principe des filtres micro-ondes magnétiques et de la spintronique.</p>',
    ub: { classes: ['mm.Zeeman(H=…, func=…)', 'mm.Demag', 'oc.TimeDriver'], text: 'En vrai micromagnétisme, on excite par une impulsion de champ et on fait une transformée de Fourier : exactement ce que fait le spectre libre ici.' },
    challenges: [
      { id: 'fmr1', text: 'Fais osciller l’aimantation de plus de 15° d’amplitude', test: function (o) { return o.amp > 0.26; } },
      { id: 'fmr2', text: 'Fais résonner l’aimant à 20 GHz (±1)', test: function (o, p) { return Math.abs(o.fres - 20) < 1 && Math.abs(p.f - o.fres) < 1 && o.amp > 0.08; } },
      { id: 'fmr3', text: 'Résonance très fine : α ≤ 0,005 et amplitude > 30°', test: function (o, p) { return p.alpha <= 0.0051 && o.amp > 0.5; } }
    ],
    create: function (h, d) { return new FmrSim(h, d); }
  },
  {
    id: 'pulse',
    pack: 'dynamique',
    icon: '💥',
    name: 'Retournement par impulsion',
    tagline: 'Retourner un bit en 100 picosecondes',
    intro: 'Un bref pic de champ dans le plan fait partir l’aimant en précession. Coupe-le au bon moment : l’aimant tombe de l’autre côté. Trouve la fenêtre qui marche.',
    params: [
      { id: 'BK', label: 'Anisotropie B_K', unit: 'mT', min: 20, max: 400, step: 5, value: 200, digits: 0, help: 'Hauteur de la barrière qui garde l’aimant ↑.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.3, step: 0.005, value: 0.02, digits: 3, log: true, help: 'Petit α : précession longue.' },
      { id: 'Bp', label: 'Amplitude de l’impulsion B_p', unit: 'mT', min: 0, max: 500, step: 1, value: 150, digits: 0, help: 'Doit dépasser B_K / 2.' },
      { id: 'tau', label: 'Durée de l’impulsion', unit: 'ps', min: 10, max: 400, step: 1, value: 100, digits: 0, help: 'Environ un demi-tour de précession.' }
    ],
    buttons: [
      { id: 'fire', label: '⚡ Tirer l’impulsion' },
      { id: 'cal', label: '🎯 Trouver la durée idéale' }
    ],
    whatIf: [
      { label: 'Et une impulsion trop courte ?', set: { tau: 20 } },
      { label: 'Et une impulsion trop faible ?', set: { Bp: 60 } },
      { label: 'Et un aimant plus mou ? (B_K = 60)', set: { BK: 60 } }
    ],
    observe: [
      'Appuie sur « Tirer l’impulsion » : l’aimant part en vrille… et finit à l’envers ?',
      'Regarde la carte : des bandes de succès apparaissent. Pourquoi des bandes et pas une zone pleine ?',
      'Clique sur une zone claire de la carte : tu retournes à coup sûr. Sur une zone sombre : raté.',
      'Cherche l’impulsion la plus courte qui marche. Que faut-il augmenter ?'
    ],
    why: '<p>Un champ perpendiculaire à l’aimantation la fait <b>précesser</b>. Si on coupe l’impulsion à peu près après un <b>demi-tour</b> de précession, l’aimant se retrouve de l’autre côté de la barrière d’énergie et finit par se stabiliser à l’envers.</p><p>Il faut <b>B_p > B_K / 2</b> et une durée d’environ <b>π/(γ B_p)</b> : plus de champ, impulsion plus courte (le produit B_p × durée reste ≈ constant). Les bandes de la carte correspondent à 1, 3, 5… demi-tours.</p>',
    ub: { classes: ['mm.Zeeman', 'mm.UniaxialAnisotropy', 'oc.TimeDriver'], text: 'Ce retournement « balistique » est étudié en détail dans les mémoires magnétiques ultra-rapides.' },
    challenges: [
      { id: 'pul1', text: 'Retourne l’aimant avec une impulsion', test: function (o) { return o.flipped; } },
      { id: 'pul2', text: 'Retourne avec une impulsion de moins de 60 ps', test: function (o) { return o.flipped && o.tau < 60; } },
      { id: 'pul3', text: 'Retourne avec une impulsion de moins de 50 mT', test: function (o) { return o.flipped && o.Bp < 50; } }
    ],
    create: function (h, d) { return new PulseSim(h, d); }
  },
  {
    id: 'swave',
    pack: 'dynamique',
    icon: '🌊',
    name: 'Ondes de spin (magnons)',
    tagline: 'Des vagues d’aimantation sans courant électrique',
    intro: 'Une antenne fait osciller l’aimantation localement. La perturbation se propage de spin en spin comme une vague. Joue avec la fréquence, comme avec une radio.',
    params: [
      { id: 'f', label: 'Fréquence de l’antenne', unit: 'GHz', min: 1, max: 12, step: 0.1, value: 7, digits: 1, help: 'Au-dessus de f₀ l’onde se propage. En dessous : rien.' },
      { id: 'B', label: 'Champ perpendiculaire B', unit: 'mT', min: 0, max: 300, step: 1, value: 100, digits: 0, help: 'Déplace la fréquence de coupure f₀ : un interrupteur magnétique !' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.001, max: 0.05, step: 0.001, value: 0.005, digits: 3, log: true, help: 'L’amortissement fait mourir l’onde.' },
      { id: 'b0', label: 'Puissance de l’antenne', unit: 'mT', min: 0.5, max: 10, step: 0.5, value: 4, digits: 1, help: 'Amplitude du champ micro-onde de l’antenne.' },
      { id: 'src', type: 'select', label: 'Source', value: 'point', options: [['point', 'Point (ondes circulaires)'], ['line', 'Ligne (onde plane)'], ['two', 'Deux points (interférences)']], help: '' }
    ],
    buttons: [{ id: 'reset', label: '↺ Relancer' }],
    whatIf: [
      { label: 'Et deux sources ?', set: { src: 'two' } },
      { label: 'Et une onde plane ?', set: { src: 'line' } },
      { label: 'Et sous la fréquence de coupure ?', set: { f: 2 } }
    ],
    observe: [
      'Lance la simulation : l’antenne (anneau orange) émet des ondes circulaires. Mesure la longueur d’onde sur la coupe à droite.',
      'Augmente la fréquence : la longueur d’onde diminue (relation de dispersion, à gauche).',
      'Descends sous la fréquence de coupure f₀ : plus de propagation ! Joue avec B comme avec un interrupteur.',
      'Choisis « Deux points » : tu obtiens des franges d’interférences, comme avec des vagues sur l’eau.'
    ],
    why: '<p>Une <b>onde de spin</b> (ou magnon) est une précession qui se propage de spin en spin grâce à l’échange. Sa fréquence vaut</p><p class="eq">f = (γ/2π) · ( B<sub>int</sub> + (2A/Ms) k² )</p><p>Il existe donc une <b>fréquence minimale f₀</b> (le « gap ») : en dessous, aucune onde ne se propage. C’est le domaine de la <b>magnonique</b> : transporter de l’information sans courant de charge, donc sans effet Joule.</p>',
    ub: { classes: ['mm.Exchange', 'mm.Zeeman', 'oc.TimeDriver'], text: 'Avec Ubermag, on excite une bande de cellules avec un champ micro-onde et on observe la propagation, exactement comme ici.' },
    challenges: [
      { id: 'sw1', text: 'Fais propager une onde de spin', test: function (o) { return o.prop && o.t > 3e-10; } },
      { id: 'sw2', text: 'Coupe la propagation : fréquence sous le gap f₀', test: function (o) { return !o.prop && o.f < o.f0 - 0.3; } },
      { id: 'sw3', text: 'Fabrique une onde de longueur d’onde < 90 nm', test: function (o) { return o.prop && o.lambda < 90e-9; } },
      { id: 'sw4', text: 'Fais des interférences avec deux sources', test: function (o, p) { return p.src === 'two' && o.prop && o.t > 3e-10; } }
    ],
    create: function (h, d) { return new SpinWaveSim(h, d); }
  },
  {
    id: 'stt',
    pack: 'spintro',
    icon: '🔌',
    name: 'Écrire avec un courant (STT)',
    tagline: 'Un courant qui retourne un aimant',
    intro: 'Un courant polarisé en spin traverse l’aimant et le fait basculer. Écris un 1 ou un 0 comme dans une mémoire MRAM. Trouve le courant seuil.',
    params: [
      { id: 'BK', label: 'Anisotropie B_K', unit: 'mT', min: 20, max: 300, step: 5, value: 100, digits: 0, help: 'Dureté de l’aimant.' },
      { id: 'Bz', label: 'Champ de biais B_z', unit: 'mT', min: -50, max: 50, step: 1, value: 0, digits: 0, help: 'Favorise ↑ ou ↓.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.3, step: 0.005, value: 0.05, digits: 3, log: true, help: 'Le courant doit vaincre ce frottement.' },
      { id: 'aJ', label: 'Courant (torque de spin a_J)', unit: 'mT', min: -40, max: 40, step: 0.5, value: 0, digits: 1, help: 'Positif : pousse m loin du polariseur p. Négatif : l’en rapproche.' }
    ],
    buttons: [
      { id: 'writeDown', label: '✍ Écrire ↓ (0)' },
      { id: 'writeUp', label: '✍ Écrire ↑ (1)' },
      { id: 'reset', label: '↺ Recommencer' }
    ],
    whatIf: [
      { label: 'Et un frottement minuscule ?', set: { alpha: 0.01 } },
      { label: 'Et un aimant plus mou ?', set: { BK: 40 } },
      { label: 'Et un champ de biais fort ?', set: { Bz: 40 } }
    ],
    observe: [
      'Monte le courant lentement : à partir de quel seuil l’aimant bascule ? Compare au seuil théorique affiché.',
      'Appuie sur « Écrire ↓ » puis « Écrire ↑ » : tu viens d’écrire un bit, comme dans une MRAM.',
      'Baisse α ou B_K : le seuil baisse. Comment économiser de l’énergie dans une mémoire ?',
      'Ajoute un champ de biais : le seuil est-il le même pour ↑→↓ et ↓→↑ ?'
    ],
    why: '<p>Un courant qui traverse une couche polarisée transporte du moment cinétique de spin. En entrant dans l’aimant, il exerce un <b>couple de transfert de spin</b> : il agit comme un <b>anti-frottement</b>.</p><p>Quand ce couple compense l’amortissement de Gilbert, <b>a_J > α (B_K + B)</b>, l’aimant quitte sa position d’équilibre et bascule. C’est le principe des mémoires MRAM à couple de transfert de spin.</p>',
    ub: { classes: ['mm.Slonczewski', 'mm.UniaxialAnisotropy', 'mm.Damping'], text: 'Ubermag propose le terme de Slonczewski pour simuler ces dispositifs spintroniques.' },
    challenges: [
      { id: 'stt1', text: 'Fais basculer l’aimant vers le bas (↓)', test: function (o) { return o.mz < -0.9; } },
      { id: 'stt2', text: 'Écris ↓ puis réécris ↑ : un cycle complet', test: function (o) { return o.cycle; } },
      { id: 'stt3', text: 'Fais basculer avec un courant inférieur à 3 mT', test: function (o) { return o.swAmp !== null && Math.abs(o.swAmp) < 3; } }
    ],
    create: function (h, d) { return new SttSim(h, d); }
  },
  {
    id: 'sto',
    pack: 'spintro',
    icon: '📡',
    name: 'Nano-oscillateur',
    tagline: 'Un courant continu qui fait osciller à 10 GHz',
    intro: 'Au-dessus d’un courant seuil, le couple de spin entretient la précession : un courant continu fabrique un signal micro-onde. Regarde l’orbite grandir puis se stabiliser.',
    params: [
      { id: 'B', label: 'Champ dans le plan B', unit: 'mT', min: 20, max: 300, step: 1, value: 100, digits: 0, help: 'Règle la fréquence.' },
      { id: 'mu0Ms', label: 'Aimantation μ₀Ms', unit: 'T', min: 0.2, max: 1.6, step: 0.05, value: 1.0, digits: 2, help: 'Matériau de la couche libre.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.1, step: 0.001, value: 0.02, digits: 3, log: true, help: 'Fixe le seuil.' },
      { id: 'aJ', label: 'Courant (torque de spin a_J)', unit: 'mT', min: 0, max: 40, step: 0.5, value: 16, digits: 1, help: 'Au-dessus du seuil a_c, l’oscillateur démarre.' }
    ],
    buttons: [
      { id: 'kick', label: '👆 Pichenette' },
      { id: 'reset', label: '↺ Recommencer' }
    ],
    whatIf: [
      { label: 'Et sous le seuil ?', set: { aJ: 5 } },
      { label: 'Et un champ fort ?', set: { B: 250 } },
      { label: 'Et un faible amortissement ?', set: { alpha: 0.008, aJ: 8 } }
    ],
    observe: [
      'Au-dessus du seuil a_c, l’aimant oscille tout seul. Regarde l’orbite à droite : elle grandit puis se stabilise (cycle limite).',
      'Augmente le champ B : la fréquence monte. Que fait la fréquence quand tu augmentes le courant ?',
      'Passe sous le seuil : les oscillations meurent. Pourquoi ?',
      'À quelle fréquence peux-tu faire osciller ton nano-émetteur ? Les oscillateurs spintroniques ne font que quelques dizaines de nm.'
    ],
    why: '<p>Pour <b>a_J > a_c = α (B + μ₀Ms/2)</b>, le couple de spin compense plus que l’amortissement : l’aimant est <b>entretenu</b> en précession. L’amplitude se stabilise quand les pertes, qui croissent avec l’amplitude, rattrapent le gain.</p><p>Résultat : un <b>courant continu</b> produit un <b>signal micro-onde</b> avec un composant de quelques dizaines de nanomètres.</p>',
    ub: { classes: ['mm.Slonczewski', 'mm.Demag', 'oc.TimeDriver'], text: 'La version micromagnétique complète tient compte de la forme du nano-pilier, ce que le macrospin ignore.' },
    challenges: [
      { id: 'sto1', text: 'Allume l’oscillateur : amplitude entretenue > 20°', test: function (o) { return o.amp > 0.34; } },
      { id: 'sto2', text: 'Fais osciller à plus de 15 GHz', test: function (o) { return o.f !== null && o.f > 15 && o.amp > 0.2; } },
      { id: 'sto3', text: 'Accorde 10 GHz (±0,5)', test: function (o) { return o.f !== null && Math.abs(o.f - 10) < 0.5 && o.amp > 0.2; } }
    ],
    create: function (h, d) { return new StoSim(h, d); }
  },
  {
    id: 'skcur',
    pack: 'spintro',
    icon: '💫',
    name: 'Skyrmion poussé par courant',
    tagline: 'La course des skyrmions',
    intro: 'Un courant d’électrons pousse le skyrmion. Il ne va pas tout droit : l’effet Hall de skyrmion le dévie. Règle β/α pour changer sa trajectoire.',
    params: [
      { id: 'u', label: 'Vitesse des électrons u', unit: 'm/s', min: 0, max: 400, step: 5, value: 150, digits: 0, help: 'Proportionnelle à la densité de courant.' },
      { id: 'dir', label: 'Direction du courant', unit: '°', min: 0, max: 360, step: 5, value: 0, digits: 0, help: '0° : vers la droite. 90° : vers le haut.' },
      { id: 'ratio', label: 'β / α (non-adiabaticité)', unit: '', min: 0, max: 2, step: 0.05, value: 0.2, digits: 2, help: 'β = α : plus d’effet Hall.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.3, digits: 2, help: 'Un fort α réduit l’angle de Hall.' }
    ],
    buttons: [
      { id: 'seed', label: '🌀 Nouveau skyrmion' },
      { id: 'clear', label: '🧹 Effacer la trace' }
    ],
    whatIf: [
      { label: 'Et β = α ? (pas de Hall)', set: { ratio: 1 } },
      { label: 'Et un courant vers le haut ?', set: { dir: 90 } },
      { label: 'Et un très fort frottement ?', set: { alpha: 1 } }
    ],
    observe: [
      'Pousse le skyrmion : il ne va pas tout droit ! Mesure l’angle de Hall dans le tableau en haut.',
      'Mets β/α = 1 : l’angle de Hall disparaît, le skyrmion suit exactement le courant.',
      'Change la direction du courant : l’angle de déviation par rapport à lui reste le même.',
      'Augmente α : l’angle de Hall diminue. Pourquoi un fort frottement « redresse » la trajectoire ?'
    ],
    why: '<p>Un courant polarisé en spin exerce un couple de <b>Zhang-Li</b> : un terme adiabatique et un terme non adiabatique β. Le skyrmion se comporte comme une particule avec un moment gyroscopique G = 4πQ : le courant le pousse, mais l’effet gyroscopique ajoute une vitesse <b>perpendiculaire</b> : c’est l’<b>effet Hall de skyrmion</b>.</p><p>Quand <b>β = α</b>, la vitesse du skyrmion est exactement celle des électrons et l’angle de Hall s’annule.</p>',
    ub: { classes: ['mm.ZhangLi', 'mm.DMI', 'mm.UniaxialAnisotropy'], text: 'Dans Ubermag, on ajoute mm.ZhangLi à l’équation de dynamique pour piloter un skyrmion avec un courant.' },
    challenges: [
      { id: 'skc1', text: 'Fais avancer le skyrmion à plus de 30 m/s', test: function (o) { return o.v !== null && o.v > 30; } },
      { id: 'skc2', text: 'Annule l’effet Hall : angle de Hall < 5°', test: function (o) { return o.hall !== null && o.v > 10 && Math.abs(o.hall) < 5; } },
      { id: 'skc3', text: 'Fais dévier le skyrmion de plus de 45° du courant', test: function (o) { return o.hall !== null && o.v > 10 && Math.abs(o.hall) > 45; } }
    ],
    create: function (h, d) { return new SkyrmionSim(h, d, 'current'); }
  }
];
