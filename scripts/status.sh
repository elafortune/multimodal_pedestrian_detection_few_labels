#!/usr/bin/env bash
# Compact pod status (runs on the pod, so the local PC only holds one ssh process).
B=/workspace/bsa; L=$B/logs
date -u +"%H:%M UTC"; tmux ls 2>/dev/null | cut -d: -f1 | tr '\n' ' '; echo
nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader
tail -n 4 $L/recover.log 2>/dev/null
tr '\r' '\n' < $L/translator_N1000.log 2>/dev/null | grep -o "Steps: *[0-9]*%[^,]*, *[0-9.]*s/it" | tail -1
[ -f $L/det/FAILED ] && { echo "FAILED:"; cat $L/det/FAILED; }
ls -t $B/results/det | head -3 | tr '\n' ' '; echo
