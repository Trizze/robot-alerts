// Fixed-step crowd motion. Viewer text is never executable; only IDs seed lanes.
export class RaidWorld {
  constructor(){this.time=0;this.accumulator=0;this.pending=[];this.actors=[];this.clouds=[];this.serial=0;this.stats={crossed:0,collisions:0,smoked:0};}
  add(viewer,at=0,sequence=this.serial++){
    if(!viewer?.avatar||this.pending.length+this.actors.length>=128)return false;
    this.pending.push({viewer,at:Math.max(at,this.time),sequence});return true;
  }
  step(dt=1/60){
    this.time+=dt;
    for(let i=this.pending.length-1;i>=0&&this.actors.length<24;i--){const p=this.pending[i];if(p.at>this.time)continue;this.pending.splice(i,1);const side=p.sequence%2===0?1:-1,lane=Math.floor(p.sequence/4)%3,track=p.sequence%4>=2?(p.sequence%2===0?-1:1):0;this.actors.push({id:p.sequence,viewer:p.viewer,x:side>0?-110:2030,y:lane*100+760+track*30,lane,track,vx:side*(150+(p.sequence%3)*10),direction:side,distance:0,state:'run',age:0,impact:0});}
    for(const a of this.actors){a.age+=dt;if(a.state==='smoke'){a.impact+=dt;a.x+=a.vx*dt;a.vx*=.9;continue;}a.x+=a.vx*dt;a.distance+=Math.abs(a.vx)*dt;}
    for(let i=0;i<this.actors.length;i++)for(let j=i+1;j<this.actors.length;j++){
      const a=this.actors[i],b=this.actors[j];if(a.state!=='run'||b.state!=='run'||a.lane!==b.lane||a.track!==b.track||a.direction===b.direction||Math.abs(a.x-b.x)>84)continue;
      this.stats.collisions++;this.stats.smoked+=2;a.state=b.state='smoke';a.vx=-a.vx*.2;b.vx=-b.vx*.2;
      this.clouds.push({id:`cloud-${a.id}-${b.id}`,x:(a.x+b.x)/2,y:a.y-90,age:0});
    }
    for(const c of this.clouds)c.age+=dt;this.clouds=this.clouds.filter(c=>c.age<.85);
    this.actors=this.actors.filter(a=>{if(a.state==='smoke')return a.impact<.22;if(a.age>25||a.x<-180||a.x>2100){this.stats.crossed++;return false;}return true;});
  }
  advance(time){const target=Math.max(0,time);if(target<this.time)return;let n=0;while(this.time+1/60<=target&&n++<2400)this.step();}
  get empty(){return this.actors.length===0&&this.pending.length===0&&this.clouds.length===0;}
}
