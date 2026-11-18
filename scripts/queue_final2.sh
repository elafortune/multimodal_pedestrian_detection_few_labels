#!/usr/bin/env bash
# Time budget (user leaves at 16:30): correlation on 11 sets instead of 15.
# Dropped: intermediate checkpoints T100_s501, T1000_s501, T1000_s1501, T1000_s2001 (near-duplicates of their neighbours).
# Replaces the proxy loop of queue_final.sh (its parent shell is stopped; running jobs are left alone).
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; SP=$B/splits; L=$B/logs/final
log() { echo "$(date +%H:%M) $*" >> $L/final.log; }
det() { local name=$1; shift; $PY $S/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
proxy_list() {
  case $1 in ir|rgb) D=$B/data/yolo/$1/images/train;; *) D=$B/data/synth/$1/images/train;; esac
  sed "s#.*#$D/&.jpg#" $SP/proxy_train3000.txt > $B/configs/proxy/$1.txt; echo $B/configs/proxy/$1.txt
}
log "switch to 11 sets"
# wait for the two proxies still running from queue_final.sh (gray, invgray)
while pgrep -f "name proxy_(gray|invgray) " >/dev/null; do sleep 20; done
pids=()
for s in vae512 T100_s1 T100_s1001 T100 T1000_s1001 T1000 p2p; do
  [ -f $B/results/det/proxy_$s.json ] && continue
  det proxy_$s --train $(proxy_list $s) --epochs 30 & pids+=($!)
  [ ${#pids[@]} = 2 ] && { wait ${pids[@]}; pids=(); log "proxies: $s done"; }
done
wait ${pids[@]}
while pgrep -f 12_box_metrics >/dev/null; do sleep 20; done
log "correlation (11 sets)"
$PY $S/15_metric_correlation.py > $L/correlation.log 2>&1 || echo "FAILED correlation" >> $L/FAILED
log "ALL DONE"; touch $L/final.done
