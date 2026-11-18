#!/usr/bin/env bash
# Recovery after B8 (translator N1000/full OOM under GPU contention, 17/11 ~8h UTC).
# At most 2 GPU jobs at a time: queue A (translator + T1000 chain) and queue B (detectors, fusion, eval).
# Tfull (oracle) is dropped for time. Usage: bash queue_recover.sh A | B
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf WANDB_MODE=offline
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
B=/workspace/bsa; PY=/workspace/venv/bin/python; C=$B/code/scripts; L=$B/logs; SP=$B/splits
DET=$C/05_train_detector.py; mkdir -p $L/det
run() { local name=$1; shift; $PY $DET --name $name "$@" > $L/det/$name.log 2>&1 || echo "FAILED $name" >> $L/det/FAILED; }
say() { echo "$(date -u +%H:%M) $*" >> $L/recover.log; }

if [ "$1" = A ]; then
  say "A: translator N1000 start"
  mv $L/translator_N1000.log $L/translator_N1000.oom.log 2>/dev/null
  rm -rf $B/ckpt/translator_N1000
  bash $C/02_train_translator.sh 1000 2501 > $L/translator_N1000.log 2>&1; echo "EXIT=$?" >> $L/translator_N1000.log
  CK=$(ls $B/ckpt/translator_N1000/checkpoints/model_*.pkl | sort -V | tail -1); say "A: using $CK"
  for split in test train; do
    $PY $C/03_generate_ir.py --ckpt $CK --tag T1000 --split $split --batch 16 > $L/gen_T1000_${split}.log 2>&1 || say "FAILED gen $split"
  done
  SYN=$B/data/synth/T1000/images/train
  run synth_T1000 --train $SYN --epochs 30
  for n in 10 25 50 100; do
    run ft_N${n}_s0_T1000 --train $SP/ir_train_N${n}_s0.txt --epochs 100 --model $B/runs/det/synth_T1000/weights/last.pt
  done
  run ft_N1000_s0 --train $SP/ir_train_N1000_s0.txt --epochs 40 --model $B/runs/det/synth_T1000/weights/last.pt
  run mix_N1000_s0 --train $SP/ir_train_N1000_s0.txt $SYN --epochs 30
  $PY $C/04_gap_metrics.py --tags T100 T1000 --n 1700 > $L/gap_metrics.log 2>&1 || say "FAILED gap"
  say "A: done"; echo DONE > $L/recover_A.done
fi

if [ "$1" = B ]; then
  say "B: seed-1 replicates (T100)"
  for n in 10 25 50 100; do
    run ft_N${n}_s1_T100 --train $SP/ir_train_N${n}_s1.txt --epochs 100 --seed 1 --model $B/runs/det/synth_T100/weights/last.pt
  done
  # early fusion: ir_reconstructed is scored later by 07_multimodal (same evaluator for every row)
  EVALS="fusion:nominal fusion:rgb_fog fusion:rgb_lowlight fusion:rgb_dead fusion:ir_dead"
  say "B: early fusion"
  run early_fusion_drop   --train $B/data/fusion/train/images/train        --epochs 30 --channels 4 --eval $EVALS
  run early_fusion_nodrop --train $B/data/fusion/train_nodrop/images/train --epochs 30 --channels 4 --eval $EVALS
  until [ $(ls $B/data/synth/T1000/images/test 2>/dev/null | wc -l) -ge 3463 ] && grep -q "^done" $L/gen_T1000_test.log 2>/dev/null; do sleep 120; done
  $PY $C/06_make_fusion_data.py --only test --rec_tag T1000 > $L/fusion_data_test2.log 2>&1 || say "FAILED fusion test2"
  say "B: multimodal eval"
  $PY $C/07_multimodal.py > $L/multimodal.log 2>&1 || say "FAILED multimodal"
  say "B: TensorRT bench"
  CK=$(ls $B/ckpt/translator_N1000/checkpoints/model_*.pkl | sort -V | tail -1)
  $PY $C/08_export_trt.py --name ir_full --translator $CK > $L/trt.log 2>&1 || say "FAILED trt"
  until [ -f $L/recover_A.done ]; do sleep 120; done
  $PY $C/10_figures.py > $L/figures.log 2>&1 || say "FAILED figures"
  say "B: done"; echo DONE > $L/recover_B.done
fi
