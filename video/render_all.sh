#!/usr/bin/env bash
# Full pipeline: silent render -> music -> voice-over mix -> loudness trim. (VO wavs come from make_vo.py)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
npx remotion render src/index.ts Main out/kirana-bol-silent.mp4 --codec=h264 --crf=18
bash make_music.sh 129.5
python mix_audio.py
mv out/kirana-bol.mp4 out/kirana-bol-hot.mp4
ffmpeg -v error -y -i out/kirana-bol-hot.mp4 -af "volume=-1dB,alimiter=limit=0.84:attack=3:release=60:level=false" -c:v copy -c:a aac -b:a 192k -movflags +faststart out/kirana-bol.mp4
rm out/kirana-bol-hot.mp4
echo "final: out/kirana-bol.mp4"
