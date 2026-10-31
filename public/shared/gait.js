const fraction = n => ((n%1)+1)%1;
// During stance, local foot travel cancels root travel exactly. Swing returns
// the foot through a lifted arc; gait phase depends on distance, not wall time.
export function footstep(distance, stride=18, offset=0) {
  const phase=fraction(distance/(stride/.6)+offset);
  if(phase<.6)return{x:stride*(.5-phase/.6),lift:0,stance:true,phase};
  const t=(phase-.6)/.4,s=t*t*(3-2*t);
  return{x:stride*(s-.5),lift:Math.sin(Math.PI*t)*4,stance:false,phase};
}
