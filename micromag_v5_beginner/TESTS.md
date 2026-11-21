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


## 21 novembre 2026 — Curseurs, bords DMI, skyrmion et pinning (version finale)

- Contrôle syntaxique : tous les JS valides (`node --check`).
- Test de navigation : **13 modes** ouverts sous Chromium headless, sans exception JS.
- Sandbox : tous les paramètres numériques sont réglables par curseur + saisie exacte (maillage validé au relâchement). L'anisotropie revient à **600 kJ/m³** pour le préréglage rapide et **800 kJ/m³ + FFT** pour le préréglage FFT ; sélection testée en navigateur.
- Pinning : **~241 nm** à 12 mT et **franchissement du défaut** sous 110 mT ; le mode sans défaut affiche correctement « pas de défaut » lors du déplacement du curseur. Les étapes sont une classification heuristique.
- DMI : état initial `m=(0,0,1)` sur **32×32** cellules avec `Δx=Δy=3 nm`, `Ms=580 kA/m`, `A=15 pJ/m`, `K=600 kJ/m³`, `α=0,4`, intégration **600 pas** :
  * `D=0`, aucun canting (`mx=my=0`, `mz=1` à la précision affichée) ;
  * `D=+3,5 mJ/m²`, canting antisymétrique `mx(gauche)=+0,445`, `mx(droite)=−0,445`, `my(bas)=+0,445`, `my(haut)=−0,445`, centre `mz=1`. Cela vérifie la réponse qualitativement attendue de la condition de bord DMI, **pas la convergence du schéma**.
- Skyrmion, après correction DMI, condition initiale de rayon 25 nm, `Lx=Ly=192 nm`, `Nx=Ny=64` :
  * modèle rapide `K=600 kJ/m³`, FFT désactivée, `Bz=20 mT` : `Q≈−0,864` à **3,54 ns**, minimum `mz≈−0,99` au cœur ;
  * modèle FFT `K=800 kJ/m³`, FFT activée, `Bz=20 mT` : `Q≈−0,873` à **1,18 ns**, minimum `mz≈−0,99` au cœur.

Les Q sont évalués par dérivées centrées et **ne sont pas parfaitement quantifiés** au maillage choisi ; ces observations montrent la persistance d'un cœur inversé sur la durée simulée, pas une garantie de métastabilité à temps infini. Pas de processus thermique de nucléation laser.

**Restent à valider :** convergence, énergie libre, erreur numérique temporelle, benchmark OOMMF/MuMax3 ; accès réel aux capteurs iOS/Android et performance mobile sur matériel.
