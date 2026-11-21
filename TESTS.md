# Contrôles réalisés — 20 novembre 2026

Exécution automatisée dans Chromium headless, code JavaScript chargé à
partir des fichiers du projet. Les tests reproduisent des intégrations RK4
et initialisations ; ils ne remplacent pas une validation micromagnétique.

## Régression de démarrage

- 13 modes découverts dans le menu et initialisés sans exception JavaScript ;
- une étape numérique de chaque mode, puis rendu Canvas sans exception ;
- un seul bouton d’activation des capteurs dans le DOM ;
- syntaxe de tous les fichiers JS vérifiée par `node --check`.

## Pinning : comparaison dynamique avec paramètres d’usine

Film 1D : 160 cellules × 3 nm, Ms=580 kA/m, A=15 pJ/m,
K0=500 kJ/m³, D=1,5 mJ/m², alpha=0,4, xp=240 nm, sigma=12 nm.
L’état initial est placé 3,5 largeurs de paroi avant le défaut.
Durée d’intégration : ~4 ns ; sans bruit thermique.

| δ = ΔK/K0 | Bz (mT) | Observation à 4 ns |
|---:|---:|---|
| 0 % | 12 | déplacement 221 -> 334 nm |
| 35 % | 12 | piégeage à environ 241,2 nm |
| 35 % | 110 | franchissement, puis sortie du film |
| 70 % | 8 | piégeage à environ 240,4 nm |

Seuil statique **estimé** à 35 % : environ 70,4 mT ; ne pas assimiler
à un champ de dépiégeage mesuré dynamiquement, et ne pas extrapoler
aux matériaux réels sans magnétostatique ni microstructure.

Lorsque δ=0 %, le tableau d’anisotropie est uniforme et le seuil estimé vaut 0.
L’intégration conserve la norme de m après renormalisation RK4.

## À faire avant une utilisation scientifique

- convergence en Δx, Δy et Δt ;
- comparaison à une simulation OOMMF/MuMax3 du même profil Ku(x) ;
- reproduire les diagrammes de phase et seuils sur plusieurs géométries ;
- tests sur smartphones réels (iOS Safari, Chrome Android) avec HTTPS ;
- benchmark de performance et consommation batterie ;
- benchmark skyrmion (charge topologique, disparition, images à taux réel).
