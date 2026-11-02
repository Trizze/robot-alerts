from pathlib import Path
import subprocess,json
root=Path(__file__).resolve().parents[1]
sources=root/'assets/third-party/kenney-interface-sounds'
tracks=[
 {'file':'drop_001.wav','at':0.12,'gain':0.3,'rate':0.8,'role':'Door descent'},
 {'file':'bong_001.wav','at':0.48,'gain':0.7,'rate':0.58,'role':'Door landing'},
 {'file':'open_001.wav','at':0.80,'gain':0.38,'rate':0.8,'role':'Door opening'},
 {'file':'glitch_001.wav','at':1.05,'gain':0.15,'rate':0.85,'role':'Robot motor start'},
]
for i,at in enumerate([1.22,1.46,1.70,1.94,2.18,2.42,2.66,2.88]):
 tracks.append({'file':'click_003.wav','at':at,'gain':0.26 if i<6 else 0.18,'rate':0.76 if i%2 else 0.9,'role':'Robot footstep'})
tracks.append({'file':'confirmation_002.wav','at':2.98,'gain':0.42,'rate':0.9,'role':'Alert card reveal'})
args=['ffmpeg','-hide_banner','-loglevel','error','-y']
filters=[]
for i,t in enumerate(tracks):
 args+=['-i',str(sources/t['file'])]
 filters.append(f'[{i}:a]asetrate=44100*{t["rate"]},aresample=48000,volume={t["gain"]},adelay={round(t["at"]*1000)}:all=1[t{i}]')
filters.append(''.join(f'[t{i}]' for i in range(len(tracks)))+f'amix=inputs={len(tracks)}:normalize=0,apad,atrim=duration=4.2,lowpass=f=6500,loudnorm=I=-20:TP=-2:LRA=7,aresample=48000,afade=t=out:st=3.9:d=0.3[out]')
args+=['-filter_complex',';'.join(filters),'-map','[out]','-ac','2','-c:a','pcm_s16le',str(root/'assets/audio/robot-arrival.wav')]
subprocess.run(args,check=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(root/'assets/audio/robot-arrival.wav'),'-c:a','libmp3lame','-b:a','96k',str(root/'website-staging/sounds/robot-arrival.mp3')],check=True)
(root/'assets/audio/robot-arrival-timeline.json').write_text(json.dumps({'duration':4.2,'sampleRate':48000,'clock':'seconds from sprite assets becoming ready','tracks':tracks},indent=2)+'\n')
