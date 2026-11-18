#!/usr/bin/env bash
# One-off: pre-generate the 4 not-yet-started checkpoints in parallel (03 skips existing images, so the
# queue lanes will find them done). Generation is CPU-bound per process (resize + JPEG on the main thread).
export HF_HOME=/workspace/hf
B=/workspace/bsa; PY=/workspace/venv/bin/python; S=$B/code/scripts; SP=$B/splits; L=$B/logs/ext; CK=$B/ckpt
g() { $PY $S/03_generate_ir.py --ckpt $2 --tag $1 --split train --list $SP/proxy_train3000.txt > $L/boost_$1.log 2>&1;
      $PY $S/03_generate_ir.py --ckpt $2 --tag $1 --split test --list $SP/test_halfB.txt >> $L/boost_$1.log 2>&1; }
g T100_s1001 $CK/translator_N100/checkpoints/model_1001.pkl &
g p2p $CK/p2p_N1000_bw10/G_2000.pt &
g T1000_s1501 $CK/translator_N1000/checkpoints/model_1501.pkl &
g T1000_s2001 $CK/translator_N1000/checkpoints/model_2001.pkl &
wait
