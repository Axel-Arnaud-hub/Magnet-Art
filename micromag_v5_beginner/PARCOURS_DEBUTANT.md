# Audit du parcours débutant — version 5

**Règle de conception :** chaque étape doit être compréhensible par une personne qui n’a jamais étudié le magnétisme.

1. **Lire l’image :** commencer par les couleurs, flèches et domaines. Aucun symbole avant la première observation.
2. **Champ :** montrer qu’une direction d’aimantation devient plus favorable ; les notions de champ et de signe sont introduites par l’effet observé.
3. **Échange :** relier la proximité des directions à une pénalité de gradient. « A » n’est présenté qu’après la notion de voisins.
4. **Anisotropie :** distinguer direction préférée (K) et accord entre voisins (A), via leur effet opposé sur la largeur théorique.
5. **Amortissement :** d’abord observer une flèche et un champ, ensuite la précession et le rôle dissipatif de α.
6. **Géométrie / champ démagnétisant :** montrer la forme du film et le champ interne moyen calculé. Ne pas promettre un changement visuel de l’aimantation lorsque la configuration est initialement uniforme.
7. **DMI :** introduire une préférence chirale après les termes ordinaires, puis faire le lien avec les skyrmions. Avertir que le modèle 1D initialise différemment la paroi selon D.

Chaque étape comporte **Regarde → Essaie → Ce que tu peux observer → Pourquoi**. Une question à choix à la fin de chaque leçon contrôle une compréhension élémentaire. **La validation automatique des curseurs ne prouve pas l’observation** ; elle garantit seulement que l’utilisateur a sélectionné la valeur demandée.

## Modèles et limites
- `wall` : LLG 1D sans magnétostatique, estimation Δ=√(A/K), pas une mesure directe de largeur relaxée. Des ajustements rapides peuvent réinitialiser la paroi selon la leçon.
- `compass` : macrospin en LLG, réinitialisé pour comparer les α.
- `sandbox` : FFT mince-film approchée et compteur ⟨|B_demag|⟩ ; la carte d’aimantation peut rester semblable quand la géométrie change.
- Des exercices accessibles sans formules ne démontrent pas la convergence numérique ; le mode Laboratoire reste distinct.

## Sources principales, par étape
1. OOMMF/NIST, aperçu de la micromagnétique : https://math.nist.gov/oommf/doc/userguide21a3/userguide/Overview_OOMMF.html
2–3, 6. Donahue et al., *Numerical Micromagnetics: Finite Difference Methods*, NIST : https://www.nist.gov/publications/numerical-micromagnetics-finite-difference-methods
4. OOMMF/NIST, anisotropie et échange : https://math.nist.gov/oommf/doc/userguide21a3/userguide/Overview_OOMMF.html
5. MicroMagnetics.org, Landau-Lifshitz-Gilbert : https://micromagnetics.org/micromagnetism/
7. Rohart & Thiaville, *Physical Review B* 88, 184422 (2013) : https://doi.org/10.1103/PhysRevB.88.184422

## Procédure de contrôle
- Vérifier 7 leçons, 7 questions de fin, progression vers la leçon suivante, retour à la liste.
- Vérifier que toutes les étapes avec curseur affichent son contrôle et que les consignes sans curseur n’affichent aucun contrôle cassé.
- Tester à 360 et 390 px sans défilement horizontal, boutons accessibles et simulation visible en conservant le texte essentiel.
