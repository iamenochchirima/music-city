"""Generate real, synthetic recordings without downloading copyrighted music."""
import argparse
import json
import pathlib
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--ffmpeg", default="ffmpeg")
parser.add_argument("--output", required=True)
args = parser.parse_args()
root = pathlib.Path(args.output)
root.mkdir(parents=True, exist_ok=True)
formats = [
    ("pcm16.wav", ["-c:a", "pcm_s16le"]),
    ("pcm24.wav", ["-c:a", "pcm_s24le"]),
    ("float.wav", ["-c:a", "pcm_f32le"]),
    ("rf64.wav", ["-c:a", "pcm_s16le", "-rf64", "always"]),
    ("cbr.mp3", ["-c:a", "libmp3lame", "-b:a", "192k"]),
    ("vbr.mp3", ["-c:a", "libmp3lame", "-q:a", "3"]),
    ("lossless.flac", ["-c:a", "flac"]),
    ("encoded.m4a", ["-c:a", "aac"]),
    ("encoded.aac", ["-c:a", "aac", "-f", "adts"]),
    ("vorbis.ogg", ["-c:a", "libvorbis"]),
]
for name, codec in formats:
    target = root / name
    subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
                    "-ar", "44100", "-ac", "2", *codec, str(target)], check=True)
    print(json.dumps({"file": name, "bytes": target.stat().st_size}))
