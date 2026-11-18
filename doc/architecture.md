# Architecture

> Chaque étape est décrite sous la forme **Entrée → Outil → Sortie**, avec les formats et les chemins (sur le pod, racine `/workspace/bsa`).

## Vue d'ensemble

```
                         LLVIP (officiel, 4 Go)
              visible/{train,test}  infrared/{train,test}  Annotations/*.xml
                                   │
                         [S1] 01_make_splits.py
                ┌──────────────────┼────────────────────────┐
                ▼                  ▼                        ▼
       YOLO RGB / IR         listes N × seed          datasets appariés 512²
       (labels partagés)     (splits/*.txt)           p2p/N{100,1000,full}
                │                  │                        │
                │                  │              [S2] pix2pix-turbo (LoRA SD-Turbo)
                │                  │                        │  ckpt/translator_N*.pkl
                │                  │              [S3] 03_generate_ir.py
                │                  │                        ▼
                │                  │           IR synthétique 1280×1024 (+ labels hérités)
                │                  │                        │
                │      ┌───────────┴─────────┬──────────────┤
                │      ▼                     ▼              ▼
                │  [S5] YOLO11s grille   [S4] métriques A   démo B
                │  real / real+synth /    FID, KID, FD-DINOv2,
                │  synth / rgb            PRDC, UMAP
                │      │                     │
                │      ▼                     ▼
                │  results/det/*.json     results/gap/*.json ──► [S6] corrélation A↔C
                ▼      │
     [S7] Multimodal : late fusion WBF, robustesse capteurs, IR reconstruit, (early fusion 4 canaux)
                       │
     [S8] Export ONNX → TensorRT FP16 → benchmark latence  ──►  [S9] Gradio (pod) / HF Space
                       │
               results/figures/*.png  ──►  vidéo (EN) + slides (FR)
```

## Étapes détaillées

### S1 — Préparation des données (`scripts/01_make_splits.py`)
| | |
|---|---|
| **Entrée** | `data/LLVIP/{visible,infrared}/{train,test}/*.jpg` (paires 1280×1024 alignées, même nom de fichier) ; `data/LLVIP/Annotations/*.xml` (VOC, classe `person`) |
| **Outils** | `xml.etree`, PIL, symlinks |
| **Sortie** | `data/yolo/{rgb,ir}/{images,labels}/{train,test}/` : `labels/*.txt` au format YOLO `cls cx cy w h` normalisés. Le **même label** sert au RGB, à l'IR réel et à l'IR synthétique.<br>`splits/ir_train_N{n}_s{seed}.txt` : listes de chemins d'images, imbriquées (N=50 ⊂ N=100 ⊂ …).<br>`data/p2p/N{n}/{train_A,train_B,test_A,test_B}/*.png` en 512×512, avec `train_prompts.json` / `test_prompts.json` |

### S2 — Générateur RGB→IR (`img2img-turbo/src/train_pix2pix_turbo.py`)
| | |
|---|---|
| **Entrée** | `data/p2p/N{n}/` : RGB 512² (A) → IR 512² (B), prompt fixe `"thermal infrared image"` |
| **Modèle** | pix2pix-turbo : SD-Turbo en 1 pas, LoRA sur l'U-Net (rang 8) et le VAE (rang 4), skip connections encodeur → décodeur. Pertes : L2 + LPIPS + GAN (discriminateur CLIP vision-aided) + similarité CLIP |
| **Sortie** | `ckpt/translator_N{n}/checkpoints/model_{step}.pkl` (poids LoRA, quelques dizaines de Mo) |

### S3 — Génération de l'IR synthétique (`scripts/03_generate_ir.py`)
| | |
|---|---|
| **Entrée** | RGB train 1280×1024, checkpoint du générateur |
| **Outils** | pix2pix-turbo en inférence (fp16, batch), resize 512² → 1280×1024 |
| **Sortie** | `data/synth/T{n}/images/train/*.jpg` (IR synthétique) + `labels/` (symlinks vers les labels réels) |

### S4 — Mesure du gap, partie A (`scripts/04_gap_metrics.py`)
| | |
|---|---|
| **Entrée** | 3 ensembles d'images : IR réel test, IR synthétique (par générateur), RGB (référence du gap naïf) |
| **Outils** | `clean-fid` (FID/KID, Inception) ; DINOv2 ViT-B/14 (HF) → embeddings 768-d ; `prdc` (precision / recall / density / coverage, k=5) ; `umap-learn` |
| **Sortie** | `results/gap/{T100,T1000,Tfull,rgb}.json` `{fid, kid, fd_dinov2, precision, recall, density, coverage}` ; `results/figures/umap.png` |

### S5 — Détection, partie C (`scripts/05_train_detectors.py`)
| | |
|---|---|
| **Entrée** | data yaml Ultralytics pointant vers les listes de S1 (+ dossiers synthétiques S3) |
| **Modèle** | YOLO11s pré-entraîné COCO, 640 px, `cache=ram` |
| **Configurations** | `real_N` : N IR réelles · `real+synth_N` : N réelles + IR synthétique de `T{N}` · `synth_N` : synthétique seul · `rgb` : RGB train, évalué sur l'IR test · `ir_full` : borne haute |
| **Évaluation** | toujours sur **IR réel test LLVIP** (3463 images, scènes disjointes) |
| **Sortie** | `runs/det/<nom>/weights/best.pt` ; `results/det/<nom>.json` `{mAP50, mAP50_95, P, R}` |

### S6 — Analyse (`scripts/06_make_figures.py`)
| | |
|---|---|
| **Entrée** | `results/gap/*.json`, `results/det/*.json` |
| **Sortie** | `results/figures/map_vs_N.png`, `gap_table.md`, `gap_vs_gain.png`, galerie des échecs |

### S7 — Multimodalité (`scripts/07_multimodal.py`)
| | |
|---|---|
| **Entrée** | détecteurs RGB et IR (S5), générateur (S2), images test appariées |
| **Outils** | `ensemble-boxes` (WBF) ; dégradations simulées (gamma / bruit / brouillard sur le RGB, IR masqué) ; YOLO 4 canaux (bonus) |
| **Scénarios** | nominal · RGB dégradé · IR absent · RGB absent |
| **Sortie** | `results/multimodal/robustness.json` → tableau scénario × {RGB, IR, late fusion, fusion + IR reconstruit, early fusion} |

### S8 — Déploiement (`scripts/08_export_trt.py`)
| | |
|---|---|
| **Entrée** | `best.pt` du détecteur IR |
| **Outils** | export Ultralytics → ONNX → moteur TensorRT FP16 (NMS dans le graphe) |
| **Sortie** | `deploy/yolo11s_ir_fp16.engine` ; `results/latency.json` (p50/p95 de bout en bout, FPS, PyTorch vs TRT) |

### S9 — Démo (`app/demo.py`)
| | |
|---|---|
| **Entrée** | image ou vidéo RGB LLVIP (+ IR réel si disponible) |
| **Chaîne** | RGB → générateur → IR synthétique → YOLO TRT → boîtes ; vue côte à côte RGB / IR réel / IR généré ; bouton « capteur IR en panne » |
| **Sortie** | interface Gradio (port 7860 du pod) ; Space HF en version PyTorch |

## Arborescence

```
bsa_helsing/            (local = source de vérité du code, synchronisé vers /workspace/bsa/code)
├── doc/                suivi (ce dossier)
├── scripts/            S1…S8
├── app/                S9
├── configs/
└── results/            json + figures rapatriés du pod
/workspace/bsa/         (pod)
├── data/  ckpt/  runs/  logs/  results/
├── img2img-turbo/      dépendance externe (commit 86f5414)
└── code/               copie synchronisée du repo
```
