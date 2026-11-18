#!/usr/bin/env bash
# Re-run the N=10/25 fine-tunes that failed for lack of split files (B19).
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; SP=$B/splits; L=$B/logs/h100
det() { local name=$1; shift; $PY $S/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
$PY $S/make_small_splits.py > $L/small_splits.log 2>&1 || { echo "FAILED small_splits" >> $L/FAILED; exit 1; }
# wait for the main PL lane to finish its own fine-tunes (avoid >4 trainings on the GPU)
until grep -q "pl: done" $L/h100.log; do sleep 30; done
for tag in PLf PL; do
  W=$B/runs/det/pl_P1000${tag#PL}/weights/last.pt
  for s in 0 1; do
    det ft_N10_s${s}_${tag} --train $SP/ir_train_N10_s${s}.txt --epochs 100 --seed $s --model $W &
    det ft_N25_s${s}_${tag} --train $SP/ir_train_N25_s${s}.txt --epochs 100 --seed $s --model $W &
    wait
  done
done
echo "$(date +%H:%M) small: done" >> $L/h100.log
