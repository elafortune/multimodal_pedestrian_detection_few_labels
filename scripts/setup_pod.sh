#!/usr/bin/env bash
# Rebuild the working environment on a fresh pod (B17: the A100 host is down, its pod disk unreachable).
# Same versions as the first pod (doc/bugs.md B1, B6): venv on top of the image's torch 2.8, TensorRT 10.
set -u
B=/workspace/bsa; mkdir -p $B/{code,data,logs,weights,results,splits,configs} && cd $B
log() { echo "$(date +%H:%M) $*" >> $B/logs/setup.log; }
log "venv"
python3 -m venv --system-site-packages /workspace/venv
P=/workspace/venv/bin/pip
$P install -q "ultralytics==8.3.253" clean-fid prdc umap-learn ensemble-boxes onnx onnxslim onnxruntime-gpu \
  "tensorrt-cu12>=10.0,<11" "diffusers==0.32.2" transformers accelerate gdown huggingface_hub lpips torchmetrics \
  scikit-learn scipy > $B/logs/pip.log 2>&1 && log "pip ok" || log "pip FAILED"
log "LLVIP download"
cd $B/data && /workspace/venv/bin/gdown 1VTlT3Y7e1h-Zsne4zahjx5q0TK2ClMVv -O LLVIP.zip > $B/logs/dl.log 2>&1 && log "dl ok" || log "dl FAILED"
unzip -q LLVIP.zip && rm -f LLVIP.zip && log "unzip ok"
touch $B/logs/setup.done
