#!/usr/bin/env bash
# Runs translators sequentially after the N=100 run (already launched in tmux "tr100").
set -u
L=/workspace/bsa/logs
while tmux has-session -t tr100 2>/dev/null; do sleep 60; done
bash /workspace/bsa/code/scripts/02_train_translator.sh 1000 2501 > $L/translator_N1000.log 2>&1; echo EXIT=$? >> $L/translator_N1000.log
bash /workspace/bsa/code/scripts/02_train_translator.sh full 3001 > $L/translator_Nfull.log 2>&1; echo EXIT=$? >> $L/translator_Nfull.log
echo QUEUE_DONE > $L/queue_translators.done
