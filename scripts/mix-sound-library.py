"""Rebuild four bundled CC0 sound choices with installed ffmpeg; no network."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/third-party/kenney-interface-sounds'
# file, start seconds, gain, playback-rate multiplier
VARIANTS = {
    'arcade-win': (1.8, -20, 6500, [
        ('confirmation_002.wav', 0.0, .45, 1.0),
        ('confirmation_002.wav', .30, .35, 1.25),
        ('confirmation_002.wav', .60, .40, 1.5),
    ]),
    'soft-chime': (1.6, -23, 2500, [
        ('open_001.wav', 0.0, .18, .70),
        ('confirmation_002.wav', .12, .40, .78),
    ]),
    'power-up': (1.8, -20, 6000, [
        ('maximize_001.wav', 0.0, .40, .8),
        ('maximize_001.wav', .18, .30, 1.05),
        ('confirmation_002.wav', .45, .38, 1.15),
    ]),
    'glitch-pop': (1.4, -21, 5500, [
        ('glitch_001.wav', .02, .30, 1.0),
        ('glitch_001.wav', .14, .23, .75),
        ('click_003.wav', .28, .25, .8),
        ('confirmation_002.wav', .34, .30, 1.30),
    ]),
}
for name, (duration, loudness, cutoff, tracks) in VARIANTS.items():
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
    filters = []
    for i, (filename, start, gain, rate) in enumerate(tracks):
        command += ['-i', str(SOURCE / filename)]
        filters.append(f'[{i}:a]asetrate=44100*{rate},aresample=48000,volume={gain},adelay={round(start*1000)}:all=1[t{i}]')
    filters.append(''.join(f'[t{i}]' for i in range(len(tracks))) +
                   f'amix=inputs={len(tracks)}:normalize=0,apad,atrim=duration={duration},lowpass=f={cutoff},loudnorm=I={loudness}:TP=-2:LRA=7,aresample=48000,afade=t=out:st={duration-.25}:d=0.25[out]')
    wav = ROOT / 'assets/audio' / (name + '.wav')
    mp3 = ROOT / 'website-staging/sounds' / (name + '.mp3')
    subprocess.run(command + ['-filter_complex', ';'.join(filters), '-map', '[out]', '-ac', '2', '-c:a', 'pcm_s16le', str(wav)], check=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '96k', str(mp3)], check=True)
    (ROOT / 'assets/audio' / (name + '-timeline.json')).write_text(json.dumps({'duration': duration, 'loudnessTarget': loudness, 'tracks': tracks}, indent=2) + '\n')
    print(name, mp3.stat().st_size, 'bytes')
