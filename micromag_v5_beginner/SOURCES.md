# Sources et choix de modélisation — MicroMag Lab

## A. Noyau LLG et intégration

**Ce qui est implémenté :** l’équation LLG explicite (précession + amortissement Gilbert),
les champs effectifs issus de l’échange, de l’anisotropie uniaxiale,
de la DMI interfaciale et du champ Zeeman. Le noyau fait appel à des différences
finies et à un RK4 explicite avec renormalisation de m. Un champ démagnétisant
approché par convolution FFT peut être activé dans certains modes.

**Sources de référence pour comparer :**
- Vansteenkiste et al., *The design and verification of MuMax3*, AIP Advances 4,
  107133 (2014). https://doi.org/10.1063/1.4899186
- OOMMF User's Guide, sections « Oxs_UniaxialAnisotropy » et champs spatiaux :
  https://math.nist.gov/oommf/doc/userguide21a3/userguide-xml/sec_oxsEnergies.html
- Interface Ubermag, tutoriel anisotropie variable :
  https://ubermag.github.io/documentation/notebooks/oommfc/uniaxialanisotropy.html

**Limites :** RK4 à pas explicite estimé, sans contrôle d’erreur adaptatif ;
conditions de bord DMI à précision finie, intégration magnétostatique approximative
et résolution uniforme dans l’épaisseur. Le solveur n’est pas validé pour la recherche.

## B. Sandbox : jeux de paramètres

| Jeu | Ms | A | K (convention publiée) | D | alpha | origine |
|---|---:|---:|---:|---:|---:|---|
| Permalloy, µMAG n° 4 | 800 kA/m | 13 pJ/m | 0 | 0 | 0,02* | paramètres µMAG 4 |
| Pt/Co/Pt, simulation publiée | 580 kA/m | 15 pJ/m | 800 kJ/m³ | 3,5 mJ/m² | 0,3 | publication citée |
| Co/Pt effectif, démonstration Sandbox | 580 kA/m | 15 pJ/m | 600 kJ/m³ (effectif, APPROCHÉ) | 3,5 mJ/m² | 0,3 | dérivé de la ligne publiée + test interne |

*L’amortissement 0,02 du premier préréglage sert à l’exploration ; il
n’est pas imposé par la définition du problème µMAG 4. Le système Sandbox
ne reproduit **pas** le protocole du benchmark µMAG : état S relaxé,
deux champs de renversement, magnétostatique complète, convergence.

Sources :
- NIST µMAG standard problem 4 (géométrie 500×125×3 nm³,
  Ms=800 kA/m, A=13 pJ/m, anisotropie nulle) :
  https://www.ctcms.nist.gov/~rdm/std4/results.html
- MuMax3, comparaison standard problem 4 :
  https://pubs.aip.org/aip/adv/article/4/10/107133/584191/The-design-and-verification-of-MuMax3
- Simulations Co/Pt, ensemble exact Ms, A, Ku, D et alpha :
  https://pmc.ncbi.nlm.nih.gov/articles/PMC6702348/

**Préréglage skyrmion testé dans notre solveur :** Bz=+20 mT, rayon initial=25 nm, 192×192×1 nm³, 64×64 cellules, magnétostatique désactivée. On prend la valeur arrondie K=600 kJ/m³ en approximation de film mince pour K_eff ≈ Ku − μ0 Ms²/2 ≈ 589 kJ/m³, à partir du coefficient K publié de 800 kJ/m³ et Ms=580 kA/m. Cela suppose que le modèle démagnétisant peut être remplacé par un terme local, approximation non valable près des bords et pour les textures non uniformes. La graine imposée a Q≈−0,98 ; après ~3,54 ns Q≈−0,92. Il ne s’agit **ni d’un résultat expérimental, ni d’une nucléation laser, ni d’une garantie de stabilité à long terme**.

Le terme « jeu de paramètres de la littérature » signifie paramètres adoptés
par les auteurs pour simuler un système, non des constantes expérimentales universelles.

## C. Nouveau mode « Paroi — Pinning »

**Mécanisme :** une réduction locale d’anisotropie magnétique forme un site
préférentiel pour la paroi. La densité d'énergie pertinente est

    e(x) = A |dm/dx|² + Ku(x)(1 - mz²) - Ms Bz mz + e_DMI
    Ku(x) = K0 [1 - δ exp(-(x-xp)² / (2 sigma²))]

Le moteur calcule explicitement `B_anis,z(i) = 2 Ku(i) mz(i) / Ms` ;
il n’applique PAS une force de pinning phénoménologique à la paroi.

**Seuil estimé :** paroi rigide `mz(x,q) = -tanh((x-q)/Delta)` avec
`Delta = sqrt(A/K0)`. On calcule par quadrature sur la grille

    U(q) = ∫ [Ku(x)-K0] sech²((x-q)/Delta) dx
    B_dep,stat(+z) ≈ max_q (dU/dq) / (2 Ms)

La dynamique complète peut dépasser ou traverser le piège différemment :
la rotation interne, l'amortissement, les effets transitoires et le pas spatial
modifient le seuil effectif. La formule ne modélise PAS l'activation thermique.

**Sources directes :**
- Franken et al., *Domain-Wall Pinning by Local Control of Anisotropy in Pt/Co/Pt strips*,
  J. Phys.: Condens. Matter 24, 024216 (2012) :
  https://arxiv.org/abs/1112.1259
- *Controlled pinning and depinning of domain walls in nanowires with perpendicular
  magnetic anisotropy*, J. Phys.: Condens. Matter 24, 024208 (2012) :
  https://doi.org/10.1088/0953-8984/24/2/024208
- *Effective pinning energy landscape perturbations for propagating magnetic domain walls*,
  Scientific Reports 6, 34517 (2016) :
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5046081/

**Limites :** 1D, T=0, pas de champ démagnétisant, ni défaut géométrique,
ni fluctuation, ni vortex transverse ou courbure de paroi. Une gaussienne
est une *forme choisie de défaut* ; ce n’est pas un ajustement à un échantillon.

### Visibilité du défaut dans la visualisation de paroi

Le défaut est **fixé aux coordonnées du matériau** (profil `Kmap`), jamais attaché artificiellement à la paroi. Le rendu colore en orange uniquement les spins où `(1−mz²) × [1−K(x)/K0]` est significatif : ces spins correspondent au recouvrement spatial entre le cœur de paroi et la région de moindre anisotropie. Le centre x_p reste signalé par un petit repère sur l’axe et par la courbe `K/K0` afin qu’on ne confonde pas défaut et paroi. Une frise affiche les étapes détectées : approche, interaction, piégeage apparent, départ / franchissement. L’identification du piégeage utilise une fenêtre de vitesse : elle n’est pas une preuve de stabilité asymptotique.

## D. Disparition des marqueurs

La position du skyrmion ne doit pas être inférée du seul minimum de mz.
Pour afficher le marqueur, le mode de transport exige un cœur inversé
ET une charge topologique numérique suffisante. Le mode vortex exige
un cœur hors-plan ET une circulation significative. Les seuils sont
des heuristiques de visualisation, **pas** des critères topologiques rigoureux.

## E. Bouton capteurs téléphone

`DeviceOrientationEvent.requestPermission()` est appelé après le clic de
l’utilisateur lorsque ce mécanisme est exposé par le navigateur.
Une origine HTTPS (ou localhost) est requise. Les données beta/gamma
inclinent un champ VIRTUEL du Sandbox ; aucune mesure du champ externe
n’est prétendue.

Source API :
- MDN, *DeviceOrientationEvent.requestPermission()* :
  https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static
- MDN, *Device orientation events* :
  https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events


## F. Conditions DMI et choix FFT (mise à jour du 21 novembre 2026)

`film_llg.js` implémente les conditions naturelles échange+DMI par extrapolation ghost-cell, voir `MODIFICATIONS.md` §6 et Rohart & Thiaville, PRB **88**, 184422 (2013). Cette discrétisation ne rend pas les calculs quantitatifs sans convergence.

Pour le Sandbox, deux préréglages skyrmions sont proposés : un calcul rapide sans démagnétisant non local avec `Keff=600 kJ/m³`, et un calcul FFT de film mince avec `K=800 kJ/m³`. L'option FFT est explicite et non activée dans le préréglage rapide pour éviter d'alourdir l'application mobile. Voir Vansteenkiste *et al.*, AIP Advances **4**, 107133 (2014).

**Attention aux conventions de K :** la publication [Current-driven coherent skyrmion generation](https://www.nature.com/articles/s41598-019-40220-6) décrit `K₁=0,8 MJ/m³` comme un paramètre effectif incluant des contributions de forme ; [Electrical writing...skyrmioniums](https://www.nature.com/articles/s41598-019-48617-z) l'indique comme terme uniaxial dans sa simulation. Le choix `K=800` avec FFT est **notre convention de calcul** et ne reproduit pas automatiquement celle d'un article.
