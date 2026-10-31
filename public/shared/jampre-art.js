import geometry from './jampre-geometry.js';
import bounds from './jampre-bounds.js';
const NS='http://www.w3.org/2000/svg';
const element=(tag,attributes={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,String(v));return n;};
const SCALE=.284, OFFSET_X=40-256*SCALE, OFFSET_Y=0;
const point=p=>[OFFSET_X+p[0]*SCALE,OFFSET_Y+p[1]*SCALE];
const allowedAvatar=v=>/^\/(?:avatars\/\d+\.(?:png|jpg|webp)|assets\/avatars\/[a-zA-Z0-9_-]+\.svg)$/.test(v||'');
const PARTS=['head','body','arm_l','arm_r','leg_l','leg_r','chest'];
function tile(direction,index,x=OFFSET_X,y=OFFSET_Y){
  const b=bounds[direction][index];if(!b)return element('g');
  return element('image',{x:x+b[0]*SCALE,y:y+b[1]*SCALE,width:b[2]*SCALE,height:b[3]*SCALE,href:`/assets/robot/${direction}-${PARTS[index]}.png`,'pointer-events':'none'});
}
function matrix(tri){
  const [[x0,y0,u0,v0],[x1,y1,u1,v1],[x2,y2,u2,v2]]=tri.map(p=>{const xy=point(p);return [xy[0],xy[1],p[2],p[3]];});
  const du1=u1-u0,dv1=v1-v0,du2=u2-u0,dv2=v2-v0,det=du1*dv2-du2*dv1;if(Math.abs(det)<1e-9)return null;
  const a=((x1-x0)*dv2-(x2-x0)*dv1)/det,c=(du1*(x2-x0)-du2*(x1-x0))/det,b=((y1-y0)*dv2-(y2-y0)*dv1)/det,d=(du1*(y2-y0)-du2*(y1-y0))/det;
  return [a,b,c,d,x0-a*u0-c*v0,y0-b*u0-d*v0];
}
function coarseScreen(triangles){
  const vertices=[...new Map(triangles.flat().map(p=>[`${p[2]},${p[3]}`,p])).values()];
  const grid=[0,.5,1].map(v=>[0,.5,1].map(u=>vertices.reduce((best,p)=>((p[2]-u)**2+(p[3]-v)**2)<((best[2]-u)**2+(best[3]-v)**2)?p:best)));
  const out=[];for(let y=0;y<2;y++)for(let x=0;x<2;x++){const a=grid[y][x],b=grid[y][x+1],c=grid[y+1][x],d=grid[y+1][x+1];out.push([a,b,d],[a,d,c]);}return out;
}
function avatar(rig,data){
  const image=element('image',{id:`${rig.id}-avatar-source`,x:0,y:0,width:1,height:1,preserveAspectRatio:'none'});rig.defs.append(image);rig.spriteAvatar=image;
  if(allowedAvatar(rig.viewer?.avatar))image.setAttribute('href',rig.viewer.avatar);
  const layer=element('g',{'data-sprite-screen':''});let i=0;
  for(const tri of coarseScreen(data.screen)){const transform=matrix(tri);if(!transform)continue;const id=`${rig.id}-avatar-tri-${i++}`,clip=element('clipPath',{id});clip.append(element('polygon',{points:tri.map(p=>point(p).join(',')).join(' ')}));rig.defs.append(clip);const group=element('g',{'clip-path':`url(#${id})`});group.append(element('use',{href:`#${rig.id}-avatar-source`,transform:`matrix(${transform.join(' ')})`}));layer.append(group);}
  rig.head.append(layer);
}
export function applyJampreArt(rig){
  rig.isJampre=true;const data=geometry[rig.direction],front=['front','front-right','front-left'].includes(rig.direction);rig.spriteAvatar=null;
  for(const n of rig.svg.querySelectorAll('[data-layer=paint],[data-layer=chest],[data-base=head],[data-layer=screen],[data-connector]'))n.setAttribute('display','none');
  const torso=rig.body.querySelector('[data-layer=paint]');rig.body.insertBefore(tile(rig.direction,1),torso);
  if(front){rig.body.insertBefore(tile(rig.direction,6),rig.head);const chest=element('g',{'data-sprite-chest':''});const color=/^#[0-9a-f]{6}$/i.test(rig.viewer?.color||'')?rig.viewer.color:'#a098b8';for(const tri of data.chest)chest.append(element('polygon',{points:tri.map(p=>point(p).join(',')).join(' '),fill:color}));rig.body.insertBefore(chest,rig.head);}
  rig.head.insertBefore(tile(rig.direction,0),rig.head.firstChild);if(front)avatar(rig,data);
  for(const [slot,index,key]of[['leftArm',2,'arm_l'],['rightArm',3,'arm_r'],['leftLeg',4,'leg_l'],['rightLeg',5,'leg_r']]){
    const b=rig.bones[slot],p=point(data.pivots[key]);b.origin=p;b.bone.setAttribute('transform',`translate(${p[0]} ${p[1]})`);
    for(const n of b.bone.querySelectorAll('[data-base],[data-connector]'))n.setAttribute('display','none');b.hand.setAttribute('display','none');
    const separation=(slot.endsWith('Leg') && ['right','left'].includes(rig.direction))?(slot==='leftLeg'?-2:2):0;
    b.upper.insertBefore(tile(rig.direction,index,OFFSET_X-p[0]+separation,OFFSET_Y-p[1]),b.upper.firstChild);
  }
  rig.view.left=rig.bones.leftArm.origin;rig.view.right=rig.bones.rightArm.origin;rig.view.hips=[rig.bones.leftLeg.origin[0],rig.bones.rightLeg.origin[0]];
}
export function updateJampreAvatar(rig,viewer){const color=/^#[0-9a-f]{6}$/i.test(viewer?.color||'')?viewer.color:'#a098b8';for(const part of rig.svg.querySelectorAll('[data-sprite-chest] polygon'))part.setAttribute('fill',color);if(!rig.spriteAvatar)return;if(allowedAvatar(viewer?.avatar))rig.spriteAvatar.setAttribute('href',viewer.avatar);else rig.spriteAvatar.removeAttribute('href');}
