#!/usr/bin/env bash
# B17 recovery. Usage: bash resume_ext.sh stop   -> kill the extension queues (GPU lost, error 802)
#                      bash resume_ext.sh start  -> after the pod restart: resume everything that is missing.
# Everything is idempotent: 03/11 skip existing images, 05 skips runs whose JSON exists (JSON written at the end only).
L=/workspace/bsa/logs/ext
if [ "$1" = stop ]; then
  tmux kill-session -t ext 2>/dev/null; tmux kill-session -t ext2 2>/dev/null
  pkill -f 05_train_detector; pkill -f 12_box_metrics; pkill -f 13_ceiling_pedestrians; pkill -f 15_metric_correlation
  sleep 3; pgrep -fa "05_train|12_box|13_ceil" | grep -v pgrep | wc -l
  exit 0
fi
nvidia-smi --query-gpu=name,memory.used --format=csv,noheader || exit 1
/workspace/venv/bin/python -c "import torch; torch.zeros(1, device='cuda'); print('cuda ok')" || exit 1
mv $L/FAILED $L/FAILED.b17 2>/dev/null
rm -f $L/analysis.done $L/pl.done $L/plf.done
# sets / gen / pseudo-labels are complete (sets.done, gen.done kept); only trainings + analysis are redone.
# Lower parallelism than before (B17): 2 proxy trainings at a time.
sed -i 's/\[ \${#pids\[@\]} = 3 \]/[ ${#pids[@]} = 2 ]/' /workspace/bsa/code/scripts/queue_ext.sh
tmux new-session -d -s ext "ulimit -n 65536; bash /workspace/bsa/code/scripts/queue_ext.sh"
# ext2: labels already exist; skip the relabelling step (05 skips pl_P1000f if its JSON exists)
sed -i 's#^\$PY \$S/14_pseudo_labels.py --n 1000 --fused#[ -f $B/data/pl/P1000f/labels/train/$(ls $B/data/pl/P1000f/labels/train | head -n 1) ] || $PY $S/14_pseudo_labels.py --n 1000 --fused#' /workspace/bsa/code/scripts/queue_ext2.sh
tmux new-session -d -s ext2 "ulimit -n 65536; bash /workspace/bsa/code/scripts/queue_ext2.sh"
echo resumed
