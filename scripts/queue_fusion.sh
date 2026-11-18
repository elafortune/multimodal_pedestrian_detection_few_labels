#!/usr/bin/env bash
# Early fusion (5d): 4-channel YOLO11 trained on full LLVIP with static modality dropout, + ablation without dropout.
# Evaluated on every sensor scenario (data/fusion/<scenario>/images/test).
set -u
export YOLO_CONFIG_DIR=/workspace/bsa/.ultralytics
B=/workspace/bsa; PY=/workspace/venv/bin/python; C=$B/code/scripts; L=$B/logs/det
run() { local name=$1; shift; $PY $C/05_train_detector.py --name $name "$@" > $L/$name.log 2>&1 || echo "FAILED $name" >> $L/FAILED; }
# test scenarios that do not need a translator, now; ir_reconstructed once T1000 test synth exists
$PY $C/06_make_fusion_data.py --only test > $B/logs/fusion_data_test.log 2>&1
$PY $C/06_make_fusion_data.py --only train --nodrop > $B/logs/fusion_data_nodrop.log 2>&1
until [ -f $L/baselines.done ]; do sleep 60; done
until [ $(ls $B/data/synth/T1000/images/test 2>/dev/null | wc -l) -ge 3463 ]; do sleep 120; done
sleep 60; $PY $C/06_make_fusion_data.py --only test > $B/logs/fusion_data_test2.log 2>&1
EVALS="fusion:nominal fusion:rgb_fog fusion:rgb_lowlight fusion:rgb_dead fusion:ir_dead fusion:ir_reconstructed"
run early_fusion_drop   --train $B/data/fusion/train/images/train        --epochs 30 --channels 4 --eval $EVALS
run early_fusion_nodrop --train $B/data/fusion/train_nodrop/images/train --epochs 30 --channels 4 --eval $EVALS
echo DONE > $L/fusion.done
