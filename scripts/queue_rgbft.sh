#!/usr/bin/env bash
# Missing baseline (P21): pretrain on REAL RGB (rgb_full, same 12k boxes) then fine-tune on N real IR.
# Same recipe as ft_N*_T* (100 epochs). If this matches ft from synthetic IR, the generator adds nothing for detection.
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics
B=/workspace/bsa; PY=/workspace/venv/bin/python; SP=$B/splits; L=$B/logs/det
run() { local name=$1; shift; $PY $B/code/scripts/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
for s in 0 1; do for n in 10 25 50 100; do
  run ft_N${n}_s${s}_RGB --train $SP/ir_train_N${n}_s${s}.txt --epochs 100 --seed $s --model $B/runs/det/rgb_full/weights/last.pt &
  [ $n = 25 ] || [ $n = 100 ] && wait   # 2 runs at a time
done; done; wait
echo DONE > $L/rgbft.done
