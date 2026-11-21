# Modifications : curseurs, skyrmion et pinning — 21 novembre 2026

Ce document explique le comportement des deux modes modifiés et précise les références. Il complète `SOURCES.md` et `TESTS.md`.

## Étape 1 — Curseurs et saisie précise (Sandbox)

Chaque paramètre numérique possède désormais un curseur mobile et une zone de saisie exacte qui restent synchronisés. Dimensions et maillage sont validés au **relâchement** : en cours de glissement, reconstruire `FilmCore` à chaque évènement serait inutilement coûteux et peut déclencher plusieurs FFT. Les modifications de champ et de constantes sont prises en compte depuis la même interface `setParam`.

**Référence technique :** [MDN — input type="range"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range) (évènements `input` et `change`). C’est un choix d’ergonomie et de performance, pas une relation physique.

## Étape 2 — Paramètres de base favorables à une graine stable

**Données de référence :** la simulation Co/Pt de Göbel *et al.* (et plusieurs études reprenant ces valeurs) utilise `Ms=580 kA/m`, `A=15 pJ/m`, `Ku=800 kJ/m³`, `D=3.5 mJ/m²` et `alpha=0.3`. Voir [Electrical writing, deleting, reading, and moving of magnetic skyrmioniums in a racetrack device](https://pmc.ncbi.nlm.nih.gov/articles/PMC6702348/) et [Current-driven coherent skyrmion generation](https://pmc.ncbi.nlm.nih.gov/articles/PMC6401069/).

**Hypothèse de modélisation locale** : quand l’option de magnétostatique est désactivée, on remplace de façon approchée la contribution de démagnétisation d’un film mince uniforme par une anisotropie effective `K_eff ≈ Ku - μ₀ Ms² / 2`. Les nombres ci-dessus donnent ≈ **589 kJ/m³**. Le préréglage démarre à **600 kJ/m³**, arrondi volontairement et testé dans ce solveur 2D ; **K=600 n’est pas une constante mesurée dans l’article**. Les effets magnétostatiques non locaux ne sont pas inclus.

Le préréglage testé est `Lx=Ly=192 nm`, `t=1 nm`, `Nx=Ny=64`, `Bz=+20 mT`, `D=3.5 mJ/m²`, `rayon de graine=25 nm`, `alpha=0.3`. Pour ce jeu de paramètres, une graine chirale imposée à l’instant initial conduit à une charge discrète `Q≈-0.98` immédiatement et `Q≈-0.92` après **~3,54 ns** de relaxation déterministe (35 000 pas de RK4). **Cela ne garantit ni la stabilité à long terme, ni une convergence en maillage, ni la stabilité d'un skyrmion réel.** Le même solveur faisait disparaître la graine en ~0,1 ns avec l’ancien réglage `Ku=800 kJ/m³`, `Bz=+40 mT` sans magnétostatique.

**Attention au laser :** le bouton `Impulsion laser idéalisée` fabrique une **condition initiale chirale** avant d'intégrer la LLG à température nulle. Il ne calcule pas une température transitoire, une désaimantation ultrarapide ou des fluctuations thermiques. Une nucléation optique réaliste nécessite au minimum un modèle thermique couplé et un traitement stochastique. Voir [Kern *et al.*, Nature Communications 13, 2022](https://www.nature.com/articles/s41467-022-32525-4) sur la nucléation optique dans des antiferromagnétiques synthétiques.

## Étape 3 — Voir le défaut **sur la paroi**, sans colorer tout le film

Le site de pinning reste défini dans **les coordonnées du matériau** :

`K(x) = K₀ [1 - δ exp(- (x-xₚ)² / (2σ²))]`.

La nouvelle surbrillance orange est calculée localement à partir de

`intensité(x) ∝ [1-mz(x)²] [1-K(x)/K₀]`.

Elle est significative **uniquement lorsqu’un spin est dans la paroi ET au niveau du défaut**. Les domaines uniformes restent sans surbrillance. Un petit triangle `K↓` et la courbe `K/K₀` du graphique rappellent la position physique fixe du défaut. Celui-ci **ne suit pas** artificiellement la paroi. Le rendu visuel ne modifie en rien la force ou l'énergie calculée.

**Référence physique :** Franken *et al.*, [Domain-wall pinning by local control of anisotropy in Pt/Co/Pt strips](https://doi.org/10.1088/0953-8984/24/2/024216), *J. Phys.: Condens. Matter* **24**, 024216 (2012).

## Étape 4 — Étapes d’accrochage et de libération

Une frise montre : **Approche → Accrochage → Piégeage → Libération**. L’algorithme observe la position de la paroi mesurée à partir du changement de signe de `m_z`, la proximité du défaut et sa vitesse estimée sur les ~0,3 ns précédentes. Lorsque `|v|<5 m/s` après plus de `0,35 ns` à proximité du défaut, l'interface indique **« piégeage apparent »**. Après avoir observé un piégeage, un départ signale une **libération**. Si la paroi traverse sans arrêt détecté, l’indication est **« franchissement direct »**, distinct du dépiégeage.

Des boutons **Piéger (12 mT)** et **Dépiéger (110 mT)** permettent d'examiner ces situations. Cette reconnaissance n’est qu’une **heuristique de visualisation** : une vitesse momentanément faible ne prouve pas un minimum asymptotiquement stable. Le champ de dépiégeage estimé, calculé séparément avec une paroi rigide et la pente du potentiel, ne se substitue pas à un balayage dynamique.

**Références :** Franken *et al.*, 2012 (lien ci-dessus), et [*Effective pinning energy landscape perturbations for propagating magnetic domain walls*](https://pmc.ncbi.nlm.nih.gov/articles/PMC5046081/), *Scientific Reports* **6**, 34517 (2016).

## Étape 5 — Ergonomie et limites

Pour les modes Sandbox et Pinning, les observables sont **sous** le film au lieu de masquer la simulation. Les curseurs, boutons et états du simulateur restent dans des contrôles HTML compatibles avec les écrans tactiles. L'orientation du téléphone reste optionnelle et utilise une permission explicite quand elle est exigée : [MDN — DeviceOrientationEvent.requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static).

**Non validés :** effets thermiques/laser réels, magnétostatique 3D, seuils expérimentaux, contraintes de performance d'un téléphone physique. Un test de convergence et une comparaison OOMMF/MuMax3 restent nécessaires avant toute utilisation scientifique quantitative.

## Étape 6 — Conditions de bord DMI corrigées (nouvelle version)

Dans le noyau `js/engine/film_llg.js`, pour la convention d'énergie

`w_D = D [m_z ∇·m − (m·∇)m_z]`, 

la condition naturelle de bord dérivée par variation de l'énergie échange + DMI est

`2 A ∂_n m = −D [ (z × n) × m ]`.

La précédente extrapolation appliquait implicitement `∂_n m = 0` même lorsque `D≠0`, ce qui empêchait le canting des spins au bord. Les voisins manquants sont maintenant reconstruits par une **extrapolation de type cellule fantôme** linéaire à partir de la pente physique `D/(2A)`. Les valeurs sont recalculées à chaque sous-étape du RK4 pour rester cohérentes avec l'aimantation courante. La même méthode s'applique aux deux axes et aux bords du masque de disque (contour représenté en escalier).

**Source :** S. Rohart & A. Thiaville, *Skyrmion confinement in ultrathin film nanostructures in the presence of Dzyaloshinskii-Moriya interaction*, Phys. Rev. B **88**, 184422 (2013), https://doi.org/10.1103/PhysRevB.88.184422 . Voir également Vansteenkiste *et al.*, *The design and verification of MuMax3*, AIP Advances **4**, 107133 (2014), https://doi.org/10.1063/1.4899186 .

**Limite persistante :** schéma de bord d'ordre un sur un maillage cartésien ; le contour circulaire est discrétisé en escalier. Pour les états sensibles aux surfaces, il faut faire varier le maillage et comparer avec MuMax3/OOMMF. La correction **ne constitue pas une validation exhaustive**.

## Étape 7 — Magnétostatique : deux préréglages non ambigus

* **Co/Pt effectif — skyrmion (rapide, valeur par défaut)** : K=600 kJ/m³, FFT désactivée ; modèle effectif de film mince, plus adapté aux performances mobiles.
* **Co/Pt — skyrmion + FFT (plus lent)** : Ku=800 kJ/m³, FFT activée ; champ non local de film mince, pas un tenseur démagnétisant complet 3D. Avec ce code, un cœur inversé persiste sur la durée numérique testée, mais la convergence n'est pas démontrée.

Les deux préréglages ont leur propre bouton et sont disponibles dans la liste « Jeu de paramètres ». La ligne « Magnétostatique » dans les observables indique toujours le modèle réellement actif. **Il ne faut pas prendre K=600 kJ/m³ comme Ku si l'on active la FFT manuellement**, car on introduit alors un double comptage approximatif de l'énergie démagnétisante.

**Sources :** Vansteenkiste *et al.*, 2014 (FFT et noyaux démagnétisants), et les paramètres de simulation Co/Pt de https://pmc.ncbi.nlm.nih.gov/articles/PMC6702348/ .

**Nuance bibliographique sur K :** dans *Current-driven coherent skyrmion generation*, les auteurs appellent `K₁=0.8 MJ/m³` une anisotropie effective comprenant des contributions de forme et de surface. Dans *Electrical writing, deleting, reading, and moving of magnetic skyrmioniums in a racetrack device*, `K_z=0.8 MJ/m³` est donné comme terme uniaxial de simulation. Les conventions ne sont donc **pas suffisamment homogènes** pour considérer 800 kJ/m³ comme un Ku intrinsèque mesuré. Dans **notre** modèle numérique : 600 est un choix de `K_eff` local approximatif sans magnétostatique ; 800 est le coefficient du terme uniaxial utilisé **en plus** de la FFT. Ces deux jeux sont comparables à titre pédagogique et testés ici, pas équivalents quantitativement aux articles. Sources : https://www.nature.com/articles/s41598-019-40220-6 et https://www.nature.com/articles/s41598-019-48617-z .
