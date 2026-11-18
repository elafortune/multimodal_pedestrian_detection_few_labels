#!/usr/bin/env bash
# For each translator, as soon as its training is finished:
#   1. generate synthetic IR on the test split (gap metrics, multimodal) then on the train split
#   2. train detectors: synth_only, mix (real N + synth), ft (synth pretrain -> real N fine-tune)
# Then compute the gap metrics (part A) once all translators are done.
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf
B=/workspace/bsa; PY=/workspace/venv/bin/python; C=$B/code/scripts; L=$B/logs; mkdir -p $L/det
DET=$C/05_train_detector.py; SP=$B/splits
declare -A EP=([100]=100 [1000]=40)
run() { local name=$1; shift; $PY $DET --name $name "$@" > $L/det/$name.log 2>&1 || echo "FAILED $name" >> $L/det/FAILED; }

for tag in 100 1000 full; do
  until grep -q "^EXIT=" $L/translator_N${tag}.log 2>/dev/null; do sleep 60; done
  CK=$(ls $B/ckpt/translator_N${tag}/checkpoints/model_*.pkl | sort -V | tail -1)
  echo "$(date) T${tag}: using $CK" >> $L/queue_synth.log
  for split in test train; do
    $PY $C/03_generate_ir.py --ckpt $CK --tag T${tag} --split $split --batch 16 > $L/gen_T${tag}_${split}.log 2>&1 \
      || echo "FAILED gen T${tag} ${split}" >> $L/queue_synth.log
  done
  SYN=$B/data/synth/T${tag}/images/train
  run synth_T${tag} --train $SYN --epochs 30
  if [ "$tag" != "full" ]; then
    run mix_N${tag}_s0 --train $SP/ir_train_N${tag}_s0.txt $SYN --epochs 30
    run ft_N${tag}_s0 --train $SP/ir_train_N${tag}_s0.txt --epochs ${EP[$tag]} \
        --model $B/runs/det/synth_T${tag}/weights/last.pt
  fi
  echo "$(date) T${tag}: done" >> $L/queue_synth.log
done
$PY $C/04_gap_metrics.py --tags T100 T1000 Tfull --n 1700 > $L/gap_metrics.log 2>&1 || echo "FAILED gap" >> $L/queue_synth.log
echo DONE > $L/queue_synth.done
