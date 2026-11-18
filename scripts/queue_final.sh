#!/usr/bin/env bash
# Final run on the recovered A100 (after B17/B18): only what is still missing.
# Pseudo-label fine-tunes were completed on the H100 (results/h100) -> not redone here.
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; SP=$B/splits; L=$B/logs/final
mkdir -p $L $B/configs/proxy
log() { echo "$(date +%H:%M) $*" >> $L/final.log; }
det() { local name=$1; shift; $PY $S/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
proxy_list() {
  case $1 in ir|rgb) D=$B/data/yolo/$1/images/train;; *) D=$B/data/synth/$1/images/train;; esac
  sed "s#.*#$D/&.jpg#" $SP/proxy_train3000.txt > $B/configs/proxy/$1.txt; echo $B/configs/proxy/$1.txt
}
SETS="ir rgb gray invgray vae512 T100_s1 T100_s501 T100_s1001 T100 T1000_s501 T1000_s1001 T1000_s1501 T1000_s2001 T1000 p2p"
log "start: box metrics + ceiling/pedestrians + proxies"
( $PY $S/12_box_metrics.py --sets $SETS > $L/boxmetrics.log 2>&1 || echo "FAILED boxmetrics" >> $L/FAILED; log "box metrics done" ) & A1=$!
( $PY $S/13_ceiling_pedestrians.py > $L/ceiling.log 2>&1 || echo "FAILED ceiling" >> $L/FAILED; log "ceiling done" ) & A2=$!
pids=()
for s in $SETS; do
  det proxy_$s --train $(proxy_list $s) --epochs 30 & pids+=($!)
  [ ${#pids[@]} = 2 ] && { wait ${pids[@]}; pids=(); log "proxies: $s done"; }
done
wait ${pids[@]} $A1 $A2
log "correlation"
$PY $S/15_metric_correlation.py > $L/correlation.log 2>&1 || echo "FAILED correlation" >> $L/FAILED
log "ALL DONE"; touch $L/final.done
