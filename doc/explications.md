# Explications : objectif, raisonnement derrière chaque choix, ce que disent les résultats

> Document de compréhension : le raisonnement derrière chaque choix et la lecture des résultats.
> Chiffres = mAP50-95 sur les 3 463 images IR réelles de test de LLVIP, sauf mention contraire.
> Tous les chiffres sont définitifs (17/11 ~16h30). Figures : `results/figures/`, tables : `results/tables.md`.

---

## 1. L'objectif du projet

### Le besoin opérationnel
La nuit, ou dans la fumée et le brouillard, une caméra RGB est presque aveugle. Une caméra thermique (IR) voit encore les personnes, parce qu'elle mesure la chaleur et non la lumière réfléchie. Le problème est ailleurs :
- **les données IR annotées sont rares et chères.** Il y a moins de capteurs, moins de jeux de données publics, et chaque image doit être annotée à la main ;
- **les paires RGB+IR non annotées sont bon marché.** On monte deux caméras côte à côte, on enregistre, on n'annote rien.

### Les deux questions du projet
1. **Données** : avec quelques images IR annotées et quelques paires RGB/IR non annotées, jusqu'où peut-on approcher un détecteur entraîné sur 12 000 images IR annotées ? Un générateur RGB→IR peut-il fabriquer des données d'entraînement utiles ?
2. **Système** (option 5, multimodalité) : un détecteur qui utilise les deux capteurs est-il meilleur que chaque capteur seul ? Et surtout, **survit-il à la perte d'un capteur** ?

### Pourquoi c'est pertinent pour Helsing
Helsing fait de la perception embarquée pour la défense : capteurs multiples, conditions dégradées, données rares ou sensibles, temps réel. Le projet touche les quatre : rareté des données (génération), multi-capteurs (fusion), robustesse aux pannes (scénarios) et déploiement (TensorRT, latence de bout en bout).

---

## 2. Pourquoi le dataset LLVIP

| Critère | LLVIP | Alternatives écartées |
|---|---|---|
| **RGB et IR alignés au pixel près** | oui (calibration et recalage faits par les auteurs) | FLIR ADAS : paires mal alignées, champs de vue différents. KAIST : alignement imparfait, annotations bruitées |
| Conditions de nuit | majoritairement de nuit | KAIST : jour et nuit mélangés |
| Taille | 15 488 paires (12 025 train, 3 463 test) | M3FD : 4 200 paires |
| Classe | piétons (une seule classe, mais centrale) | |
| Licence | recherche et usage personnel non commercial, compatible avec un projet perso | |
| Scènes de test **différentes** des scènes d'entraînement | oui | |

**L'alignement au pixel près est la raison décisive.** Il rend possibles trois choses :
1. entraîner un générateur **apparié** (on connaît l'image IR exacte qui correspond à chaque image RGB) ;
2. **réutiliser les boîtes** : une boîte dessinée sur l'image RGB est valable sur l'IR réel et sur l'IR synthétique, donc l'IR synthétique arrive avec ses labels gratuitement ;
3. faire de l'**early fusion** en empilant RGB et IR en 4 canaux, ce qui suppose que le pixel (x, y) représente le même point de la scène dans les deux images.

Les scènes de test différentes sont un avantage : elles mesurent la **généralisation** et non la mémorisation. Ça a aussi créé un piège pour les métriques d'images (P10, section 6).

---

## 3. Le générateur RGB→IR

### 3.1 Pourquoi entraîner un générateur ?
- **Créer des données d'entraînement IR annotées à partir de RGB.** Comme le générateur *traduit* l'image (il garde la géométrie), les boîtes de personnes restent valables : on obtient 12 025 images IR synthétiques annotées sans annoter quoi que ce soit.
- **Séparer deux budgets** que la littérature confond souvent :
  - *paires non annotées* (pour le générateur) : N = 100 ou 1000 ;
  - *images IR annotées* (pour le détecteur) : N = 10 à 1000.
  On peut ainsi répondre à une question réaliste : « j'ai 1000 paires enregistrées mais seulement 10 images annotées ».
- **Règle anti-fuite** : le générateur « N=100 » n'a vu que 100 images IR, jamais les 12 000 autres. Sinon, l'IR synthétique contiendrait indirectement de l'information du jeu complet et le gain serait triché.

### 3.2 Pourquoi pix2pix-turbo (SD-Turbo en une étape)
- **Un prior pré-entraîné.** SD-Turbo a vu des centaines de millions d'images. Le générateur part d'une compréhension générale des scènes au lieu de tout apprendre de 100 paires.
- **Une seule étape de débruitage**, contre 20 à 50 pour un modèle de diffusion classique. La génération est rapide : 12 025 images en 26 min, et ~300 ms par image dans la démo.
- **Traduction, pas invention.** L'architecture ajoute des connexions directes de l'encodeur au décodeur du VAE, ce qui préserve la géométrie de l'image d'entrée. C'est indispensable pour que les boîtes restent valables.

### 3.3 Pourquoi LoRA
LoRA (Low-Rank Adaptation) gèle les poids du modèle et n'entraîne que de petites matrices de rang faible ajoutées à certaines couches (rang 8 dans l'UNet, rang 4 dans le VAE).
- **Moins de paramètres entraînés** : quelques millions au lieu d'environ un milliard. Avec 100 paires, un fine-tuning complet sur-apprendrait immédiatement.
- **Garder le prior.** Les poids d'origine ne bougent pas : le modèle s'adapte au style thermique sans oublier comment une scène est structurée.
- **Mémoire et vitesse** : l'entraînement tient sur un seul GPU et les checkpoints pèsent quelques Mo.

**Preuve expérimentale que le prior compte (P16).** Le pix2pix classique (U-Net + PatchGAN entraîné de zéro) a été testé comme plan B. Sur les scènes de test, il produit du bruit, même avec 1000 paires. L1 vaut 0,06 sur les paires d'entraînement contre 0,55 sur les paires de test : il a appris les scènes d'entraînement par cœur. pix2pix-turbo avec LoRA généralise aux scènes jamais vues. Avec peu de données et des scènes nouvelles, **c'est le prior pré-entraîné qui fait la différence**, pas la fonction de perte. Figure : `results/figures/generators.jpg`.

### 3.4 Les limites observées du générateur (P15, P19)
- Les piétons sortent **gris**, alors qu'ils sont les objets les plus **chauds** (les plus blancs) dans l'IR réel. Les phares deviennent de grosses taches blanches.
- Le générateur reproduit la **luminance et la structure** du RGB ; il n'invente pas la **chaleur** quand aucun indice visuel ne la trahit.
- T1000 (1000 paires) est un peu meilleur que T100 (moins de halos de phares), mais la nature du défaut ne change pas. Figure : `results/figures/generators_turbo.jpg`.

---

## 4. Le protocole de détection : ce qu'on teste et pourquoi

| Configuration | Ce qu'elle mesure |
|---|---|
| `real_N{n}` | la référence : un détecteur YOLO11s entraîné sur n vraies images IR annotées |
| `synth_T*` | un détecteur entraîné **uniquement** sur l'IR synthétique, avec **zéro** label IR réel. Mesure ce que le synthétique apporte à lui seul |
| `mix_N{n}` | n vraies images + 12 025 synthétiques mélangées. La façon naïve d'utiliser le synthétique |
| `ft_N{n}` | pré-entraînement sur le synthétique, puis fine-tuning sur les n vraies images. Le synthétique sert d'initialisation |
| `ir_full` | 12 025 vraies images IR annotées : le plafond |
| `rgb_full` | détecteur RGB évalué sur l'IR : ce que donne « ne rien faire » |

**Choix de rigueur :**
- **Pas de sélection de modèle sur le test (P11)** : `val=False`, on évalue la dernière epoch, une seule fois. Choisir la « meilleure epoch » sur le test gonflerait les scores.
- **Sous-ensembles imbriqués** : N10 ⊂ N25 ⊂ … ⊂ N1000, pour une seed donnée. Les écarts entre N viennent de la quantité de données, pas du hasard du tirage.
- **2 seeds** pour les petits N, où la variance est forte : à N=25, `real` vaut 0,395 ou 0,450 selon la seed.
- **mAP50-95 plutôt que mAP50** : sur LLVIP, la détection de piétons en IR est facile. `real_N100` atteint déjà 0,84 en mAP50, donc tout serait écrasé contre le plafond. mAP50-95 exige des boîtes précises et garde de la marge pour mesurer des différences.

---

## 5. L'option 5 : la multimodalité RGB + IR

### 5.1 À quel besoin ça répond
Un système réel embarque plusieurs capteurs, et **un capteur finit toujours par tomber** : panne, obstruction, éblouissement, brouillage, fumée. La question opérationnelle n'est pas seulement « la fusion est-elle meilleure ? » mais « **que se passe-t-il quand un capteur meurt ?** ». Un système qui s'effondre à la perte d'un capteur est pire que deux systèmes séparés.

### 5.2 Pourquoi comparer early fusion et late fusion
| | **Late fusion** (WBF) | **Early fusion** (4 canaux) |
|---|---|---|
| Principe | deux détecteurs indépendants (RGB et IR), on fusionne leurs **boîtes** avec Weighted Boxes Fusion | un seul détecteur qui reçoit l'image RGB et l'IR **empilées** (B, G, R, IR) |
| Avantages | modulaire ; chaque détecteur fonctionne seul, donc la perte d'un capteur se gère naturellement ; on peut remplacer un capteur sans tout réentraîner | un seul réseau, donc **moitié moins de calcul** ; le réseau peut apprendre des indices **croisés** (forme RGB + chaleur IR au même endroit) |
| Risques | double coût de calcul ; ne combine que des décisions finales, pas des indices faibles | le réseau peut **dépendre** d'un canal et s'effondrer s'il disparaît ; exige des capteurs alignés |

Comparer les deux, c'est comparer deux **architectures système** et non deux modèles : modularité contre efficacité et synergie.

### 5.3 Pourquoi le modality dropout et l'ablation sans dropout
Pendant l'entraînement de l'early fusion, on a mis l'IR à zéro dans 15 % des images et le RGB à zéro dans 15 % d'autres. Le réseau apprend ainsi à fonctionner avec un seul capteur. La version **sans dropout** sert de contrôle : sans elle, on ne saurait pas si la robustesse vient du dropout ou de l'architecture.

### 5.4 Les scénarios capteurs
`nominal` · `rgb_fog` (brouillard simulé) · `rgb_lowlight` (assombri + bruit) · `rgb_dead` · `ir_dead` · `ir_reconstructed` (IR mort, remplacé par l'IR généré depuis le RGB par T1000). Les dégradations sont simulées et identiques pour toutes les configurations, et **toutes les cases sont notées par le même évaluateur** (validé contre Ultralytics, P14).

Le dernier scénario teste une idée séduisante : « si la caméra thermique tombe, on la remplace par le générateur ».

### 5.5 Résultats
| Scénario | RGB seul | IR seul | Late WBF | Early + dropout | Early sans dropout |
|---|---|---|---|---|---|
| nominal | 0,516 | 0,610 | 0,620 | **0,642** | 0,610 |
| RGB brouillard | 0,124 | 0,610 | 0,613 | **0,641** | 0,633 |
| RGB sombre + bruit | 0,068 | 0,610 | 0,610 | **0,617** | 0,563 |
| RGB mort | 0 | 0,610 | **0,619** | 0,614 | 0,550 |
| IR mort | **0,516** | 0 | 0,514 | 0,485 | **0,007** |
| IR reconstruit | 0,516 | 0,177 | 0,507 | 0,276 | 0,118 |

**Lecture :**
1. **La fusion apporte un gain**, modeste mais réel : 0,642 contre 0,610 pour l'IR seul en nominal. L'early fusion avec dropout est la meilleure configuration dès que l'IR est présent.
2. **Le modality dropout est indispensable.** Sans lui, l'early fusion tombe à **0,007** quand l'IR meurt : le réseau ne s'appuyait que sur l'IR. Avec lui : 0,485. C'est le résultat le plus important pour un système réel.
3. **La late fusion est la plus robuste** par construction : quand un capteur meurt, il reste l'autre détecteur (0,514 et 0,619). Elle coûte deux détecteurs.
4. **Reconstruire l'IR mort est contre-productif (P20)** : 0,276 avec l'IR reconstruit, contre 0,485 avec l'IR déclaré absent. Le générateur n'ajoute aucune information (il ne voit que le RGB), et ses artefacts trompent le réseau de fusion. **En panne, il vaut mieux signaler la modalité absente que l'halluciner.**

---

## 6. Les métriques d'évaluation du générateur

### 6.1 Ce que mesure chaque métrique
| Métrique | Type | Ce qu'elle mesure | Limite |
|---|---|---|---|
| **FID** (Fréchet Inception Distance, via clean-fid) | distribution | distance entre deux nuages de features Inception-v3, chacun résumé par sa moyenne et sa covariance. Plus bas = plus proche | Inception est entraîné sur ImageNet (photos RGB) : ses features ne sont **pas faites pour l'IR**. Biaisée à petit échantillon. Un seul chiffre qui mélange fidélité et diversité |
| **KID** (Kernel Inception Distance) | distribution | même idée, avec un noyau polynomial ; **non biaisé** à petit échantillon | même extracteur Inception, donc même problème de domaine |
| **FD-DINOv2** | distribution | distance de Fréchet sur les features DINOv2 (auto-supervisé, plus général). La littérature récente le juge plus aligné avec le jugement humain que FID | toujours des features apprises sur des images visibles |
| **Precision / Recall** (PRDC, k=5) | distribution | **precision** = part des images générées qui tombent dans la zone des vraies (*fidélité*) ; **recall** = part des vraies couvertes par les générées (*diversité*) | sensibles aux valeurs aberrantes |
| **Density / Coverage** (PRDC) | distribution | versions plus robustes de precision et recall (moins sensibles aux points isolés) | dépendent du k choisi |
| **UMAP** | visuel | projection 2D des features : on voit si l'IR synthétique se superpose à l'IR réel ou reste à côté | qualitatif seulement |
| **L1 / SSIM / LPIPS appariés** | image par image | comparent chaque image générée à **sa** vraie image IR (possible grâce aux paires alignées). L1 = écart de pixels ; SSIM = structure ; LPIPS = distance perceptuelle | récompensent les images « moyennes » et floues ; ne savent pas ce qui compte pour la détection |

**Pourquoi tant de métriques ?** Parce qu'**aucune ne mesure directement ce qui nous intéresse**, à savoir « cette image IR synthétique apprend-elle au détecteur à trouver des piétons ? ». Chaque métrique éclaire un aspect : fidélité, diversité, structure, distribution.

### 6.2 Étaient-elles robustes ? Les pièges identifiés
1. **Confusion de scène (P10), le piège principal.** Le FID entre l'IR train réel et l'IR test réel, deux ensembles de **la même modalité**, vaut **224**, et la precision 0,04. Les scènes de LLVIP diffèrent entre train et test, donc la métrique mesurait le **décor**, pas la modalité. **Correctif** : toutes les métriques comparent des moitiés du split de test (même pool de scènes, seule la modalité change). Sans ce correctif, toutes les conclusions sur l'écart auraient été fausses.
2. **Domaine des extracteurs** : Inception et DINOv2 n'ont jamais été entraînés sur de l'IR. D'où l'usage de deux extracteurs : si les deux classent les générateurs dans le même ordre, le classement est plus crédible.
3. **Taille d'échantillon** : ~1 700 images par ensemble. Le FID est biaisé à cette taille, d'où le KID, qui ne l'est pas. Les comparaisons se font à taille égale.
4. **Les métriques appariées sont trompeuses pour un générateur** : une image floue et moyenne obtient un bon L1. Elles servent seulement de contrôle.

### 6.3 Les métriques prédisent-elles la qualité ou l'utilité des images ? **Non.**
Distances à l'IR réel de test (moitiés du test, 1 700 images par ensemble) :

| Ensemble | FID ↓ | KID×1000 ↓ | FD-DINOv2 ↓ | Precision | Coverage | L1 / SSIM / LPIPS appariés | **Détecteur entraîné dessus (12 025 images, mêmes boîtes) : mAP50-95 sur l'IR réel** |
|---|---|---|---|---|---|---|---|
| IR réel (contrôle) | 11,6 | 0,1 | 31 | 0,90 | 0,98 | — | (ir_full : 0,623) |
| RGB réel | 271,7 | 228 | 1262 | 0,004 | 0,002 | — | **0,468** |
| IR synthétique T100 | 234,7 | 173 | 1209 | 0 | 0 | 0,186 / 0,499 / 0,518 | 0,328 |
| IR synthétique T1000 | 229,4 | 163 | 1198 | 0 | 0 | 0,181 / 0,501 / 0,503 | 0,384 |

**Lecture :**
1. **Les métriques sont cohérentes entre elles** : FID, KID, FD-DINOv2, L1 et LPIPS classent tous T1000 un peu devant T100, et les deux devant le RGB. Les deux extracteurs (Inception et DINOv2) sont d'accord, ce qui écarte un artefact d'extracteur.
2. **Mais l'IR synthétique reste très loin de l'IR réel** : FID 229 contre 11,6 pour le contrôle, et precision/coverage nulles. Aucune image synthétique ne tombe dans le nuage des vraies images IR. L'UMAP (`results/figures/umap.png`) le montre : l'IR synthétique forme **ses propres amas**, à l'écart de l'IR réel et du RGB. C'est une troisième modalité, ni RGB ni IR.
3. **Le classement des métriques est inversé par rapport à l'utilité** : le RGB est l'ensemble le **plus loin** de l'IR réel selon toutes les métriques, mais c'est lui qui entraîne le **meilleur** détecteur IR (0,468 contre 0,384). Figure : `results/figures/gap_vs_gain.png`. Entre T100 et T1000, l'ordre concorde, mais ce sont deux points.

**Pourquoi les métriques échouent ici :**
- Elles mesurent le **réalisme global de l'image** (texture, contraste, fond), qui occupe ~97 % des pixels. Le détecteur a besoin de l'**apparence des piétons**, quelques % de l'image.
- Le RGB est « loin » de l'IR à cause des couleurs et de l'éclairage, mais ses piétons sont **nets et complets**. Le synthétique imite le style IR global (gris, contraste), mais ses piétons sont **dégradés** (gris, flous, P19). Pour le détecteur, une forme de piéton fidèle dans une image « fausse » vaut mieux qu'une image « réaliste » aux piétons abîmés.
- **Conséquence pratique** : FID/KID/DINOv2 sont utiles pour **trier** des générateurs entre eux (T1000 > T100, cohérent avec l'utilité), mais pas pour décider si la donnée synthétique vaut mieux qu'une **autre source** de données. Seule une évaluation sur la tâche (entraîner le détecteur) répond à cette question.
- Pistes pour une métrique plus prédictive : FID calculé sur les **découpes de piétons** seulement, ou score d'un détecteur IR réel appliqué aux images synthétiques (le synthétique « montre-t-il » les piétons ?).

---

## 7. Les métriques d'évaluation des détecteurs et du système

| Métrique | Définition | Pourquoi on la suit |
|---|---|---|
| **mAP50-95** (métrique principale) | moyenne de l'AP pour des seuils d'IoU de 0,50 à 0,95 par pas de 0,05 (protocole COCO, interpolation 101 points) | exige des boîtes **précises** ; évite le plafond du mAP50 sur LLVIP |
| **mAP50** | AP à IoU 0,5 | « a-t-on trouvé la personne ? », métrique historique de LLVIP, pour comparer avec la littérature (`ir_full` : 0,962) |
| **Precision / Recall** | sur les détections au-dessus du seuil | pour une démo ou un système : combien de fausses alertes, combien de personnes manquées |
| **Recall@0,5** (évaluateur maison) | part des personnes trouvées | pertinente en sécurité : rater une personne coûte plus cher qu'une fausse alerte |
| **Latence p50 / p95** | par étape (pré-traitement, inférence, post-traitement) et **de bout en bout**, batch 1 | **p95** compte pour le temps réel (le pire cas fréquent) ; le bout en bout compte plus que l'inférence seule (B11 : la fusion WBF coûtait 100 fois plus que le réseau) |
| **FPS de bout en bout** | 1 / latence p50 de bout en bout | le chiffre opérationnel |

**Résultats de latence** (`ir_full`, YOLO11s, 640, A100, batch 1, 500 frames) :

| Backend | Pré-traitement | Inférence | Post-traitement | Bout en bout p50 | p95 | FPS |
|---|---|---|---|---|---|---|
| PyTorch FP32 | 1,96 ms | 6,60 ms | 0,90 ms | 9,76 ms | 22,4 ms | 102 |
| PyTorch FP16 | 1,95 ms | 6,63 ms | 0,91 ms | 9,78 ms | 21,9 ms | 102 |
| **TensorRT FP16** | 2,41 ms | **1,57 ms** | 1,46 ms | **5,86 ms** | 21,3 ms | **171** |

- TensorRT divise l'inférence par **4,2**, mais le bout en bout seulement par **1,7** : une fois le réseau accéléré, **le pré- et le post-traitement sur CPU deviennent le goulot** (60 % du temps). Prochaine étape : pré-traitement sur GPU, NMS dans le moteur.
- Le p95 (~21 ms) ne bouge pas : il vient des à-coups du CPU, pas du réseau. Pour du temps réel dur, c'est lui qu'il faudrait attaquer.
- PyTorch FP16 = FP32 à batch 1 : le GPU est sous-utilisé, le coût est dominé par le lancement des kernels. C'est précisément ce que TensorRT supprime en fusionnant les couches.
- Générateur RGB→IR : 177 ms p50 (512², FP16). 30 fois plus lent que le détecteur : inutilisable en temps réel, ce qui rejoint P20.

**Évaluateur maison** (`det_eval.py`) : nécessaire pour noter la late fusion, qui n'est pas un modèle Ultralytics. Il a été validé contre Ultralytics sur le même modèle : mAP50 0,8396 contre 0,8399 (P14). Petit décalage constant en mAP50-95 (`ir_full` : 0,610 maison contre 0,623 Ultralytics), d'où la règle : **on ne compare que des chiffres issus du même évaluateur**.

---

## 8. Ce que les résultats disent par rapport à l'objectif

### Question 1 : le synthétique remplace-t-il des données IR annotées ?
mAP50-95 sur l'IR réel de test, **moyenne des seeds 0 et 1** (T1000 seul : seed 0 uniquement). Figure : `results/figures/map_vs_n.png`.

| Images IR annotées | Réel seul | Synthétique T100 → réel | Synthétique T1000 → réel | **RGB réel → réel** | RGB → synthétique T1000 → réel | Mélange réel + synthétique |
|---|---|---|---|---|---|---|
| 0 | — | 0,328 | 0,384 | 0,468 | 0,396 | — |
| 10 | 0,328 | 0,468 | 0,462 | **0,500** | 0,496 | 0,369 |
| 25 | 0,423 | 0,503 | 0,484 | **0,540** | 0,513 | 0,416 |
| 50 | 0,458 | 0,516 | 0,501 | **0,543** | 0,528 | 0,463 |
| 100 | 0,495 | 0,504 | 0,488 | **0,526** | 0,517 | 0,461 |
| 1000 | 0,590 | — | 0,574 | — | — | 0,565 |
| 12 025 (`ir_full`) | 0,623 | | | | | |

**Ce que ça dit, dans l'ordre d'importance :**
1. **Un pré-entraînement sur une autre source, puis un fine-tuning sur peu d'IR, change tout à petit N** : à 10 images IR annotées, on passe de 0,33 à 0,50, l'équivalent du réel avec ~100 images. Le gain diminue avec N et disparaît vers 1000.
2. **Mais la meilleure source n'est pas l'IR synthétique, c'est le RGB réel** dont il est issu : à tous les N, RGB → IR bat synthétique → IR (+0,02 à +0,04), sur les deux seeds. Le générateur part des **mêmes images RGB** et des **mêmes boîtes**, et **perd de l'information** en route (piétons gris et flous, P19).
3. **Le synthétique n'ajoute rien par-dessus le RGB** : RGB → synthétique → IR fait un peu **moins bien** que RGB → IR (0,496 contre 0,500 à N=10 ; 0,513 contre 0,540 à N=25).
4. **Le gain qu'on aurait attribué au générateur** sans la référence RGB (0,33 → 0,47 à N=10) **vient en réalité des labels RGB** qu'il transporte. C'est le piège classique d'une ablation incomplète (P21).
5. **Mélanger synthétique et réel est la pire façon** de s'en servir : à N ≥ 25, c'est au niveau du réel seul ou en dessous. Le synthétique, 100 fois plus nombreux, noie le signal réel.
6. Plus de paires (T1000) aide le régime **zéro label** (0,384 contre 0,328) mais pas le fine-tuning.

**Quand un générateur RGB→IR resterait-il utile ?** Quand on n'a **pas** de RGB annoté de la même scène, ou quand l'objet d'intérêt n'est visible qu'en IR. Sur LLVIP, le RGB et ses boîtes existent, ce qui rend le générateur redondant pour la détection. Un générateur qui rendrait vraiment la **chaleur** (conditionnement physique, perte sur les piétons) pourrait changer ce verdict : c'est l'expérience suivante.

### Question 2 : la fusion est-elle utile et robuste ?
- La fusion **améliore** le nominal (0,642 contre 0,610 pour l'IR seul) et **tient** dans le brouillard et l'obscurité (0,64 et 0,62, contre 0,12 et 0,07 pour le RGB seul).
- La robustesse à la perte d'un capteur **ne vient pas gratuitement** : elle demande soit une architecture modulaire (late), soit un entraînement explicite (modality dropout). Sans dropout, l'early fusion tombe à **0,007** quand l'IR meurt.
- **Reconstruire un capteur mort est contre-productif** : déclarer l'IR absent (0,485) bat le remplacer par de l'IR généré (0,276). Et le générateur coûte 177 ms, 30 fois le détecteur.
- Déploiement : 171 FPS de bout en bout avec TensorRT FP16 pour le détecteur IR.

### Les leçons d'ensemble
1. **Toujours comparer une donnée synthétique à la référence naïve la plus forte**, pas à « rien ». Ici, réutiliser le RGB annoté bat le générateur qui en dérive. Sans cette référence, j'aurais conclu à un gain de +0,14 qui n'existe pas.
2. **Les métriques d'images ne prédisent pas l'utilité pour une tâche.** Le RGB est le plus « loin » de l'IR réel et le plus utile. Il faut évaluer sur la tâche.
3. **La robustesse multi-capteurs s'entraîne** (modality dropout) et se gère au niveau système (déclarer un capteur absent), **elle ne s'hallucine pas**.
4. **Un générateur n'invente pas d'information** : à l'entraînement comme à l'exécution, il ne peut pas faire mieux que la source qu'il transforme, sauf s'il apporte une connaissance que la source n'a pas (ici, la chaleur, qu'il n'a pas apprise).

### Limites à assumer
- Un seul dataset (LLVIP), une seule classe, des scènes urbaines fixes. Sur LLVIP, le RGB de nuit est **éclairé** (lampadaires) : avec un RGB vraiment noir, la conclusion pourrait changer.
- Dégradations **simulées** (brouillard, obscurité), pas réelles.
- 2 seeds au maximum (1 seule pour T1000 en fine-tuning) ; les seeds partagent le même pré-entraînement.
- Le générateur full (oracle) a été abandonné faute de temps (B8).
- Un seul type de générateur réussi (pix2pix-turbo) : un générateur qui modélise la chaleur pourrait faire mieux.

---

## 9. Extensions (17/11 soir) : pourquoi avoir continué l'analyse

> Résultats remplis au fur et à mesure (marqués **[en cours]** tant qu'ils ne sont pas tombés).

### 9.1 Pourquoi continuer après la conclusion révisée
La section 8 conclut que le RGB annoté bat le générateur. Elle laisse trois questions ouvertes, et chacune fragilise un message de la vidéo :
1. **Pourquoi** le générateur perd-il les piétons ? Sans cause identifiée, « le générateur est mauvais » reste un constat, pas une compréhension. Il faut savoir si la cause est dans l'architecture (résolution, VAE), dans l'entraînement (perte dominée par le fond), ou dans le problème lui-même (la température n'est pas observable dans le RGB). La réponse dit **quoi changer** pour aller plus loin.
2. **Quelle métrique d'image aurait prédit l'utilité ?** La section 6.3 montre que FID et DINOv2 se trompent. Mais elle repose sur **3 points** (RGB, T100, T1000) : c'est une anecdote, pas une mesure. Pour affirmer qu'une métrique prédit ou non l'utilité, il faut une **corrélation sur assez de jeux**, et tester des métriques candidates (dans les boîtes, avec des features adaptées à l'IR).
3. **La référence naïve la plus forte était-elle vraiment le RGB ?** Non : avec des paires alignées, on peut **pseudo-étiqueter l'IR réel** sans générateur (§9.5). C'est la référence que la leçon « compare to the strongest naive baseline » impose de tester.

S'y ajoute un point système : la latence de bout en bout est dominée par le CPU (§7), d'où le pipeline 100 % GPU (§9.6).

### 9.2 Pourquoi ces tests sont plus rigoureux que ceux d'avant
| Avant | Maintenant | Ce que ça change |
|---|---|---|
| 3 jeux (RGB, T100, T1000) pour juger les métriques | **15 jeux** : IR réel, RGB, gris, gris inversé, IR réel passé par le VAE, 9 checkpoints de générateurs (T100 et T1000 à différents pas d'entraînement), pix2pix classique | une vraie corrélation de rang (Spearman, Kendall) avec p-valeur et test leave-one-out, au lieu d'une lecture à l'œil |
| Utilité mesurée par des entraînements différents | **même protocole proxy pour tous** : 3000 images identiques, mêmes boîtes, 30 époques, même évaluation | la seule variable est l'apparence des images ; le proxy est contrôlé contre les entraînements complets (RGB, T100, T1000) |
| Métriques globales sur toute l'image | **les mêmes métriques restreintes aux boîtes** (identiques dans toutes les modalités, LLVIP est aligné) | isole les ~3 % de pixels utiles au détecteur |
| Extracteurs généralistes (Inception, DINOv2), entraînés sur des photos RGB | **FD-YOLO-IR** : features du détecteur entraîné sur l'IR réel, sur des scènes **différentes** du test | des features qui savent ce qu'est un piéton thermique |
| « Le générateur perd les piétons » (constat visuel) | **plafond du VAE** + **analyse par piéton** (quels piétons sont perdus, étaient-ils visibles dans le RGB ?) | sépare les causes : architecture, information absente du RGB, apprentissage |
| Référence : RGB annoté | + **pseudo-labels croisés** depuis un détecteur COCO qui n'a jamais vu LLVIP | ferme la dernière référence naïve, sans fuite de labels |

Règles gardées : aucune sélection sur le test, seuil des pseudo-labels fixé à priori (0,25), moitiés du test distinctes pour la référence et la comparaison, latence mesurée seule sur le GPU.

### 9.3 Quelle métrique prédit l'utilité ? (E1, E2) : fait (11 jeux)
**Questions :** (a) une métrique calculée **dans les boîtes** prédit-elle mieux l'utilité que la même métrique globale ? (b) des features **adaptées à la tâche et à la modalité** (backbone YOLO entraîné sur IR réel) font-elles mieux qu'Inception ou DINOv2 ? (c) une mesure physique simple (**contraste piéton/fond**) suffit-elle ? (d) la **détectabilité** (le détecteur IR réel appliqué au jeu) est-elle le meilleur prédicteur ?

| Métrique ajoutée | Calcul | Ce qu'elle teste |
|---|---|---|
| FID / KID sur les boîtes | Inception sur les découpes des piétons (+10 % de contexte, hauteur ≥ 24 px) | le réalisme des piétons seulement |
| FD-DINOv2 sur les boîtes | idem avec DINOv2 | idem, extracteur auto-supervisé |
| FD-YOLO-IR global / boîtes | cartes P3/P4/P5 du cou de `ir_full` ; moyenne globale, ou ROI-align 2×2 sur chaque boîte | ce que « voit » un détecteur IR, sur toute l'image ou sur les piétons |
| Contraste piéton/fond | moyenne dans la boîte − moyenne d'un anneau autour (boîte ×1,5) ; erreur et corrélation avec le contraste réel de la même boîte | « le piéton est-il chaud, et autant que dans le vrai ? » |
| L1 dans / hors boîtes, biais | erreur pixel appariée, séparée piétons / fond ; biais signé | où se concentre l'erreur du générateur |
| Détectabilité | mAP de `ir_full` sur le jeu | « le jeu montre-t-il les piétons comme l'IR les montre ? » (idée du *Classification Accuracy Score*, Ravuri & Vinyals 2019) |

**Pourquoi pas top-hat, entropie, PSD :** écartées par choix de périmètre (méthodes standard et publiques uniquement). Sur le fond, ce sont aussi des statistiques d'apparence : elles ne peuvent pas dire que le RGB, réellement loin de l'IR, est utile.

**Résultats (A100, 18/11 ; `results/boxmetrics/{metrics.json, correlation.md}`, figure `metric_vs_usefulness.png`).** 11 jeux (réduit de 15 pour l'horaire : 4 checkpoints intermédiaires quasi redondants retirés ; seuil de significativité de ρ : 0,52 → 0,62). Utilité = détecteur proxy (3 000 images train du jeu, 30 époques), testé sur l'IR réel test. Contrôle du protocole proxy : même ordre que les entraînements complets (RGB 0,416 / 0,468 ; T1000 0,338 / 0,384 ; T100 0,271 / 0,328).

| Jeu | Utilité proxy | FD-DINOv2 boîtes | KID×1000 boîtes | KID×1000 image | FD-YOLO boîtes | Détectabilité |
|---|---|---|---|---|---|---|
| IR réel (contrôle) | 0,614 | 160 | 10 | 124 | 77 | 0,61 |
| IR → 512² + VAE | 0,580 | 307 | 22 | 118 | 52 | 0,56 |
| gris inversé | 0,471 | 905 | 152 | 181 | 561 | 0,09 |
| RGB | 0,416 | 841 | 162 | 275 | 852 | 0,01 |
| gris | 0,412 | 774 | 102 | 231 | 817 | 0,01 |
| T1000 (fin) | 0,338 | 1 210 | 136 | 187 | 294 | 0,16 |
| T100 (fin) | 0,271 | 1 308 | 158 | 192 | 364 | 0,13 |
| T1000 pas 1001 | 0,252 | 1 280 | 157 | 212 | 348 | 0,13 |
| T100 pas 1001 | 0,242 | 1 305 | 165 | 220 | 366 | 0,12 |
| pix2pix classique | 0,104 | 2 010 | 273 | 614 | 563 | 0,05 |
| T100 pas 1 (non entraîné) | 0,012 | 2 028 | 275 | 447 | 2 828 | 0,01 |

Corrélations de Spearman (distance → signe inversé) : FD-DINOv2 boîtes **0,94** ; FD-DINOv2 image 0,90 ; KID boîtes 0,85 ; FID image 0,80 ; KID image 0,75 ; FID boîtes 0,73 ; détectabilité 0,51 ; FD-YOLO boîtes 0,49 ; corrélation de contraste 0,49 ; L1 boîtes 0,28 ; erreur de contraste 0,21 ; FD-YOLO image 0,15. Générateurs seuls (6 jeux) : 0,83 à 1,00 pour les distances et la détectabilité, ~0 pour le contraste.

**Réponses :**
- (a) **Boîtes contre image entière :** mieux pour DINOv2 (0,94 contre 0,90) et KID (0,85 contre 0,75), pas pour le FID (0,73 contre 0,80 ; le FID estime 2 048 dimensions de covariance, plus bruité sur des découpes). Surtout, les boîtes **ignorent le décor** : contrôle IR / IR à KID 10 au lieu de 124 alors que les moitiés sont des scènes différentes (P24).
- (b) **Features adaptées à la tâche et à la modalité : non.** FD-YOLO-IR et détectabilité classent parfaitement les générateurs entre eux, mais échouent entre sources : le détecteur IR juge le RGB et le gris « étrangers » (détectabilité 0,01), alors qu'ils entraînent mieux que tout synthétique. Il mesure la **ressemblance à l'IR**, pas l'**information utile pour apprendre**.
- (c) **Contraste piéton/fond : non** (0,21 à 0,49) ; il ne distingue pas les générateurs entre eux.
- (d) **Détectabilité : seulement entre générateurs** (1,00 sur 6, 0,51 sur 11).
- **Conclusion :** la métrique qui suit l'utilité combine deux choses : regarder **les objets** et décrire leur **forme indépendamment de la modalité** (DINOv2 auto-supervisé). Limites : 11 points, 12 métriques testées (la FD-DINOv2 boîtes passe la correction de Bonferroni, p < 0,004) ; le gris inversé est le plus utile des trois jeux issus du RGB sans être le plus proche : l'ordre fin entre sources proches n'est pas résolu.

### 9.4 Pourquoi le générateur perd les piétons (E3) : fait
**Plafond du VAE.** Le générateur travaille en 512×512 (l'image 1280×1024 est réduite et déformée) puis dans l'espace latent du VAE de SD-Turbo, 8 fois plus petit. On fait passer de l'**IR réel** par ces étapes, sans aucune traduction, et on mesure `ir_full` dessus. Si le mAP chute déjà, aucun traducteur bâti sur ce pipeline ne peut faire mieux : c'est un plafond. Trois variantes séparent les causes : `resize512` (résolution seule), `vaefull` (VAE seul, à pleine résolution), `vae512` (les deux, comme le générateur). Limite : pix2pix-turbo ajoute des connexions directes encodeur → décodeur qui contournent en partie le goulot latent ; ce plafond est donc pessimiste.

**Analyse par piéton.** Pour chacun des 8 302 piétons du test : est-il trouvé (IoU ≥ 0,5, confiance ≥ 0,25) sur l'IR réel, sur l'IR passé par le VAE, sur T100 / T1000, et par le détecteur RGB sur le RGB ? Chaque piéton est décrit par sa taille, sa luminosité et son contraste dans le RGB, son contraste dans l'IR réel. Questions : quels piétons le générateur perd-il ? Étaient-ils **visibles dans le RGB** (alors c'est le générateur qui échoue) ou **invisibles** (l'information n'existait pas) ? Sont-ils perdus **aussi par le VAE** (alors c'est l'architecture) ? S'y ajoutent le **piéton moyen** (moyenne de milliers de découpes, anonyme par construction) et la carte d'erreur moyenne.

**Résultats (H100, `ir_full` ré-entraîné = 0,618 ; figures `results/h100/figures/`)** :
| IR réel de test passé par… | mAP50-95 | Rappel des piétons (conf ≥ 0,25) |
|---|---|---|
| rien | 0,618 | 0,930 |
| redimensionnement 512² (résolution + déformation) | 0,628 | 0,932 |
| VAE à pleine résolution | 0,618 | 0,928 |
| **512² + VAE, comme le générateur** | **0,620** | 0,923 |

**Lecture :**
1. **Le plafond n'existe pas : l'architecture n'est pas la cause.** Ce que le générateur voit et produit (512², espace latent 8× plus petit) conserve toute l'information dont le détecteur a besoin. Même le plafond pessimiste (sans les connexions directes de pix2pix-turbo) est au niveau de l'IR réel.
2. Le VAE ne perd que **1,7 %** des piétons trouvés sur l'IR réel : les plus petits (hauteur médiane 173 px contre 253) et ceux **sans contraste thermique** (contraste médian −0,015 contre +0,040).
3. **Le piéton moyen** (`mean_pedestrian.png`, 4 082 découpes) le montre d'un coup d'œil : dans le RGB moyen, la silhouette est presque invisible (sombre, sans contraste) ; dans l'IR réel, la tête et le torse sont nettement plus chauds que le fond. **L'information « chaleur » n'est pas dans le RGB.**
4. **Conclusion sur la cause :** le générateur échoue à la **traduction**, pas à la représentation. Il doit inventer une information (la température) que son entrée ne contient presque pas. Changer d'architecture ou de résolution ne servirait à rien ; il faudrait **une source d'information en plus** (un prior « les humains sont chauds », ou une supervision sur les piétons), ce que le pseudo-étiquetage fait autrement en utilisant directement l'IR réel.
5. **Réplication sur l'A100** (`ir_full` d'origine, 0,623) : IR réel 0,623, resize512 0,627, vaefull 0,623, vae512 0,615. Même conclusion (écart ≤ 0,008).

**Analyse piéton par piéton avec le synthétique (A100, `results/explain/pedestrians.json`, figures `recall_by_height.png`, `mean_pedestrian.png`)** :
| Jeu de test (le détecteur IR réel `ir_full` lui est appliqué ; RGB : détecteur `rgb_full` sur RGB test) | Rappel des 8 302 piétons |
|---|---|
| IR réel test | 0,930 |
| IR réel → 512² + VAE | 0,925 |
| IR synthétique T100 (depuis RGB test) | 0,153 |
| IR synthétique T1000 (depuis RGB test) | 0,224 |
| RGB réel test (détecteur RGB) | 0,882 |

6. **76 %** des piétons trouvés sur l'IR réel sont perdus sur T1000 ; **89 %** de ces perdus sont trouvés par le détecteur RGB sur le RGB (ils étaient **visibles** dans l'entrée), **2 %** seulement sont aussi perdus après le VAE (ce n'est pas l'architecture). Tableau croisé (piétons trouvés sur IR réel) : RGB trouvé & T1000 trouvé 1 804 ; RGB trouvé & T1000 perdu **5 275** ; RGB perdu & T1000 trouvé 19 ; perdus par les deux 623.
7. **Qui est perdu ?** Les piétons **sombres en RGB** (luminance médiane 0,117 contre 0,180 pour les gardés) — mais pas plus froids en IR réel (contraste 0,042 contre 0,031). Sur T1000, leur contraste n'est plus que 0,008 (contre 0,022 pour les gardés). Le rappel sur T1000 monte avec la luminance RGB (0,08 → 0,35) alors qu'il est plat sur l'IR réel ; la taille joue peu. Régression logistique (coefficients standardisés) : luminance RGB −0,46, contraste RGB +0,59, taille −0,25, contraste IR −0,07 ; AUC 0,72 (en échantillon).
8. **Conclusion affinée :** le générateur **suit la lumière, pas la chaleur**. Il rend un piéton plus clair quand il est éclairé dans le RGB, et le laisse au niveau du fond sinon, alors que dans l'IR réel tous les piétons sont chauds. L'information « ce piéton existe » est dans le RGB (le détecteur RGB le trouve) ; l'information « il est chaud » n'y est pas, et le générateur n'a pas appris l'a priori « les humains sont chauds ». Le piéton moyen T1000 est uniforme ; la carte d'écart moyenne |T1000 − réel| est maximale sur la tête et le torse.

### 9.5 Le pseudo-étiquetage croisé (E4) : fait
**Le principe.** Les N paires RGB/IR non annotées sont alignées pixel à pixel. On applique un détecteur de personnes RGB **standard** (YOLO11s pré-entraîné sur COCO, qui n'a jamais vu LLVIP) sur la moitié RGB de chaque paire, et on recopie ses boîtes sur la moitié **IR réelle**. On obtient N vraies images IR avec des labels bruités, **sans générateur**. C'est hors ligne, donc à pleine résolution (1280).

**La différence avec avant.**
| | Générateur (T100 / T1000) | Pseudo-étiquetage (P100 / P1000) |
|---|---|---|
| À quoi servent les paires | apprendre une **traduction** RGB → IR | rien à apprendre : elles sont **utilisées telles quelles** |
| Images d'entraînement du détecteur | 12 025 images **synthétiques** (piétons gris, P19) | N images **IR réelles** |
| Labels | les vraies boîtes RGB (12 025 images annotées) | boîtes **prédites** par un détecteur COCO (bruitées), **zéro label LLVIP** |
| Coût | entraîner un modèle de diffusion (2 h) puis générer (30 min) | une inférence (1 min) |
| Risque | l'écart d'apparence synthétique / réel | le bruit des labels (piétons ratés de nuit dans le RGB) |

**Où on l'utilise.** Aux mêmes endroits que le synthétique : (1) **zéro label IR** : détecteur entraîné sur les seules paires pseudo-étiquetées (`pl_P100`, `pl_P1000`), à comparer à `synth_T100` / `synth_T1000` ; (2) **pré-entraînement puis fine-tuning** sur N vraies images IR (`ft_N*_PL`, `ft_N*_PL100`), à comparer à `ft_N*_T100` / `T1000` / `RGB`, et en chaîne RGB → pseudo-labels → IR (`ft_N*_RGBPL`). La qualité des pseudo-labels est mesurée contre les vraies boîtes des paires (analyse seulement, rien n'est réglé dessus).

**Remarque de protocole que ce test révèle.** Dans notre montage, les images RGB des paires font partie des 12 025 images RGB annotées. Les paires apportent donc en réalité **N images IR annotées gratuitement** (les boîtes sont partagées). Le scénario réaliste est : des RGB annotés d'une autre source, plus quelques paires non annotées. Le détecteur COCO joue exactement ce rôle de « RGB annoté d'ailleurs ».

**Résultats.** Sur l'A100 : `pl_P1000f` 0,523 ; refait sur le H100 (B18) : 0,529, mêmes splits. Les tableaux ci-dessous donnent les chiffres de l'A100 pour les entraînements sans fine-tuning.

Qualité des pseudo-labels sur les 1000 paires, contre les vraies boîtes (seuil 0,25 fixé à priori) :
| Source des pseudo-labels | Précision | Rappel | AP50 |
|---|---|---|---|
| COCO sur le RGB | 0,87 | **0,34** | 0,45 |
| COCO sur l'IR | 0,83 | 0,42 | 0,52 |
| **COCO sur RGB + IR (union, NMS 0,5)** | 0,83 | **0,50** | 0,58 |

Détecteurs entraînés **sans aucun label LLVIP**, mAP50-95 sur l'IR réel de test :
| Entraînement | Images | Labels | mAP50-95 |
|---|---|---|---|
| `synth_T100` / `synth_T1000` | 12 025 IR synthétiques | vraies boîtes RGB | 0,328 / 0,384 |
| `rgb_full` | 12 025 RGB | **12 025 vraies boîtes** | 0,468 |
| `pl_P100` | 100 IR réelles | COCO sur RGB | 0,358 |
| `pl_P1000` | 1000 IR réelles | COCO sur RGB | 0,429 |
| `pl_P1000_fromRGB` | 1000 IR réelles, init `rgb_full` | COCO sur RGB | 0,447 |
| **`pl_P1000f`** | **1000 IR réelles** | **COCO sur RGB + IR** | **0,523** |

**Lecture :**
1. **100 vraies images IR mal étiquetées valent mieux que 12 000 images synthétiques bien étiquetées** (0,358 contre 0,328 ; 0,429 contre 0,384 à 1000). L'écart d'apparence du synthétique coûte plus cher qu'un rappel de 34 %.
2. **La fusion RGB + IR des pseudo-labels est le meilleur résultat à zéro label** : 0,523, au-dessus du détecteur RGB entraîné sur 12 025 vraies boîtes (0,468), et au-dessus de `real_N100` (0,495)… sans annoter une seule image IR. La multimodalité sert une seconde fois : pas seulement pour **détecter**, aussi pour **étiqueter**. Un piéton invisible dans le RGB sombre est souvent vu dans l'IR, et inversement.
3. **Le fine-tuning sur N vraies images dégrade ce point de départ** (confirmé sur le H100, 2 seeds, `pl_P1000f` refait = 0,529) :

| N vraies images IR | réel seul | RGB → réel | IR pseudo-étiqueté RGB → réel | **IR pseudo-étiqueté RGB+IR → réel** |
|---|---|---|---|---|
| 0 | — | 0,468 | 0,424 | **0,529** |
| 10 | 0,328 | 0,500 | 0,396 | 0,475 |
| 25 | 0,423 | 0,540 | 0,429 | 0,489 |
| 50 | 0,458 | 0,543 | 0,455 | 0,496 |
| 100 | 0,495 | 0,526 | 0,480 | 0,517 |

   - **Zéro label IR, 0,529 : c'est plus que tous les résultats à 100 vraies images annotées**, toutes méthodes confondues (meilleur à N = 100 : 0,526 avec le RGB). Seul le pré-entraînement RGB à N = 25 et 50 fait mieux (0,540 / 0,543).
   - **Fine-tuner sur 10 à 100 vraies images fait redescendre** (0,475 à 0,517) : 100 époques sur quelques images font oublier ce qui a été appris sur 1000 (oubli catastrophique, sur-apprentissage). Le RGB résiste mieux, parce qu'il part de 12 025 images et d'un point plus bas.
   - **Avec les pseudo-labels RGB seuls** (rappel 0,34), le fine-tuning remonte au niveau du réel seul, sans plus : des labels trop incomplets n'apportent presque rien.
   - **Recette à tester ensuite** : fine-tuning court (10 à 20 époques), ou entraînement sur pseudo-labels + vrais labels mélangés, ou ré-étiquetage itératif des 1000 paires par le détecteur IR obtenu (auto-apprentissage).
4. Limite : « zéro label LLVIP » ne veut pas dire zéro label : le détecteur COCO a appris les personnes sur COCO. C'est exactement le scénario réaliste (un détecteur générique existe toujours) et c'est pour ça que c'est la bonne référence.

### 9.6 Pipeline 100 % GPU (E6) : fait
**Résultat** (`results/latency_gpu.json`, `ir_full`, A100, batch 1, 500 frames, les deux pipelines mesurés dans le même run, GPU seul) :
| Pipeline | Pré-traitement | Inférence | Post-traitement | Bout en bout p50 | p95 | FPS | mAP50-95 (évaluateur maison) |
|---|---|---|---|---|---|---|---|
| Ultralytics + TensorRT FP16 (CPU pour pré/post) | 1,40 ms | 1,42 ms | 0,94 ms | 4,04 ms | 4,86 ms | 248 | 0,613 |
| **100 % GPU** (NMS dans le moteur) | 0,28 ms (GPU) | 1,46 ms (avec NMS) | 0,17 ms (GPU) | **2,30 ms** | **2,46 ms** | **435** | 0,612 |

- **×1,76 sur la latence médiane, ×2 sur le p95**, à précision égale (écart de mAP 0,001, dû au redimensionnement bilinéaire torch au lieu de cv2).
- Le réseau représente maintenant **64 %** du temps : le reste du pipeline n'est plus le goulot. La prochaine marche serait l'INT8 (le réseau lui-même), pas le CPU.
- Le p95 colle au p50 (2,46 contre 2,30 ms) : la gigue venait bien du CPU et de Python.
- Deux pièges rencontrés, à raconter : une copie mémoire vers la mémoire épinglée coûtait **98 ms** à cause de 128 threads OpenMP (B12) ; le CUDA graph n'est pas capturable avec la NMS dans le moteur (B14).
- Note de mesure (P23) : la référence Ultralytics mesure 4,04 ms ce soir contre 5,86 ms ce matin, quand d'autres jobs chargeaient la machine. On ne compare que des chiffres du même run.
**Question :** combien gagne-t-on en sortant le CPU de la boucle ? Après **une seule** copie de l'image brute vers le GPU (une image de caméra arrive en mémoire hôte), tout est sur le GPU : conversion BGR → RGB, redimensionnement, padding et normalisation en torch ; réseau et **NMS dans le moteur TensorRT** (export `nms=True`) ; remise à l'échelle des boîtes et filtre de confiance ; une petite copie retour (≤ 300 × 6 nombres). Variante : tout le traitement capturé dans un **CUDA graph** (un seul lancement par image). On vérifie que le mAP est inchangé, avec le même évaluateur pour les deux pipelines.

**Le générateur n'a pas besoin d'être temps réel** : il fabrique des données d'entraînement, hors ligne (12 000 images ≈ 35 min, une fois). Le temps réel n'aurait compté que pour reconstruire un capteur mort à l'exécution, et P20 montre que c'est contre-productif.

### 9.7 Conclusions des extensions
| Question | Réponse | Preuve |
|---|---|---|
| Pourquoi le générateur perd-il les piétons ? | **Pas à cause de l'architecture** (résolution, VAE) : l'IR réel passé par son pipeline garde 0,620 sur 0,618. C'est la **traduction** qui échoue : 76 % des piétons perdus sur T1000, dont 89 % visibles pour le détecteur RGB ; les perdus sont les piétons sombres en RGB. Le générateur **suit la lumière, pas la chaleur** | plafond du VAE, piéton moyen, analyse par piéton (§9.4) |
| Quelle était la référence naïve la plus forte ? | **L'IR réel pseudo-étiqueté avec la fusion RGB + IR** : 0,529 sans aucun label IR, plus que n'importe quelle méthode à 100 labels | §9.5 |
| La multimodalité sert-elle ? | Oui, deux fois : pour **détecter** (fusion robuste, §5) et pour **étiqueter** (rappel des pseudo-labels 0,34 → 0,50, mAP 0,424 → 0,529) | §9.5 |
| Fine-tuner sur peu de vrais labels aide-t-il toujours ? | **Non** : sur un bon point de départ, 100 époques sur 10 à 100 images le dégradent | §9.5 |
| Le CPU limitait-il la latence ? | Oui : tout sur GPU, 2,30 ms contre 4,04 ms, à mAP égal | §9.6 |
| Quelle métrique d'image prédit l'utilité ? | **La FD-DINOv2 calculée dans les boîtes** : ρ = 0,94 sur 11 jeux (Pearson 0,98, stable au retrait d'un jeu). Les mesures « vues par le détecteur IR » (FD-YOLO, détectabilité) échouent entre sources (ρ ≈ 0,5) mais classent parfaitement les générateurs entre eux | §9.3 |

**Ce que ça change pour le message du projet.** Le générateur RGB→IR était l'idée de départ ; les mesures montrent qu'il est battu deux fois par des références plus simples, et expliquent pourquoi (il doit inventer une information absente de son entrée). Le meilleur usage des paires RGB/IR non annotées n'est pas de **traduire**, mais de **transférer les labels** d'une modalité à l'autre en fusionnant ce que voient les deux capteurs.
