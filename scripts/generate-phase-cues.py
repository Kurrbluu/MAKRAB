#!/usr/bin/env python3
"""Generate original, short phase cues without third-party samples."""
from array import array
import json
import math
from pathlib import Path
import random
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'public/audio/phase-cues'
RATE = 44100
TAU = math.tau


def stereo(duration):
    count = round(duration * RATE)
    return [array('d', [0.0]) * count, array('d', [0.0]) * count]


def mix(buffer, index, value, pan=0):
    if 0 <= index < len(buffer[0]):
        buffer[0][index] += value * math.sqrt((1-pan)/2)
        buffer[1][index] += value * math.sqrt((1+pan)/2)


def bell(buffer, start, frequency, strength, decay, pan=0, crystal=False):
    partials = [(1, 1), (2.02, .18), (2.76, .11), (4.13, .05)] if crystal else [(1, 1), (2.0, .22), (3.03, .055)]
    offset = round(start * RATE)
    for index in range(offset, len(buffer[0])):
        time = (index-offset)/RATE
        envelope = (1-math.exp(-time*230))*math.exp(-time/decay)
        value = sum(amplitude*math.sin(TAU*frequency*ratio*time)*math.exp(-time*ratio*.23) for ratio, amplitude in partials)
        mix(buffer, index, value*envelope*strength, pan)


def terawang():
    buffer = stereo(2.8)
    for start, frequency, level, pan in [(0, 880, .50, -.30), (.17, 1174.66, .38, .32), (.39, 1567.98, .25, -.12)]:
        bell(buffer, start, frequency, level, .85, pan, crystal=True)
        bell(buffer, start+.24, frequency, level*.15, .68, -pan, crystal=True)
        bell(buffer, start+.49, frequency, level*.065, .52, pan, crystal=True)
    return buffer


def discussion():
    buffer = stereo(1.65)
    bell(buffer, 0, 659.25, .62, .38, -.08)
    bell(buffer, .36, 659.25, .65, .48, .08)
    return buffer


def exchange():
    buffer = stereo(2.25)
    generator = random.Random(62026)
    low, slow = 0.0, 0.0
    for index in range(len(buffer[0])):
        time = index/RATE
        noise = generator.uniform(-1, 1)
        cutoff = 300+2400*min(time/.58, 1)**1.8
        alpha = 1-math.exp(-TAU*cutoff/RATE)
        low += alpha*(noise-low)
        slow += .014*(noise-slow)
        if time < .58:
            sweep = math.sin(math.pi*time/.58)**2
            mix(buffer, index, (low-slow)*sweep*.63, -.55+1.1*time/.58)
        impact = time-.56
        if impact >= 0:
            attack = 1-math.exp(-impact*500)
            bass = math.sin(TAU*(69*impact+75*.055*(1-math.exp(-impact/.055))))*math.exp(-impact/.23)
            metal = (math.sin(TAU*221*impact)+.24*math.sin(TAU*617*impact)+.12*math.sin(TAU*843*impact))*math.exp(-impact/.45)
            strike = noise*math.exp(-impact/.025)*.18
            mix(buffer, index, (bass*.64+metal*.25+strike)*attack)
    return buffer


def voiced_cue(buffer, filename, start):
    path = ROOT / 'audio' / filename
    if not path.exists():
        return buffer
    with wave.open(str(path), 'rb') as voice:
        assert voice.getsampwidth() == 2, 'Voice cues must use PCM16.'
        channels, rate = voice.getnchannels(), voice.getframerate()
        pcm = array('h', voice.readframes(voice.getnframes()))
    samples = [sum(pcm[index:index+channels])/(32767*channels) for index in range(0,len(pcm),channels)]
    count = round(len(samples)*RATE/rate)
    resampled = []
    for index in range(count):
        position = index*rate/RATE
        lower = min(int(position),len(samples)-1)
        upper = min(lower+1,len(samples)-1)
        resampled.append(samples[lower]+(samples[upper]-samples[lower])*(position-lower))
    duration = max(len(buffer[0])/RATE, start+count/RATE+.2)
    output = stereo(duration)
    effect_peak = max(abs(value) for channel in buffer for value in channel)
    voice_peak = max(abs(value) for value in resampled)
    for index in range(len(buffer[0])):
        time = index/RATE
        duck = min(1,max(0,(time-start+.07)/.07))*min(1,max(0,(start+count/RATE+.07-time)/.07))
        for channel in range(2):
            output[channel][index] = buffer[channel][index]*.5/effect_peak*(1-.78*duck)
    offset = round(start*RATE)
    for index,value in enumerate(resampled):
        mix(output,offset+index,value*.92/voice_peak)
    return output


def write(name, channels):
    count = len(channels[0])
    fade = round(RATE*.065)
    for index in range(count):
        gain = min(1, index/120, (count-index-1)/fade)
        for channel in channels:
            channel[index] *= gain
    peak = max(abs(sample) for channel in channels for sample in channel)
    scale = .71/peak
    pcm = array('h')
    energy = 0.0
    for index in range(count):
        for channel in channels:
            value = channel[index]*scale
            energy += value*value
            pcm.append(max(-32768, min(32767, round(value*32767))))
    target = DESTINATION / f'{name}.wav'
    with wave.open(str(target), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())
    return {'file':target.name, 'durationSeconds':count/RATE, 'sampleRate':RATE, 'channels':2,
            'peakDbFS':round(20*math.log10(.71), 2), 'rmsDbFS':round(20*math.log10(math.sqrt(energy/(count*2))), 2)}


DESTINATION.mkdir(parents=True, exist_ok=True)
effects = [('terawang',terawang(),'Fase Terawang.wav',.48),
           ('discussion',discussion(),'Fase Diskusi.wav',.58),
           ('exchange',exchange(),'Fase perpindahan.wav',.83)]
metadata = []
for name,effect,source,start in effects:
    write(name+'-effect',effect)
    cue = write(name,voiced_cue(effect,source,start))
    cue['voiceSource'] = source
    cue['voiceStartSeconds'] = start
    metadata.append(cue)
(DESTINATION / 'manifest.json').write_text(json.dumps({'originalSynthesis':True, 'cues':metadata}, indent=2)+'\n')
archive = ROOT / 'exports/Pindahkan-Aku-Plsss-Sound-Cues.zip'
archive.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for cue in metadata:
        bundle.write(DESTINATION / cue['file'], cue['file'])
print(json.dumps(metadata, indent=2))
print(f'Sound cue pack: {archive}')
