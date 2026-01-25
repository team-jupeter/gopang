#!/bin/bash
LOG_FILE="/gopang/logs/memory_$(date +%Y%m%d).log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
MEM_INFO=$(free -m | awk 'NR==2{printf "RAM: %s/%sMB (%.1f%%) ", $3, $2, $3*100/$2}')
SWAP_INFO=$(free -m | awk 'NR==3{printf "SWAP: %s/%sMB (%.1f%%)", $3, $2, ($2>0)?$3*100/$2:0}')
echo "[$TIMESTAMP] $MEM_INFO $SWAP_INFO" >> $LOG_FILE
