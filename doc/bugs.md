# Bugs rencontrés

> Format : symptôme → cause → correctif → statut.

## B1 — `pip install` refusé (PEP 668)
- **Symptôme :** `error: externally-managed-environment` lors du `pip install` système.
- **Cause :** l'image RunPod (Ubuntu 24.04, Python 3.12) marque l'environnement système comme « externally managed ».
- **Correctif :** `python -m venv --system-site-packages /workspace/venv`, qui garde le torch 2.8 de l'image, puis installation dans le venv.
- **Statut :** corrigé.

## B2 — SSH « Connection refused » après modification du pod
- **Symptôme :** `connect to host <ip du pod> port <port>: Connection refused`.
- **Cause :** *Edit Pod* redémarre le conteneur et RunPod réattribue le port TCP exposé.
- **Correctif :** nouveau port dans l'alias SSH du pod (`~/.ssh/config`).
- **Statut :** corrigé.

## B3 — `cached_download` introuvable (diffusers 0.25.1 contre huggingface_hub récent)
- **Symptôme :** `ImportError: cannot import name 'cached_download' from 'huggingface_hub'`.
- **Cause :** img2img-turbo épingle diffusers 0.25.1, qui utilise une API retirée de huggingface_hub (2.4.0 installé, exigé par transformers 5.x).
- **Correctif :** diffusers 0.32.2. Le code img2img-turbo fonctionne tel quel (test d'entraînement de 50 pas OK).
- **Statut :** corrigé.

## B4 — `sqrtm() got an unexpected keyword argument 'disp'` (clean-fid)
- **Symptôme :** plantage de `cleanfid.fid.frechet_distance` avec la version récente de scipy.
- **Cause :** scipy a retiré l'argument `disp` de `linalg.sqrtm`.
- **Correctif :** distance de Fréchet réimplémentée par décomposition propre symétrique, tr√(S1S2) = Σ√eig(√S1·S2·√S1), plus stable que sqrtm. Le KID de clean-fid n'est pas touché.
- **Statut :** corrigé.

## B5 — pix2pix-turbo ignore `--max_train_steps`
- **Symptôme :** la boucle s'arrête seulement après `num_training_epochs` (10 par défaut), soit 250 pas pour N=100, ou ne s'arrête jamais si on augmente les epochs.
- **Cause :** aucune condition d'arrêt sur `global_step` dans `train_pix2pix_turbo.py`.
- **Correctif :** patch local qui ajoute `break` à `max_train_steps` dans les deux boucles (original sauvé en `.orig`). Budget en pas (k·500+1 pour que le dernier pas soit un checkpoint).
- **Statut :** corrigé pour N=1000 et full. Le run N=100 a été lancé avant le patch avec 61 epochs ≈ 1525 pas, dernier checkpoint au pas 1501.

## B6 — `tar` : « Cannot change ownership » lors de la synchro Windows → pod
- **Correctif :** `tar xf - --no-same-owner`.
- **Statut :** corrigé.

## B7 — Export TensorRT : `NetworkDefinitionCreationFlag has no attribute 'EXPLICIT_BATCH'`
- **Symptôme :** `model.export(format="engine")` plante dans `ultralytics/utils/export/engine.py`.
- **Cause :** TensorRT 11 (installé par défaut via `pip install tensorrt`) a retiré `EXPLICIT_BATCH`, déprécié depuis TRT 10. Ultralytics 8.3.253 l'utilise encore.
- **Correctif :** désinstallation de TRT 11, puis `pip install "tensorrt-cu12>=10.0,<11"` → 10.16.1.11.
- **Statut :** corrigé (build du moteur en cours, lent car le GPU est partagé).

## B8 — Générateurs N1000 et full : `torch.OutOfMemoryError: CUDA out of memory`
- **Symptôme :** `translator_N1000.log` et `translator_Nfull.log` finissent par `EXIT=1` au pas 0. Les jobs de `qsyn` qui dépendaient de T1000 et Tfull ont échoué en cascade (`synth_T1000`, `mix/ft_N1000_s0`, `synth_Tfull`, génération T1000/Tfull : `--ckpt: expected one argument`).
- **Cause :** au démarrage du générateur (~41 Go), 4 autres processus occupaient déjà le GPU : le build TensorRT, 2 entraînements YOLO et le pix2pix classique (au total 79,2 Go sur 79,25). Les files ne vérifiaient pas la mémoire libre, et `qsyn` n'arrêtait pas sa chaîne quand le générateur échouait.
- **Correctif :** `queue_recover.sh` avec au plus 2 jobs GPU simultanés (générateur + 1 YOLO), `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`, et une file qui suit l'ordre des dépendances. Le générateur full (oracle) est abandonné pour tenir les délais.
- **Statut :** corrigé, N1000 relancé à 10h55.
- **Leçon :** sur un seul GPU, il faut un ordonnanceur qui tient compte de la mémoire, ou des files strictement séquentielles pour les gros jobs. Le parallélisme opportuniste a coûté ~2 h de GPU inactif.

## B9 — Métriques du gap : `ModuleNotFoundError: No module named 'torchmetrics'`
- **Correctif :** `pip install torchmetrics`. Relancé en fin de file `qA`.
- **Statut :** corrigé.

## B10 — Démo : visages non floutés quand le RGB est dégradé
- **Symptôme :** test de la démo en mode brouillard : 0 personne détectée sur le RGB, donc aucun floutage, et les visages des cyclistes restent visibles.
- **Cause :** le floutage des têtes ne s'appuyait que sur les détections.
- **Correctif :** floutage de l'union des boîtes de vérité terrain LLVIP, des détections RGB, IR et fusion. La zone floutée est élargie (35 % du haut de la boîte, +15 % sur les côtés), et l'IR reconstruit est flouté lui aussi. Vérifié sur `results/figures/demo_smoke.jpg`.
- **Statut :** corrigé.

## B11 — WBF très lent : 745 ms par frame
- **Symptôme :** dans la démo, la fusion coûte 745 ms alors que les deux détecteurs prennent 7 ms. Le même coût dans `07_multimodal.py` aurait pris ~4 h (3 463 frames × 6 scénarios).
- **Cause :** les prédictions à conf 0,001 donnent ~300 boîtes par modèle, et `ensemble_boxes` est en O(n²) en Python pur.
- **Correctif :** filtrage avant WBF, à conf ≥ 0,05 dans la démo (0,3 ms) et ≥ 0,01 dans l'évaluation. C'est conservateur pour les lignes de fusion, qui perdent la queue de la courbe PR.
- **Statut :** corrigé.
- **Leçon :** une latence se mesure par étape. Le goulot n'était pas le réseau.

## B12 — Pipeline GPU à 99 ms au lieu de 2 ms : copie vers la mémoire épinglée
- **Symptôme :** le premier essai du pipeline 100 % GPU (`16_gpu_pipeline.py`) donne 99 ms par frame (10 FPS), alors que les événements CUDA mesurent 2,2 ms de travail GPU.
- **Cause :** la copie de la frame numpy vers le tampon épinglé, écrite `host.copy_(torch.from_numpy(frame))`, passe par le chemin CPU de torch, parallélisé sur 128 threads OpenMP : 98 ms pour 4 Mo. Avec `torch.set_num_threads(1)` : 5,7 ms.
- **Correctif :** `np.copyto(host.numpy(), frame)`, soit 0,45 ms.
- **Statut :** corrigé. Bout en bout : 2,30 ms.
- **Leçon :** même leçon que B11, en plus sournoise : la ligne la plus banale (une copie mémoire) coûtait 40 fois le réseau. Mesurer le temps mur **et** le temps GPU, et chercher l'écart.

## B13 — « Too many open files » en prédiction Ultralytics sur une liste de chemins
- **Symptôme :** `model.predict([3463 chemins], stream=True)` plante avec `OSError: [Errno 24]`.
- **Cause :** avec une liste, Ultralytics ouvre toutes les images d'avance (`autocast_list`), même en mode `stream`.
- **Correctif :** passer le dossier (lu en flux, trié) ou des lots de 64 chemins ; `ulimit -n 65536` dans la file.
- **Statut :** corrigé.

## B14 — CUDA graph impossible avec la NMS dans le moteur TensorRT
- **Symptôme :** la capture du pipeline dans un CUDA graph échoue (`operation failed due to a previous error during capture`).
- **Cause probable :** le moteur exporté avec `nms=True` contient des opérations à taille dépendante des données (sélection des boîtes), que TensorRT ne peut pas exécuter dans une capture de graphe.
- **Statut :** contourné : mesure en mode « eager » seulement. Piste : moteur sans NMS capturé en graphe, puis NMS séparée, ou un modèle sans NMS (YOLOv10, sortie end-to-end).

## B15 — Jeux VAE à 1,7 image/s, puis `pkill` qui tue sa propre session SSH
- **Symptôme :** `11_make_proxy_sets.py` traitait une image à la fois (chargement, resize, VAE, sauvegarde en série) : 2 h 30 estimées pour 15 000 images, sur un GPU partagé.
- **Correctif :** chargement et redimensionnement dans 16 workers (DataLoader), VAE par lots de 16 (512²) ou 4 (pleine résolution), sauvegarde dans 16 threads. Le script saute les images déjà faites ; les 2 dernières de chaque dossier sont supprimées (écriture peut-être tronquée par l'arrêt).
- **Piège pendant le redémarrage :** `ssh pod 'pkill -f 11_make_proxy_sets.py; …'` tue aussi le shell distant, dont la ligne de commande contient ce nom. Et la file, voyant le script mourir, a écrit `sets.done` à tort. Fait dans un script séparé (`restart_sets.sh`), qui efface le faux `sets.done`.
- **Statut :** corrigé.

## B16 — OOM en voulant accélérer la génération (3 processus de plus)
- **Symptôme :** 4 générations ajoutées en parallèle (`boost_gen.sh`) ; 3 meurent en OOM au chargement du modèle (79,25 Go pris : 2 générations, VAE pleine résolution 23 Go, 3 entraînements YOLO).
- **Impact :** aucun sur la file : seuls les processus ajoutés sont morts, avant d'écrire une image (vérifié). Les voies de la file génèrent ces checkpoints dans l'ordre prévu.
- **Leçon :** même règle que B8. Avant d'ajouter un job GPU, regarder `nvidia-smi` : le VAE en pleine résolution prend à lui seul 23 Go.

## B17 — Le GPU décroche du pod (CUDA error 802) en pleine file d'extensions
- **Symptôme :** à 20h18 UTC, au démarrage de l'analyse, 8 jobs plantent en même temps sur `CUDA error: unspecified launch failure`. Ensuite `nvidia-smi` affiche 0 Mo et aucun processus, et tout nouvel appel CUDA échoue avec `Error 802: system not yet initialized`.
- **Cause probable :** faute du GPU ou du driver côté hôte (sur A100 SXM, l'erreur 802 renvoie au fabric manager / NVLink). Ce n'est pas un OOM : il restait de la mémoire et l'erreur touche tous les processus à la fois. La charge était élevée (7 jobs GPU), ce qui a pu jouer, sans que ce soit établi.
- **Impact :** aucun résultat corrompu (les JSON ne sont écrits qu'en fin de run). Perdus : les entraînements en cours, à refaire. Conservés : toutes les images (sets, checkpoints, pseudo-labels) et les runs finis.
- **Correctif :** files arrêtées (`resume_ext.sh stop`). Il faut **redémarrer le pod** depuis RunPod (le volume `/workspace` est conservé). Puis `resume_ext.sh start` reprend uniquement ce qui manque, avec moins de parallélisme (2 entraînements proxy à la fois au lieu de 3).
- **Statut :** en attente du redémarrage du pod.

## B18 — Reprise sur un H100 de remplacement : le disque de l'A100 est inaccessible, Google Drive refuse LLVIP
- **Contexte :** après la maintenance, l'hôte de l'A100 a un driver NVIDIA incohérent (« Driver/library version mismatch », diagnostic de l'assistant RunPod) et le pod ne démarre plus. Son disque n'est **pas** un volume réseau : il ne s'attache à aucun autre pod.
- **Décision :** H100 SXM de remplacement pour tout ce qui ne dépend pas de ce disque (pseudo-labels, `ir_full`, plafond du VAE, analyse par piéton) ; la corrélation sur 15 jeux attend le retour de l'A100.
- **Problème 1 :** `gdown` refuse LLVIP (quota Google Drive). **Correctif :** miroir Hugging Face de la même archive (`LLVIP.zip`, 4,0 Go) ; effectifs vérifiés : 12 025 / 3 463 images, 15 488 annotations.
- **Problème 2 :** `setup_pod.sh` écrivait `setup.done` même quand le téléchargement échouait, donc la file a démarré sur des dossiers vides. Relancée à la main.
- **Contrôle d'identité :** splits identiques à ceux de l'A100 (34 130 boîtes train, 8 302 test, graines fixes) ; qualité des pseudo-labels COCO sur RGB identique à 0,002 près (précision 0,875 contre 0,873, rappel 0,335 contre 0,335).
- **Statut :** reprise en cours (`queue_h100.sh`).

## B19 — Sur le H100 : splits N=10/25 absents, et `predict()` qui plante après `val()`
- **Splits :** `01_make_splits.py` ne crée que N ∈ {50, 100, 250, 1000} ; N=10 et 25 avaient été ajoutés à la main sur l'A100. Les 8 fine-tunings correspondants ont échoué au premier passage. **Correctif :** `make_small_splits.py`, même règle (préfixe de la même permutation), qui vérifie d'abord qu'elle reproduit exactement les fichiers N=50 existants.
- **`13_ceiling_pedestrians.py` :** un objet YOLO réutilisé pour `predict()` après `val()` lève `RuntimeError: Inference tensors do not track version counter`. **Correctif :** recharger les modèles avant la phase de prédiction.
- **Statut :** corrigés ; tous les runs refaits.

## B20 — Passer de 15 à 11 jeux en cours de route : doublons, et SIGSTOP sans effet
- **Contexte :** pour tenir l'horaire, la corrélation passe de 15 à 11 jeux (4 checkpoints intermédiaires retirés). Il fallait arrêter la boucle de `queue_final.sh` sans tuer `12_box_metrics`, lancé par cette même boucle.
- **Problème 1 :** `kill -STOP` est accepté (code de retour 0) mais **sans effet dans ce conteneur** : le processus reste « S ». L'ancienne boucle a donc continué, et les deux files ont lancé `proxy_vae512` et `proxy_T100_s1` en double, dans les mêmes dossiers.
- **Problème 2 :** tuer la boucle ferme le panneau tmux, qui envoie SIGHUP à tout le groupe, donc aussi à `12_box_metrics` (40 min de calcul).
- **Correctif :** `tmux set-option remain-on-exit on` sur la session, pour que le panneau reste ouvert et que rien ne reçoive SIGHUP ; puis `kill -9` de la boucle et de ses sous-shells d'entraînement seulement ; entraînements en double arrêtés et dossiers effacés (1 à 2 min de calcul perdues). `fix_dup.sh`, `fix_dup2.sh`.
- **Leçon :** une file doit être **arrêtable proprement** (fichier « stop » testé dans la boucle) ; ne pas compter sur SIGSTOP dans un conteneur.
- **Problème 3 (découvert à la fin) :** `12_box_metrics` est **mort quand même** au moment du `kill -9` (10:17 UTC, 8 jeux sur 15 calculés) : `remain-on-exit` n'a pas suffi. `queue_final2.sh` attendait sa fin avec `pgrep` : ne le trouvant plus, il a lancé la corrélation sur **7 jeux** seulement, sans erreur visible.
- **Correctif 3 :** `queue_box_rest.sh` relance `12_box_metrics` sur les 4 jeux manquants (T100, T1000_s1001, T1000, p2p ; `metrics.json` est complété, pas écrasé), puis la corrélation (~35 min).
- **Leçon 3 :** attendre un processus par `pgrep` ne distingue pas « fini » de « tué ». Chaque étape doit écrire un fichier `.done` à la fin, et l'étape suivante vérifier ce fichier et le nombre de jeux attendus.
