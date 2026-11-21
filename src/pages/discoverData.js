// Contenu repris du prototype Aimantarium (js/catalogue/parcours.js).

export const GRANDEURS = {
  B: { sym: 'B', name: 'Champ magnétique', role: 'Il tire sur l’aimantation : il la fait tourner, basculer, et pousse les parois.' },
  m: { sym: 'm', name: 'Aimantation', role: 'La direction où pointent ensemble les minuscules aimants (les spins) d’une petite région.' },
  A: { sym: 'A', name: 'Échange', role: 'Chaque spin veut pointer comme ses voisins : les changements de direction se font en douceur.' },
  K: { sym: 'K', name: 'Anisotropie', role: 'Le matériau préfère un axe (ici vertical) : les spins aiment pointer ↑ ou ↓, pas de travers.' },
  alpha: { sym: 'α', name: 'Frottement', role: 'Il freine la rotation de l’aimantation et finit par l’aligner sur le champ.' },
  def: { sym: 'ΔK', name: 'Défauts', role: 'Entailles, grains irréguliers : des creux d’énergie qui retiennent les parois.' },
  D: { sym: 'D', name: 'Interaction DMI', role: 'Elle favorise une rotation dans un sens précis : bandes, bulles, tourbillons.' },
  T: { sym: 'T', name: 'Température', role: 'L’agitation retourne des spins au hasard. Au-dessus de T_C, plus d’aimantation d’ensemble.' },
}

export const CHAPTERS = [
  { id: 'limaille', short: 'Voir l’invisible', level: 'Chapitre 1 · aucune notion requise', icon: '🧲', summary: 'De la limaille et des boussoles pour dessiner le champ invisible d’un aimant.', steps: 3, qty: ['B'] },
  { id: 'wall', short: 'Domaines et parois', level: 'Chapitre 2 · aimantation, échange, anisotropie', icon: '↕️', summary: 'Descends à l’échelle du nanomètre : des zones aimantées, et la frontière qui les sépare.', steps: 3, qty: ['m', 'A', 'K', 'B'] },
  { id: 'compass', short: 'Comment l’aimantation bouge', level: 'Chapitre 3 · précession et frottement', icon: '🌀', summary: 'Un aimant ne s’aligne pas tout de suite : il tourne d’abord autour du champ, comme une toupie.', steps: 2, qty: ['B', 'm', 'alpha'] },
  { id: 'paroi_pin', short: 'Défauts et ancrage', level: 'Chapitre 4 · défauts', icon: '🧱', summary: 'Une piste lisse, puis des entailles, puis des grains : ce qui retient une paroi.', steps: 3, qty: ['B', 'def', 'K'] },
  { id: 'labyrinthe', short: 'Labyrinthes et bulles', level: 'Chapitre 5 · interaction DMI', icon: '🫧', summary: 'Un film forme tout seul un labyrinthe. Monte le champ : les bandes se coupent en bulles.', steps: 3, qty: ['D', 'B'] },
  { id: 'curie', short: 'La chaleur désordonne', level: 'Chapitre 6 · température', icon: '🌡️', summary: 'Chauffe, refroidis, et regarde l’ordre magnétique disparaître puis revenir.', steps: 2, qty: ['T'] },
]
