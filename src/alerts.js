import { randomUUID } from 'node:crypto';

export class AlertQueue {
  constructor(broadcast, settings) { this.broadcast = broadcast; this.settings = settings; this.pending = []; this.current = null; this.timer = null; this.dropped = 0; }
  enqueue(alert) {
    const settings = this.settings(alert.channel);
    if (!settings.events[alert.type]) return;
    const animation = alert.type !== 'raid' && (alert.animationOverride === 'custom' || (alert.animationOverride !== 'robot' && settings.animations[alert.type] === 'custom')) ? 'custom' : 'robot';
    const textDuration = settings.textDurations?.[alert.type === 'raid' ? 'parade' : animation] ?? (alert.type === 'raid' ? 3 : 6);
    const reveal = 1.15 + 54 / 30, exit = 37 / 30, doorClose = 1;
    const crowdStart = 0;
    const totalDuration = alert.type === 'raid' ? 25 + 30 : reveal + textDuration + exit + doorClose;
    if (this.pending.length >= 40) {
      const preview = this.pending.findIndex(a => a.type === 'preview');
      if (preview !== -1) this.pending.splice(preview, 1);
      else { this.dropped++; this.broadcast({ kind: 'overflow', count: this.dropped }); return; }
    }
    this.pending.push({ ...alert, key: randomUUID(), settings, animation, textDuration, raidCrowdSeconds:25, raidCrowdStart:crowdStart, raidDrainSeconds:30, raiders:[], totalDuration, participants: alert.demo && Array.isArray(alert.participants) ? alert.participants.slice(0, 11) : [] });
    this.next();
  }
  next() {
    if (this.current || !this.pending.length) return;
    this.current = { ...this.pending.shift(), startedAt: Date.now() };
    this.broadcast({ kind: 'alert', alert: this.current, queued: this.pending.length });
    this.timer = setTimeout(() => this.complete(this.current?.key,true), this.current.totalDuration * 1000 + 1500);
  }
  complete(key,force=false) {
    if (!key || key !== this.current?.key) return;
    if(!force&&this.current.type==='raid'&&Date.now()-this.current.startedAt<(this.current.raidCrowdStart+this.current.raidCrowdSeconds)*1000)return;
    clearTimeout(this.timer); this.current = null; this.broadcast({ kind: 'idle', queued: this.pending.length }); this.next();
  }
  raidCrowdOpen(channel,demo=false,now=Date.now()) {
    const r=this.current,age=r?(now-r.startedAt)/1000:0;
    return Boolean(r?.type==='raid'&&Boolean(r.demo)===demo&&r.channel===channel&&age>=r.raidCrowdStart&&age<r.raidCrowdStart+r.raidCrowdSeconds);
  }
  joinRaid(channel,viewer,demo=false) {
    if(!viewer?.id||!this.raidCrowdOpen(channel,demo))return false;
    const r=this.current;if(r.raiders.length>=128||r.raiders.some(p=>p.viewer.id===viewer.id))return false;
    const entry={viewer:{id:viewer.id,name:viewer.name,avatar:viewer.avatar||null,color:/^#[0-9a-f]{6}$/i.test(viewer.color||'')?viewer.color:null},sequence:r.raiders.length,at:viewer.avatar?(Date.now()-r.startedAt)/1000-r.raidCrowdStart:null};
    r.raiders.push(entry);this.broadcast({kind:'raid-join',key:r.key,entry});return true;
  }
  updateRaidViewer(key,id,viewer){
    const r=this.current;if(r?.key!==key||r.type!=='raid')return;
    const entry=r.raiders.find(p=>p.viewer.id===id);if(!entry)return;
    entry.viewer={id,name:viewer.name,avatar:viewer.avatar||null,color:/^#[0-9a-f]{6}$/i.test(viewer.color||'')?viewer.color:null};if(entry.at===null&&viewer.avatar)entry.at=(Date.now()-r.startedAt)/1000-r.raidCrowdStart;
    this.broadcast({kind:'raid-profile',key,entry});
  }
  cancelDemo() {
    this.pending = this.pending.filter(alert => !alert.demo);
    if (this.current?.demo) this.complete(this.current.key,true);
    else this.broadcast({ kind: 'queue', queued: this.pending.length });
  }
  updateTheme(theme) {
    for (const alert of [this.current, ...this.pending]) if (alert) alert.settings = { ...alert.settings, theme };
  }
  stop() { clearTimeout(this.timer); this.pending = []; this.current = null; }
}
