#!/usr/bin/env bash
# Very small label budgets (N=10, 25), after the baseline queue. mix/ft use T100 (100 unlabeled pairs).
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics
B=/workspace/bsa; PY=/workspace/venv/bin/python; DET=$B/code/scripts/05_train_detector.py; SP=$B/splits; L=$B/logs/det
run() { local name=$1; shift; $PY $DET --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
until [ -f $L/baselines.done ]; do sleep 60; done
for s in 0 1; do for n in 10 25; do run real_N${n}_s${s} --train $SP/ir_train_N${n}_s${s}.txt --epochs 200 --seed $s; done; done
until [ -f $B/runs/det/synth_T100/weights/last.pt ] && [ -f $B/results/det/synth_T100.json ]; do sleep 60; done
for n in 10 25 50; do
  run ft_N${n}_s0_T100 --train $SP/ir_train_N${n}_s0.txt --epochs 100 --model $B/runs/det/synth_T100/weights/last.pt
  run mix_N${n}_s0_T100 --train $SP/ir_train_N${n}_s0.txt $B/data/synth/T100/images/train --epochs 30
done
echo DONE > $L/small.done
