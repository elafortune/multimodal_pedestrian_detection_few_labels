#!/usr/bin/env bash
# P21 follow-up: does synthetic IR add anything ON TOP of real-RGB pretraining?
# rgb_full -> synthetic T1000 (30 ep) -> fine-tune on N real IR (100 ep). Compare with ft_N*_RGB.
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics
B=/workspace/bsa; PY=/workspace/venv/bin/python; SP=$B/splits; L=$B/logs/det
run() { local name=$1; shift; $PY $B/code/scripts/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
run synth_T1000_fromRGB --train $B/data/synth/T1000/images/train --epochs 30 --model $B/runs/det/rgb_full/weights/last.pt
W=$B/runs/det/synth_T1000_fromRGB/weights/last.pt
for s in 0 1; do for n in 10 25 50 100; do
  run ft_N${n}_s${s}_RGBT1000 --train $SP/ir_train_N${n}_s${s}.txt --epochs 100 --seed $s --model $W &
  [ $n = 25 ] || [ $n = 100 ] && wait
done; done; wait
echo DONE > $L/chain.done
