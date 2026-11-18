#!/usr/bin/env bash
# Replacement H100 pod (B17): everything that does not need the A100 disk.
#   lane PL  : pseudo-labels (COCO on RGB, and on RGB+IR) -> pl_P1000, pl_P1000f -> fine-tunes N10..100 x 2 seeds
#   lane IR  : ir_full (same recipe: 30 epochs) -> VAE / resize sets -> VAE ceiling + per-pedestrian analysis
# Splits are deterministic (01_make_splits.py, fixed seeds): identical to the A100 ones.
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; SP=$B/splits; L=$B/logs/h100
mkdir -p $L $B/results/figures
log() { echo "$(date +%H:%M) $*" >> $L/h100.log; }
det() { local name=$1; shift; $PY $S/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }

until [ -f $B/logs/setup.done ]; do sleep 20; done
(cd $B/weights && $PY -c "from ultralytics import YOLO; YOLO('yolo11s.pt')" > $L/weights.log 2>&1)
log "splits"; $PY $S/01_make_splits.py > $L/splits.log 2>&1 || { echo "FAILED splits" >> $L/FAILED; exit 1; }

lane_pl() {
  log "pl: labelling"
  $PY $S/14_pseudo_labels.py --n 1000 > $L/pl.log 2>&1 && $PY $S/14_pseudo_labels.py --n 1000 --fused >> $L/pl.log 2>&1 || { echo "FAILED pl" >> $L/FAILED; return; }
  det pl_P1000f --train $B/data/pl/P1000f/images/train --epochs 40 &
  det pl_P1000 --train $B/data/pl/P1000/images/train --epochs 40 &
  wait; log "pl: fine-tunes"
  for tag in PLf PL; do
    case $tag in PLf) W=$B/runs/det/pl_P1000f/weights/last.pt;; PL) W=$B/runs/det/pl_P1000/weights/last.pt;; esac
    for s in 0 1; do for n in 10 25 50 100; do
      det ft_N${n}_s${s}_${tag} --train $SP/ir_train_N${n}_s${s}.txt --epochs 100 --seed $s --model $W &
      [ $n = 25 ] || [ $n = 100 ] && wait
    done; done
  done
  wait; log "pl: done"
}
lane_ir() {
  log "ir: ir_full"
  det ir_full --train $B/data/yolo/ir/images/train --epochs 30 &
  log "ir: VAE / resize sets (in parallel)"
  $PY $S/11_make_proxy_sets.py > $L/sets.log 2>&1 || echo "FAILED sets" >> $L/FAILED
  wait; log "ir: ceiling + pedestrians"
  $PY $S/13_ceiling_pedestrians.py > $L/ceiling.log 2>&1 || echo "FAILED ceiling" >> $L/FAILED
  log "ir: done"
}
lane_pl & lane_ir & wait
log "ALL DONE"; touch $L/h100.done
