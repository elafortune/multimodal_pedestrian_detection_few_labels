#!/usr/bin/env bash
# E4 variant: multimodal pseudo-labels (COCO detector on RGB + on IR, union + NMS). Decided a priori after seeing
# that COCO-on-RGB recall is only 34 % at night; not tuned on the test set. One GPU job at a time.
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; SP=$B/splits; L=$B/logs/ext
det() { local name=$1; shift; $PY $S/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
echo "$(date +%H:%M) plf: labelling" >> $L/ext.log
$PY $S/14_pseudo_labels.py --n 1000 --fused > $L/plf.log 2>&1 || { echo "FAILED plf" >> $L/FAILED; exit 1; }
det pl_P1000f --train $B/data/pl/P1000f/images/train --epochs 40
for s in 0 1; do for n in 10 25 50 100; do
  det ft_N${n}_s${s}_PLf --train $SP/ir_train_N${n}_s${s}.txt --epochs 100 --seed $s --model $B/runs/det/pl_P1000f/weights/last.pt
done; done
echo "$(date +%H:%M) plf: done" >> $L/ext.log; touch $L/plf.done
