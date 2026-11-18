#!/usr/bin/env bash
# Extensions (17/11 evening): metric validation, VAE ceiling, per-pedestrian analysis, pseudo-labels, GPU pipeline.
# Lanes run in parallel, at most ~5 light GPU jobs (no translator training -> far from the B8 OOM regime).
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; SP=$B/splits; L=$B/logs/ext; CK=$B/ckpt
mkdir -p $L $B/configs/proxy
log() { echo "$(date +%H:%M) $*" >> $L/ext.log; }
det() { local name=$1; shift; $PY $S/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }

lane_sets() {   # naive + VAE sets (writes the proxy / half-B lists first)
  log "sets: start"; $PY $S/11_make_proxy_sets.py > $L/sets.log 2>&1 || echo "FAILED sets" >> $L/FAILED; log "sets: done"; touch $L/sets.done
}
gen() {  # <tag> <ckpt>
  $PY $S/03_generate_ir.py --ckpt $2 --tag $1 --split train --list $SP/proxy_train3000.txt > $L/gen_$1.log 2>&1 &&
  $PY $S/03_generate_ir.py --ckpt $2 --tag $1 --split test --list $SP/test_halfB.txt >> $L/gen_$1.log 2>&1 || echo "FAILED gen $1" >> $L/FAILED
}
lane_gen() {
  until [ -f $SP/test_halfB.txt ]; do sleep 10; done
  log "gen: start"
  ( gen T100_s1 $CK/translator_N100/checkpoints/model_1.pkl; gen T100_s501 $CK/translator_N100/checkpoints/model_501.pkl
    gen T100_s1001 $CK/translator_N100/checkpoints/model_1001.pkl; gen p2p $CK/p2p_N1000_bw10/G_2000.pt ) &
  ( gen T1000_s501 $CK/translator_N1000/checkpoints/model_501.pkl; gen T1000_s1001 $CK/translator_N1000/checkpoints/model_1001.pkl
    gen T1000_s1501 $CK/translator_N1000/checkpoints/model_1501.pkl; gen T1000_s2001 $CK/translator_N1000/checkpoints/model_2001.pkl ) &
  wait; log "gen: done"; touch $L/gen.done
}
lane_pl() {
  log "pl: labelling"; $PY $S/14_pseudo_labels.py --n 1000 100 > $L/pl.log 2>&1 || { echo "FAILED pl" >> $L/FAILED; return; }
  log "pl: pretrain"
  det pl_P1000 --train $B/data/pl/P1000/images/train --epochs 40 &
  det pl_P100 --train $B/data/pl/P100/images/train --epochs 100 &
  wait
  det pl_P1000_fromRGB --train $B/data/pl/P1000/images/train --epochs 40 --model $B/runs/det/rgb_full/weights/last.pt
  log "pl: fine-tunes"
  for tag in PL PL100 RGBPL; do
    case $tag in PL) W=$B/runs/det/pl_P1000/weights/last.pt;; PL100) W=$B/runs/det/pl_P100/weights/last.pt;; RGBPL) W=$B/runs/det/pl_P1000_fromRGB/weights/last.pt;; esac
    for s in 0 1; do for n in 10 25 50 100; do
      det ft_N${n}_s${s}_${tag} --train $SP/ir_train_N${n}_s${s}.txt --epochs 100 --seed $s --model $W &
      [ $n = 25 ] || [ $n = 100 ] && wait
    done; done
  done
  wait; log "pl: done"; touch $L/pl.done
}
proxy_list() {  # <set> -> txt of train image paths (same 3000 frames, same boxes for every set)
  case $1 in ir|rgb) D=$B/data/yolo/$1/images/train;; *) D=$B/data/synth/$1/images/train;; esac
  sed "s#.*#$D/&.jpg#" $SP/proxy_train3000.txt > $B/configs/proxy/$1.txt; echo $B/configs/proxy/$1.txt
}
SETS="ir rgb gray invgray vae512 T100_s1 T100_s501 T100_s1001 T100 T1000_s501 T1000_s1001 T1000_s1501 T1000_s2001 T1000 p2p"
lane_analysis() {
  until [ -f $L/sets.done ] && [ -f $L/gen.done ]; do sleep 30; done
  log "analysis: box metrics + ceiling/pedestrians + proxies"
  ( $PY $S/12_box_metrics.py --sets $SETS > $L/boxmetrics.log 2>&1 || echo "FAILED boxmetrics" >> $L/FAILED ) &
  A1=$!
  ( $PY $S/13_ceiling_pedestrians.py > $L/ceiling.log 2>&1 || echo "FAILED ceiling" >> $L/FAILED ) &
  A2=$!
  pids=()
  for s in $SETS; do
    det proxy_$s --train $(proxy_list $s) --epochs 30 & pids+=($!)
    [ ${#pids[@]} = 3 ] && { wait ${pids[@]}; pids=(); }   # 3 trainings at a time (not waiting on A1/A2)
  done
  wait ${pids[@]} $A1 $A2; log "analysis: correlation"
  $PY $S/15_metric_correlation.py > $L/correlation.log 2>&1 || echo "FAILED correlation" >> $L/FAILED
  touch $L/analysis.done
}

lane_sets & lane_gen & lane_pl & lane_analysis &
wait
# 16_gpu_pipeline.py is run separately, alone on the GPU (latency must not be measured under load)
log "ALL DONE"; touch $L/ext.done
