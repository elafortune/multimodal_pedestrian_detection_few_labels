#!/usr/bin/env bash
# S2 - Train pix2pix-turbo RGB->IR on the N pairs of one scenario.
# Usage: 02_train_translator.sh <N tag: 100|1000|full> <max_steps (use k*500+1)> [batch]
# A checkpoint is written every 500 steps (at step 1, 501, 1001, ...).
set -euo pipefail
TAG=$1; STEPS=$2; BS=${3:-4}
export HF_HOME=/workspace/hf WANDB_MODE=offline WANDB_DIR=/workspace/bsa/logs
cd /workspace/bsa/img2img-turbo
/workspace/venv/bin/accelerate launch --mixed_precision=bf16 --num_processes=1 src/train_pix2pix_turbo.py \
  --pretrained_model_name_or_path=stabilityai/sd-turbo \
  --output_dir=/workspace/bsa/ckpt/translator_N${TAG} \
  --dataset_folder=/workspace/bsa/data/p2p/N${TAG} \
  --resolution=512 --train_batch_size=${BS} \
  --num_training_epochs=1000 --max_train_steps=${STEPS} \
  --checkpointing_steps=500 --eval_freq=500 --viz_freq=500 \
  --learning_rate=1e-5 --mixed_precision=bf16 --allow_tf32 \
  --train_image_prep=resize_512x512 --test_image_prep=resize_512x512 \
  --dataloader_num_workers=8 --seed=0 \
  --report_to=wandb --tracker_project_name=translator_N${TAG}
echo "TRAIN_DONE N${TAG}"
