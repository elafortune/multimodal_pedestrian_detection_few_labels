#!/usr/bin/env bash
# B20 (3): 12_box_metrics died with the old queue_final.sh loop at 10:17 UTC (8/15 sets). Finish the 4 missing sets
# of the 11-set study (metrics.json is merged, not overwritten), then redo the correlation.
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics HF_HOME=/workspace/hf PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; L=$B/logs/final
cd $B
echo "$(date +%H:%M) box metrics rest" >> $L/final.log
$PY $S/12_box_metrics.py --sets T100 T1000_s1001 T1000 p2p > $L/boxmetrics_rest.log 2>&1 || echo "FAILED boxmetrics_rest" >> $L/FAILED
$PY $S/15_metric_correlation.py > $L/correlation.log 2>&1 || echo "FAILED correlation2" >> $L/FAILED
echo "$(date +%H:%M) ALL DONE 2" >> $L/final.log; touch $L/final2.done
