#!/usr/bin/env python3
"""Rebuild the tutorial voice track from its recorded chapter cues."""
import argparse
import json
import subprocess
import tempfile
import wave
from array import array
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--wav-only', type=Path, help='Write a WAV for inspection without encoding AAC.')
args = parser.parse_args()
info = json.loads((root / 'audio/narration-sync.json').read_text())
with wave.open(str(root / info['source']), 'rb') as recording:
    rate, width, channels = recording.getframerate(), recording.getsampwidth(), recording.getnchannels()
    audio = recording.readframes(recording.getnframes())
assert width == 2 and channels == 1, 'The source recording must be mono PCM16.'

def position(milliseconds):
    return round(milliseconds * rate / 1000) * width

correction = info.get('correction')
if correction:
    start, end = correction['replacementSourceMs']
    replacement = audio[position(start):position(end)] + bytes(position(correction.get('replacementPadMs', 0)))
    values = array('h')
    values.frombytes(replacement)
    gain, fade = correction['gain'], round(rate * correction['fadeMs'] / 1000)
    for index in range(len(values)):
        factor = min(1, index / fade, (len(values) - index - 1) / fade) if fade else 1
        values[index] = max(-32768, min(32767, round(values[index] * gain * factor)))
    replacement = values.tobytes()
    start, end = correction['replacedIntervalMs']
    assert len(replacement) == position(end) - position(start), 'A word correction must preserve timing.'
    audio = audio[:position(start)] + replacement + audio[position(end):]

output = bytearray()
for cue in info['chapters']:
    assert position(cue['videoStartMs']) == len(output), 'Chapter cues must be contiguous.'
    chunk = audio[position(cue['sourceStartMs']):position(cue['sourceEndMs'])] if cue['sourceStartMs'] is not None else b''
    duration = position(cue['durationMs'])
    assert len(chunk) <= duration, 'A chapter must never truncate its narration.'
    output.extend(chunk)
    output.extend(bytes(duration - len(chunk)))
assert len(output) == position(info['durationMs'])

def write_wav(path):
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(width)
        wav.setframerate(rate)
        wav.writeframes(output)

if args.wav_only:
    write_wav(args.wav_only)
else:
    with tempfile.TemporaryDirectory(prefix='pindahkan-narration-') as directory:
        intermediate = Path(directory) / 'narration.wav'
        write_wav(intermediate)
        subprocess.run(['afconvert', str(intermediate), '-f', 'm4af', '-d', 'aac@48000', '-b', '64000',
                        str(root / 'tutorial-demo' / info['asset'])], check=True)
print(f"Narration rebuilt: {info['durationMs'] / 1000:.2f}s")
