#!/usr/bin/env bash
set -u
B=/workspace/bsa; PY=/workspace/venv/bin/python; L=$B/logs
for cfg in "100 10" "100 1" "1000 10"; do set -- $cfg
  $PY $B/code/scripts/02b_train_pix2pix.py --n $1 --box_weight $2 --steps 6000 > $L/p2p_N$1_bw$2.log 2>&1 || echo "FAILED p2p $cfg" >> $L/p2p.failed
done
echo DONE > $L/p2p.done
