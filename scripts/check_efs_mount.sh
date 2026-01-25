#!/bin/bash
EFS_MOUNT="/mnt/efs"
LOCAL_FALLBACK="/home/ubuntu/gopang-local"

if ! mountpoint -q "$EFS_MOUNT"; then
    echo "[$(date)] EFS not mounted, using local fallback" >> /gopang/logs/efs_fallback.log
    mkdir -p "$LOCAL_FALLBACK"/{db,models,backups,uploads}
    ln -sfn "$LOCAL_FALLBACK" /gopang/data
else
    ln -sfn "$EFS_MOUNT" /gopang/data
fi
