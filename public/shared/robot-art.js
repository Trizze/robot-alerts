// Original faceted chassis artwork. A shared top-left light keeps each replaceable
// module readable; recesses, underside planes and seams provide the depth.
export function surfaceGradient(defs, id, c, el) {
  const gradient=el('linearGradient',{id,x1:'0%',y1:'0%',x2:'90%',y2:'100%'});
  for(const [offset,color] of [['0%',c.highlight],['24%',c.metal],['70%',c.metal],['100%',c.shade]]) gradient.append(el('stop',{offset,'stop-color':color}));
  defs.append(gradient); return `url(#${id})`;
}
export function plate(parent,x,y,w,h,c,fill,{rect,path},b=2) {
  parent.append(path(`M${x+b} ${y}H${x+w-b}L${x+w} ${y+b}V${y+h-b}L${x+w-b} ${y+h}H${x+b}L${x} ${y+h-b}V${y+b}Z`,c.ink),rect(x+b,y+b,w-2*b,h-2*b,fill),path(`M${x+b} ${y+1}H${x+w-b}V${y+b+1}H${x+b+1}V${y+h-b}H${x+1}V${y+b}Z`,c.highlight),path(`M${x+w-b} ${y+b}H${x+w-1}V${y+h-b}L${x+w-b} ${y+h-1}H${x+b}V${y+h-b-1}H${x+w-b}Z`,c.shade));
}
export function drawCrt(frame,v,c,fill,{rect,path},vents) {
  if(v.key==='front'||v.key==='back') {
    frame.append(path('M16 8H64V12H68V60H64V64H16V60H12V12H16Z',c.ink),rect(16,12,48,48,fill),rect(16,12,48,3,c.highlight),rect(16,15,2,43,c.metal),rect(62,15,2,45,c.shade),rect(16,60,48,2,c.shade));
    if(v.key==='front') {
      // Four stepped bezel edges surround the image without painting over it.
      frame.append(rect(18,16,44,44,c.ink),rect(18,16,44,2,c.shade),rect(18,18,2,40,c.shade),rect(20,58,40,2,c.highlight),rect(16,60,34,2,c.metal),rect(53,60,3,1,c.light),rect(59,60,3,2,c.ink));
    } else {
      plate(frame,20,17,40,38,c,fill,{rect,path},3);vents(frame,26,23,c,28);
      frame.append(rect(33,51,14,5,c.ink),rect(35,52,3,2,c.shade),rect(43,52,2,2,c.shade),rect(22,19,2,1,c.ink),rect(56,19,2,1,c.ink),rect(22,51,2,1,c.ink),rect(56,51,2,1,c.ink));
    }
  } else if(v.key==='front-right') {
    frame.append(path('M12 18H16V12H28V8H64V12H68V60H64V64H28V60H16V54H12Z',c.ink),rect(16,18,12,36,c.shade),rect(16,14,12,4,c.metal),rect(18,18,8,2,c.highlight),rect(16,54,12,4,c.ink),rect(28,12,36,48,fill),rect(28,12,36,3,c.highlight),rect(62,15,2,43,c.shade),rect(30,16,32,44,c.ink),rect(30,16,32,2,c.shade),rect(30,18,2,40,c.shade),rect(32,58,28,2,c.highlight),rect(28,60,36,2,c.shade),rect(57,60,3,1,c.light));
    for(let i=0;i<5;i++)frame.append(rect(18,27+i*4,7,2,c.ink),rect(18,29+i*4,7,1,c.metal));
  } else if(v.key==='right') {
    // Deep tube housing: tapered rear cap, ventilation and a thick front bezel.
    frame.append(path('M12 20H16V14H22V12H56V8H68V64H56V60H22V58H16V52H12Z',c.ink),path('M16 22 23 16H56V56H23L16 50Z',fill),rect(24,16,32,3,c.highlight),rect(52,20,4,34,c.shade),path('M16 48 24 54H56V58H22L16 52Z',c.shade),rect(58,12,6,48,c.metal),rect(58,12,6,3,c.highlight),rect(64,12,2,48,c.shade),rect(58,58,6,2,c.ink));
    for(let i=0;i<5;i++)frame.append(rect(24,27+i*4,24,2,c.ink),rect(24,29+i*4,24,1,c.highlight));
    frame.append(rect(21,22,1,26,c.shade),rect(30,50,14,3,c.shade),rect(46,52,3,2,c.ink));
  } else {
    frame.append(path('M12 22H16V16H22V14H48V12H58V8H68V64H58V60H48V62H22V58H16V52H12Z',c.ink),path('M16 23 23 18H48V56H23L16 50Z',fill),rect(24,18,24,3,c.highlight),rect(46,22,4,32,c.shade),rect(50,16,8,42,c.shade),rect(58,12,6,48,c.metal),rect(58,12,6,3,c.highlight),rect(64,12,2,48,c.shade),rect(24,56,24,3,c.shade));
    vents(frame,24,26,c,20);frame.append(rect(28,51,12,5,c.ink),rect(30,52,3,2,c.shade));
  }
}
