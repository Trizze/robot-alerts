import { createPixelText } from './pixel-text.js';
// Checkpoint 2 proof: all layers use the same integer frame from one clock.
const canvas = document.querySelector('#stage');
const ctx = canvas.getContext('2d');
const scratch = document.createElement('canvas');
scratch.width = 1920; scratch.height = 720;
const mask = scratch.getContext('2d');
const chestMode = Boolean(document.querySelector('[data-chest-proof]'));
const rig = await (await fetch(chestMode ? 'rig-chest.json' : 'rig.json')).json();
const avatar = new Image(); avatar.src = '/avatars/14824099.png'; await avatar.decode();
const colorMode = Boolean(document.querySelector('[data-color-proof]'));
const useWebm = !colorMode && new URLSearchParams(location.search).get('format') === 'webm';
const selected = {};
document.querySelectorAll('[data-layer]').forEach(input => input.addEventListener('change', () => { selected[input.dataset.layer] = input.checked; window.proofRefresh?.(); }));
document.querySelectorAll('[data-all]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-layer]').forEach(input => { input.checked = button.dataset.all === 'on'; selected[input.dataset.layer] = input.checked; }); window.proofRefresh?.();
}));
const images = {}, colored = {}, videos = {}, chestImages = {}, chestMasks = {};
const chestTextCache = new Map();
function chestText(value) { if (!chestTextCache.has(value)) chestTextCache.set(value,createPixelText(value)); return chestTextCache.get(value); }
if (useWebm) {
  await Promise.all(rig.layers.map(async layer => {
    const blob = await (await fetch(`webm/${layer}.webm`)).blob();
    return new Promise((resolve, reject) => {
    const video = document.createElement('video'); video.muted = true; video.preload = 'auto';
    video.oncanplaythrough = () => resolve(); video.onerror = () => reject(new Error(`Cannot load ${layer} video`));
    video.src = URL.createObjectURL(blob); videos[layer] = video;
    });
  }));
} else {
  await Promise.all(rig.layers.flatMap(layer => rig.frames.map(async (frame, i) => {
    const item = frame.layers[layer]; if (!item) return;
    const image = new Image(); image.src = `frames/${layer}/${String(i + 1).padStart(4, '0')}.png`;
    await image.decode(); (images[layer] ||= [])[i] = image;
    if (colorMode) { const alt = new Image(); alt.src = `frames-colored/${layer}/${String(i + 1).padStart(4, '0')}.png`; await alt.decode(); (colored[layer] ||= [])[i] = alt; }
  })));
}
function paint(context, image, box) {
  if (useWebm) context.drawImage(image, box[0],box[1],box[2]-box[0],box[3]-box[1],box[0],box[1],box[2]-box[0],box[3]-box[1]);
  else context.drawImage(image,box[0],box[1]);
}
async function seekVideos(index) {
  const time=(index+0.5)/rig.fps;
  await Promise.all(Object.values(videos).map(video => new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime-time)<0.001 && video.readyState>=2) return resolve();
    video.onseeked = () => resolve(); video.onerror = () => reject(new Error('Video seek failed')); video.currentTime=time;
  })));
}
if (chestMode) {
  await Promise.all(rig.frames.flatMap((frame, i) => ['chest', 'display_mask'].map(async kind => {
    const bounds=frame.chestDisplay[kind+'Bounds']; if (!bounds) return;
    const image=new Image(); image.src=`frames-chest/${kind}/${String(i+1).padStart(4,'0')}.png`;
    await image.decode(); (kind==='chest' ? chestImages : chestMasks)[i]=image;
  })));
}
// Orthographic projection of the four screen corners is affine. Drawing once
// avoids the visible seam caused by two independently antialiased triangles.
function drawProjected(source,p) {
  const w=source.width, h=source.height;
  mask.save();
  mask.setTransform((p[1][0]-p[0][0])/w,(p[1][1]-p[0][1])/w,
    (p[3][0]-p[0][0])/h,(p[3][1]-p[0][1])/h,p[0][0],p[0][1]);
  mask.imageSmoothingEnabled=source===avatar; mask.drawImage(source,0,0); mask.restore();
}
function draw(index) {
  index = Math.max(0, Math.min(index, rig.frames.length - 1));
  const frame = rig.frames[index];
  const width = innerWidth * devicePixelRatio, height = innerHeight * devicePixelRatio;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height);
  const scale = Math.min(canvas.width / 1920, canvas.height / 1080);
  ctx.setTransform(scale,0,0,scale,(canvas.width-1920*scale)/2,(canvas.height-1080*scale)/2+180*scale);
  for (const layer of rig.layers) {
    const chest = chestMode && layer === 'chest';
    const box = chest ? frame.chestDisplay.chestBounds : frame.layers[layer];
    const image = chest ? chestImages[index] : useWebm ? videos[layer] : selected[layer] ? colored[layer]?.[index] : images[layer]?.[index];
    if (!box || !image) continue;
    if (layer !== 'screen') {
      paint(ctx,image,box);
      if (chest && frame.chestDisplay.visible && chestMasks[index]) {
        mask.setTransform(1,0,0,1,0,0);mask.globalCompositeOperation='source-over';mask.clearRect(0,0,1920,720);
        drawProjected(chestText(document.querySelector('#chest-event').value),frame.chestDisplay.corners);
        mask.globalCompositeOperation='destination-in';const mbox=frame.chestDisplay.display_maskBounds;
        mask.drawImage(chestMasks[index],mbox[0],mbox[1]);mask.globalCompositeOperation='source-over';ctx.drawImage(scratch,0,0);
      }
      continue;
    }
    if (!frame.screen.visible) continue;
    mask.setTransform(1,0,0,1,0,0); mask.globalCompositeOperation='source-over'; mask.clearRect(0,0,1920,720);
    drawProjected(avatar,frame.screen.corners);
    mask.globalCompositeOperation='destination-in'; paint(mask,image,box); mask.globalCompositeOperation='source-over';
    ctx.drawImage(scratch,0,0);
  }
  if (chestMode) {
    const detail=document.querySelector('#detail'), d=detail.getContext('2d');
    const r=frame.chestDisplay.corners; const cx=(r[0][0]+r[2][0])/2,cy=(r[0][1]+r[2][1])/2;
    const sw=180*scale,sh=128*scale;d.clearRect(0,0,detail.width,detail.height);
    d.imageSmoothingEnabled=false;d.drawImage(canvas,(canvas.width-1920*scale)/2+cx*scale-sw/2,(canvas.height-1080*scale)/2+180*scale+cy*scale-sh/2,sw,sh,0,0,detail.width,detail.height);
  }
}
// One timeline controls every layer. Pausing never leaves a pending animation loop.
const transport = document.createElement('div');
transport.className = 'preview-transport';
transport.setAttribute('role','group'); transport.setAttribute('aria-label','Animation playback');
transport.innerHTML = '<button type="button" data-rewind>Rewind</button><button type="button" data-play>Pause</button><input type="range" min="0" step="1" aria-label="Animation frame"><output></output>';
document.body.append(transport);
const rewindButton=transport.querySelector('[data-rewind]'), playButton=transport.querySelector('[data-play]');
const slider=transport.querySelector('input'), time=transport.querySelector('output');
const last=rig.frames.length-1; slider.max=String(last);
let current=0,playing=false,raf=0,start=0,startFrame=0,revision=0,queue=Promise.resolve();
function updateControls(){slider.value=String(current);time.textContent=`${(current/rig.fps).toFixed(2)} / ${(last/rig.fps).toFixed(2)} s`;playButton.textContent=playing?'Pause':'Play';}
function render(frame){
  current=Math.max(0,Math.min(last,Math.round(frame)));updateControls();const wanted=current, token=++revision;
  queue=queue.then(async()=>{if(token!==revision)return;if(useWebm)await seekVideos(wanted);if(token===revision)draw(wanted);});
  return queue;
}
function pause(){playing=false;cancelAnimationFrame(raf);revision++;render(current);}
function tick(now){
  if(!playing)return;
  const frame=Math.min(last,startFrame+Math.floor((now-start)*rig.fps/1000));
  if(frame!==current)render(frame);
  if(frame>=last){playing=false;updateControls();return;}
  raf=requestAnimationFrame(tick);
}
function play(){if(playing)return;if(current>=last)render(0);playing=true;startFrame=current;start=performance.now();updateControls();raf=requestAnimationFrame(tick);}
rewindButton.addEventListener('click',()=>{pause();render(0);});
playButton.addEventListener('click',()=>playing?pause():play());
slider.addEventListener('input',()=>{const target=Number(slider.value);pause();render(target);});
document.querySelector('#chest-event')?.addEventListener('change',()=>render(current));
window.addEventListener('resize',()=>render(current));
window.proofDraw=draw; window.proofPlay=play; window.proofPause=pause; window.proofSeek=render; window.proofRefresh=()=>render(current);
const still=new URLSearchParams(location.search).get('still');
await render(still===null?0:Number(still)||0);
window.proofReady=true;
if(still===null)play();
