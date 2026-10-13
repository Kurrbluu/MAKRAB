#!/usr/bin/env python3
"""Original roulette audio, timed to the application's motion and result reveal."""
from array import array
import json
import math
from pathlib import Path
import random
import re
import shutil
import wave

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'public/audio/randomizer'
RATE = 44100
TAU = math.tau
MOTION = (ROOT / 'src/lib/exchangePresentation.ts').read_text()


def seconds(name):
    return int(re.search(r'\b' + name + r':\s*(\d+)', MOTION).group(1)) / 1000


SPIN = seconds('spinDurationMs')
LAUNCH = seconds('launchDelayMs')
GAP = seconds('revealGapMs')


def stereo(duration):
    return [array('d', [0.0]) * round(duration * RATE) for _ in range(2)]


def mix(buffer, index, value, pan=0):
    if 0 <= index < len(buffer[0]):
        buffer[0][index] += value * math.sqrt((1-pan)/2)
        buffer[1][index] += value * math.sqrt((1+pan)/2)


def progress(time):
    return time**3 * (time * (6*time - 15) + 10)


def crossing(position):
    low, high = 0.0, 1.0
    for _ in range(40):
        middle = (low+high)/2
        if progress(middle) < position:
            low = middle
        else:
            high = middle
    return (low+high)/2 * SPIN


def click(buffer, start, level, seed, pan):
    noise = random.Random(seed)
    offset = round(start * RATE)
    low = 0.0
    frequency = 1250 + noise.random()*240
    for index in range(round(.065 * RATE)):
        time = index/RATE
        low += .26*(noise.uniform(-1, 1)-low)
        attack = 1-math.exp(-time*1500)
        body = math.sin(TAU*frequency*time)*math.exp(-time/.007)
        knock = math.sin(TAU*410*time)*math.exp(-time/.012)
        value = (body*.32 + knock*.30 + low*.65)*attack*math.exp(-time/.021)
        mix(buffer, offset+index, value*level, pan)


def bell(buffer, start, frequency, level, decay, pan=0):
    offset = round(start * RATE)
    for index in range(offset, len(buffer[0])):
        time = (index-offset)/RATE
        value = sum(amplitude*math.sin(TAU*frequency*ratio*time)*math.exp(-time*ratio*.3)
                    for ratio, amplitude in [(1, 1), (2.01, .22), (2.77, .08), (4.15, .045)])
        mix(buffer, index, value*level*(1-math.exp(-time*550))*math.exp(-time/decay), pan)


def spin():
    buffer = stereo(SPIN)
    # Two revolutions: a restrained wooden click at every other bezel marker.
    ticks = [crossing((index+.5)/48) for index in range(48)]
    for index, start in enumerate(ticks):
        click(buffer, start, .65+.14*math.sin(index*.8), 881+index, .13*math.sin(index*.5))
    noise = random.Random(882)
    low, slow, phase = 0.0, 0.0, 0.0
    for index in range(len(buffer[0])):
        time = index/RATE
        fraction = time/SPIN
        speed = 16*fraction**2*(1-fraction)**2
        value = noise.uniform(-1, 1)
        low += .09*(value-low)
        slow += .018*(value-slow)
        phase += TAU*(90+22*speed)/RATE
        bed = (low-slow)*.10 + math.sin(phase)*.016
        mix(buffer, index, bed*speed, .15*math.sin(time*1.3))
    return buffer, ticks


def result():
    buffer = stereo(.42)
    click(buffer, 0, .55, 903, 0)
    bell(buffer, .014, 587.33, .30, .095)
    bell(buffer, .029, 880, .09, .08, .15)
    return buffer


def complete():
    buffer = stereo(1.40)
    click(buffer, 0, .55, 903, 0)
    bell(buffer, .014, 587.33, .30, .095)
    # A soft bronze seal for the last result, distinct from the phase voice cues.
    bell(buffer, .08, 146.83, .40, .35)
    bell(buffer, .08, 293.66, .16, .32, -.12)
    bell(buffer, .12, 440, .09, .28, .12)
    return buffer


def normalize(buffer, peak):
    fade = round(.035*RATE)
    count = len(buffer[0])
    for index in range(count):
        gain = min(1, index/70, (count-index-1)/fade)
        for channel in buffer:
            channel[index] *= gain
    scale = peak/max(abs(value) for channel in buffer for value in channel)
    for channel in buffer:
        for index in range(count):
            channel[index] *= scale
    return buffer


def write(name, buffer):
    pcm = array('h')
    for index in range(len(buffer[0])):
        for channel in buffer:
            pcm.append(round(channel[index]*32767))
    path = DESTINATION / f'{name}.wav'
    with wave.open(str(path), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())
    peak = max(abs(value) for channel in buffer for value in channel)
    return {'file': path.name, 'durationSeconds': len(buffer[0])/RATE,
            'peakDbFS': round(20*math.log10(peak), 2)}


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    spinning, ticks = spin()
    parts = {'randomizer-spin': normalize(spinning, .38),
             'randomizer-result': normalize(result(), .54),
             'randomizer-complete': normalize(complete(), .64)}
    ends_at = LAUNCH+SPIN+3*GAP+len(parts['randomizer-complete'][0])/RATE
    preview = stereo(ends_at)
    sequence = [(LAUNCH, 'randomizer-spin')]
    sequence += [(LAUNCH+SPIN+rank*GAP, 'randomizer-result' if rank < 3 else 'randomizer-complete') for rank in range(4)]
    for start, name in sequence:
        offset = round(start*RATE)
        for channel in range(2):
            for index, value in enumerate(parts[name][channel]):
                preview[channel][offset+index] += value
    parts['randomizer'] = preview
    metadata = {'originalSynthesis': True, 'spinDurationSeconds': SPIN, 'launchDelaySeconds': LAUNCH,
                'revealGapSeconds': GAP, 'spinTickSeconds': ticks,
                'resultSeconds': [LAUNCH+SPIN+rank*GAP for rank in range(4)],
                'cues': [write(name, buffer) for name, buffer in parts.items()]}
    (DESTINATION / 'manifest.json').write_text(json.dumps(metadata, indent=2)+'\n')
    export = ROOT / 'exports/Pindahkan-Aku-Plsss-Randomizer.wav'
    export.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(DESTINATION / 'randomizer.wav', export)
    print(json.dumps({key: value for key, value in metadata.items() if key != 'spinTickSeconds'}, indent=2))
    print(f'Randomizer sound: {export}')


if __name__ == '__main__':
    main()
