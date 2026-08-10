#!/bin/bash

rsync -avh \
  --exclude='bachata/' \
  --exclude='*.converting.mp4' \
  -e "ssh -i ~/.ssh/id_ed25519_rsync" \
  /mnt/c/Users/Carlos/Documents/baile/ \
  root@82.223.103.205:/mnt/storage/media-library/videos/
