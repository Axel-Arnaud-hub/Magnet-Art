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
conditions de bord DMI approchées, intégration magnétostatique approximative
et résolution uniforme dans l’épaisseur. Le solveur n’est pas validé pour la recherche.

## B. Sandbox : jeux de paramètres

| Jeu | Ms | A | Ku | D | alpha | origine |
|---|---:|---:|---:|---:|---:|---|
| Permalloy, µMAG n° 4 | 800 kA/m | 13 pJ/m | 0 | 0 | 0,02* | paramètres µMAG 4 |
| Pt/Co/Pt, simulation publiée | 580 kA/m | 15 pJ/m | 800 kJ/m³ | 3,5 mJ/m² | 0,3 | publication citée |

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
