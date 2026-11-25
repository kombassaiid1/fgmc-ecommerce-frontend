# Direction des animations NÉO

Les animations de `components/agent/image-motion/shaders.ts` sont des interprétations
artistiques des phénomènes ci-dessous. Elles transportent les pixels des PNG existants,
avec leur transparence. Elles ne constituent pas des simulations scientifiques : les
échelles de temps, de distance, les couleurs et les amplitudes servent la lisibilité de
l'interface. Le jaune d'un photon ou les trois couleurs des quarks sont des codes visuels.

| Identité | Base physique | Traduction dans l'image |
| --- | --- | --- |
| Photon | Le photon est le quantum du champ électromagnétique. | Paquets de lumière se propageant le long des rayons existants, faible déplacement transverse; le motif entier ne tourne plus. Les tracés ne représentent pas des trajectoires mesurées de photons. |
| Quantum | Superposition, cohérence et interférences; le nom ne désigne pas un objet unique. | Deux centres et silhouettes ancrés, mouvement interne corrélé des filaments et franges stationnaires plus lisibles dans le lien existant. Cette évocation ne représente ni une mesure quantique ni un signal transmis par intrication. |
| Plasma | Gaz partiellement ou complètement ionisé, avec des charges sensibles aux champs électromagnétiques. | L'image choisie représente une boule à plasma : électrode et enveloppe fixes, canaux lumineux internes fluctuants. Ces filaments ne caractérisent pas tous les plasmas. |
| Fusion | Des noyaux légers peuvent former un noyau plus lourd et libérer de l'énergie. | Les deux lobes de l'illustration évoquent une alimentation convergente continue. Des phases de texture fondues renouvellent cette alimentation; l'émission se propage vers l'extérieur. La boucle ne raconte plus la fusion puis la séparation répétée des mêmes noyaux. |
| Proton | Deux quarks up et un down de valence, liés par l'interaction forte et accompagnés d'une dynamique de gluons et de paires quark-antiquark. | Petites translations confinées et non circulaires des trois quarks dessinés; les masques à cœur uniforme préservent leurs formes et les lettres u/u/d. Leurs déplacements prescrits se compensent. Le champ extérieur reste stable. Les trois billes du dessin sont une simplification du contenu du proton. |
| Pulsar | Étoile à neutrons en rotation; un faisceau balayant la ligne de visée produit l'effet de phare. | Rotation de période constante du faisceau et du champ autour d'un centre stable, faible modulation d'alignement. Suppression du gonflement radial; marge pour que le faisceau ne soit pas coupé pendant la rotation. |
| Quasar | Noyau galactique actif alimenté par l'accrétion autour d'un trou noir supermassif; certains présentent des jets. | Écoulement du disque dans un seul sens, rotation différentielle plus rapide à l'intérieur et dérive vers le centre. Le centre sombre et le couloir des jets restent stables; des variations lumineuses se propagent vers l'extérieur dans les deux jets déjà présents sur l'image. |

## Références consultées

- CERN, [The Standard Model](https://home.web.cern.ch/science/physics/standard-model/)
  : photon et interaction électromagnétique.
- NIST, [A New Playbook for Interference](https://www.nist.gov/news-events/news/2019/12/new-playbook-interference)
  et [Quantum and Dance](https://www.nist.gov/blogs/taking-measure/quantum-and-dance-it-takes-2-entangle)
  : interférences, corrélations et absence de communication supraluminique par intrication.
- Department of Energy, [Plasma](https://www.energy.gov/science/doe-explainsplasma)
  et [Fusion Energy Science](https://www.energy.gov/science/doe-explainsfusion-energy-science).
- CERN, [LHCb discovers a proton-like particle](https://home.cern/news/news/physics/lhcb-collaboration-discovers-new-proton-particle)
  : contenu de valence uud du proton; [CMS, quarks and gluons](https://cms.cern/news/fractal-tree-quarks-and-gluons)
  : interaction forte médiée par les gluons.
- NASA, [Pulsars](https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/hubble-pulsars/).
- NASA, [Active Galactic Nuclei](https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-are-active-galactic-nuclei/)
  et [Black Hole Anatomy](https://science.nasa.gov/universe/black-holes/anatomy/);
  [Accretion Disk Visualization](https://svs.gsfc.nasa.gov/13326) : rotation plus rapide dans les régions internes.

## Contraintes de rendu conservées

- Images originales et registre d'identité conservés.
- Animation des avatars actifs uniquement, à 30 images/s maximum.
- Texture GPU de 256 × 256 pixels, surface limitée et densité de pixels plafonnée à 2.
- Arrêt hors écran et lorsque l'onglet est masqué.
- Image statique lorsque `prefers-reduced-motion` est actif ou WebGL indisponible.
- Modulation lumineuse faible et progressive; les rythmes astrophysiques réels ne sont
  pas reproduits à leur cadence physique.
