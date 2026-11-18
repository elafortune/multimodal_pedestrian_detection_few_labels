#!/usr/bin/env bash
# Baseline detectors that do not need the translator: real IR subsets, full IR, full RGB.
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics
PY=/workspace/venv/bin/python; S=/workspace/bsa/code/scripts/05_train_detector.py
SP=/workspace/bsa/splits; D=/workspace/bsa/data/yolo; L=/workspace/bsa/logs/det; mkdir -p $L
declare -A EP=([50]=150 [100]=100 [250]=60 [1000]=40)
run() { local name=$1; shift; $PY $S --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }

# ordered by usefulness for the video: first one seed of each N, then the references, then seed 1
for n in 100 1000 50 250; do run real_N${n}_s0 --train $SP/ir_train_N${n}_s0.txt --epochs ${EP[$n]} --seed 0; done
run rgb_full --train $D/rgb/images/train --epochs 30 --eval ir rgb
run ir_full  --train $D/ir/images/train  --epochs 30
for n in 50 100 250 1000; do run real_N${n}_s1 --train $SP/ir_train_N${n}_s1.txt --epochs ${EP[$n]} --seed 1; done
echo DONE > $L/baselines.done
