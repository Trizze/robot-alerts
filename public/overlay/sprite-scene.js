import { placeAlertPanel } from '/shared/alert-layout.js';
import { RaidStream } from '/shared/raid-stream.js';
import { motionReady, motionFrame, drawRobot, avatarFor } from './sprite-renderer.js';
const RUN_SECONDS=54/30, OUT_SECONDS=37/30, DOOR_LEAD=1.15, DOOR_CLOSE=.75;
export class SpriteScene {
 constructor(stage,card,alert,onDone,onError){
  Object.assign(this,{stage,card,alert,onDone,onError});this.started=performance.now()-Math.max(0,Date.now()-alert.startedAt);this.entries=new Map();this.world=new RaidStream();this.done=false;this.stopped=false;
  this.root=document.createElement('section');this.root.className=`cinematic-scene rendered-alert ${alert.settings.theme==='gaming'?'gaming':'default'}`;this.root.dataset.event=alert.type;
  this.canvas=document.createElement('canvas');this.canvas.width=1920;this.canvas.height=1080;this.canvas.className='rendered-robots';this.ctx=this.canvas.getContext('2d');
  this.panel=document.createElement('div');this.panel.className='scene-card';placeAlertPanel(this.panel);this.alertScale=.5*(Number.isFinite(alert.settings.scale)?alert.settings.scale:1);this.groupX=960-1312.25*this.alertScale;this.groupY=540-556*this.alertScale;Object.assign(this.panel.style,{left:`${this.groupX+1050*this.alertScale}px`,top:`${this.groupY+412.25*this.alertScale}px`,transform:`scale(${this.alertScale*1.25})`,transformOrigin:'top left'});this.panel.append(card);this.root.append(this.canvas,this.panel);stage.append(this.root);
  const src=alert.settings.customMedia?.[alert.type];
  if(alert.animation==='custom'&&/^\/media\/[a-f0-9-]{36}\.(?:png|jpg|gif|webp|mp4|webm)$/i.test(src||'')){
   this.media=document.createElement(/\.(?:mp4|webm)$/i.test(src)?'video':'img');this.media.className='custom-media';Object.assign(this.media.style,{left:`${this.groupX+1050*this.alertScale}px`,top:`${this.groupY+35*this.alertScale}px`,transform:`scale(${this.alertScale})`,transformOrigin:'top left'});this.media.src=src;
   if(this.media.tagName==='VIDEO'){this.media.loop=true;this.media.playsInline=true;this.media.preload='auto';}this.root.append(this.media);
  }
  for(const e of alert.raiders||[])this.join(e);
  if(alert.demo)for(const [i,viewer] of (alert.demoRaidChatters||[]).entries())this.join({viewer,at:.2+i*.95,sequence:i});
  avatarFor(alert.viewer);for(const viewer of alert.participants||[])avatarFor(viewer);
  motionReady.then(atlas=>{if(this.stopped)return;this.atlas=atlas;this.tick();}).catch(error=>{if(!this.stopped)onError?.(error)});
 }
 setViewer(viewer){this.alert.viewer=viewer;avatarFor(viewer);}
 join(entry){if(!entry?.viewer?.id)return;const old=this.entries.get(entry.sequence);this.entries.set(entry.sequence,{...entry,at:entry.at??old?.at,spawned:old?.spawned||false});avatarFor(entry.viewer);}
 drawActor(viewer,age,hold,scale=1,x=0,y=0){
  const pose=motionFrame(this.atlas,age,hold);if(!pose||age<0)return;this.ctx.save();this.ctx.translate(x,y+(1080-this.atlas.rig.height)*scale/2);this.ctx.scale(scale,scale);drawRobot(this.ctx,this.atlas,...pose,viewer,this.alert);this.ctx.restore();
 }
 drawDoor(time,closeAt){
  if(time<0||time>=closeAt+DOOR_CLOSE+.25)return;
  const opening=Math.max(0,Math.min(1,(time-.45)/.7));
  const closing=Math.max(0,Math.min(1,(time-closeAt)/DOOR_CLOSE));
  const index=Math.max(0,Math.min(30,Math.round(30*(time<closeAt?opening:1-closing))));
  const drop=time<.45?(-720*Math.pow(1-time/.45,2)):0;
  const alpha=Math.min(1,time/.15)*Math.max(0,Math.min(1,(closeAt+DOOR_CLOSE+.25-time)/.25));
  this.ctx.save();this.ctx.globalAlpha=alpha;
  this.ctx.drawImage(this.atlas.images.door,(index%8)*189,Math.floor(index/8)*416,189,416,64,97+drop,321.3,707.2);
  this.ctx.restore();
  const dustTime=time-.45;
  if(dustTime>=0&&dustTime<1){const i=Math.min(24,Math.floor(dustTime*25));this.ctx.save();this.ctx.globalAlpha=.3*(1-dustTime);this.ctx.drawImage(this.atlas.images.dust,(i%5)*268,Math.floor(i/5)*74,268,74,-81.5,676.5,402,111);this.ctx.restore();}
 }
 drawDoorFront(time,closeAt){
  if(time<0||time>=closeAt+DOOR_CLOSE+.25)return;
  const drop=time<.45?(-720*Math.pow(1-time/.45,2)):0;
  const alpha=Math.min(1,time/.15)*Math.max(0,Math.min(1,(closeAt+DOOR_CLOSE+.25-time)/.25));
  this.ctx.save();this.ctx.globalAlpha=alpha;this.ctx.drawImage(this.atlas.images.doorFront,86.1,97+drop,71.4,707.2);this.ctx.restore();
 }
 drawCrowd(time){
  for(const entry of this.entries.values())if(!entry.spawned&&entry.viewer.avatar&&Number.isFinite(entry.at)){entry.spawned=this.world.add(entry.viewer,entry.at,entry.sequence);}
  this.world.advance(time);
  if(!this.crowdBuffer){this.crowdBuffer=document.createElement('canvas');this.crowdBuffer.width=1920;this.crowdBuffer.height=this.atlas.rig.height;this.crowdCtx=this.crowdBuffer.getContext('2d');}
  const ctx=this.ctx,rig=this.atlas.rig,frames=rig.clips['run-in'].frames,scale=Math.max(.23,Math.min(.32,.32-Math.log10(Math.max(1,this.alert.raidSize||1))*.015));
  for(const actor of this.world.actors){
   const index=41+Math.floor(actor.age*30)%19,frame=frames[index],torso=frame.layers.torso;if(!torso)continue;
   const left=Math.max(0,Math.round((torso[0]+torso[2])/2-180)),top=260,width=360,height=Math.min(550,rig.height-top);
   this.crowdCtx.clearRect(0,0,1920,rig.height);drawRobot(this.crowdCtx,this.atlas,'run-in',index,actor.viewer,{type:'preview'});
   const w=width*scale,h=height*scale;ctx.save();ctx.translate(actor.x,actor.y);if(actor.direction<0)ctx.scale(-1,1);
   if(actor.state==='impact'){ctx.rotate(actor.direction*Math.sin(Math.min(1,actor.impact/.28)*Math.PI)*.22);ctx.globalAlpha=Math.max(0,1-actor.impact/.28);}
   ctx.drawImage(this.crowdBuffer,left,top,width,height,-w/2,-h,w,h);ctx.restore();
   const name=Array.from(String(actor.viewer.name||'Viewer')).slice(0,25).join('');ctx.save();ctx.font='bold 22px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.fillStyle='#fff';ctx.strokeText(name,actor.x,actor.y+3,180);ctx.fillText(name,actor.x,actor.y+3,180);ctx.restore();
  }

  this.root.dataset.crowdCount=String(this.world.actors.length);this.root.dataset.collisions=String(this.world.stats.collisions);
 }
 render(time){
  const ctx=this.ctx;ctx.clearRect(0,0,1920,1080);const hold=this.alert.textDuration||6,cardEnd=DOOR_LEAD+RUN_SECONDS+hold,raid=this.alert.type==='raid',heroAge=time-DOOR_LEAD;
  if(raid)this.drawCrowd(time);
  ctx.save();ctx.translate(this.groupX,this.groupY);ctx.scale(this.alertScale,this.alertScale);
  this.drawDoor(time,cardEnd+OUT_SECONDS);
  const show=time>=DOOR_LEAD+RUN_SECONDS&&time<cardEnd,showBox=this.alert.settings.showAlertBox!==false;
  this.panel.style.opacity=show&&showBox?'1':'0';this.panel.classList.toggle('revealed',show&&showBox);if(this.media){this.media.style.opacity=show?'1':'0';if(show&&!this.mediaStarted&&this.media.tagName==='VIDEO'){this.mediaStarted=true;this.media.currentTime=0;this.media.play().catch(()=>{});}}
  if(time<cardEnd+OUT_SECONDS){ctx.save();ctx.beginPath();ctx.rect(158,0,1762,1080);ctx.clip();this.drawActor(this.alert.viewer,heroAge,hold,1,40,0);ctx.restore();}
  this.drawDoorFront(time,cardEnd+OUT_SECONDS);ctx.restore();
  if(raid&&!this.done&&time>=this.alert.raidCrowdSeconds&&this.world.empty){this.done=true;queueMicrotask(()=>this.onDone?.());}
 }
 tick(){if(this.stopped)return;this.render((performance.now()-this.started)/1000);this.frame=requestAnimationFrame(()=>this.tick());}
 stop(){this.stopped=true;cancelAnimationFrame(this.frame);if(this.media?.tagName==='VIDEO'){this.media.pause();this.media.removeAttribute('src');this.media.load();}this.root.remove();}
}
