import { alertCopy } from './alert-copy.js';
import { CARD_PRESETS, CARD_SYMBOLS } from './card-presets.js';
const node=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;};
export function eventAmount(alert){
 const n=v=>Number.isSafeInteger(v)&&v>=0?v:0;let value,unit;
 switch(alert.type){case'resub':value=n(alert.months);unit=value===1?'month':'months';break;case'gift':value=n(alert.gifts);unit=value===1?'sub':'subs';break;case'cheer':value=n(alert.bits);unit=value===1?'bit':'bits';break;case'raid':value=n(alert.raidSize);unit=value===1?'viewer':'viewers';break;case'sub':value=1;unit='sub';break;case'follow':return {value:'NEW',unit:'follower'};default:return {value:'HI',unit:'robot'};}
 return {value:value.toLocaleString('en-US'),unit};
}
export function createAlertCard(alert){
 const cfg=alert.settings?.card||{},id=Object.hasOwn(CARD_PRESETS,cfg.preset)?cfg.preset:'01',preset=CARD_PRESETS[id],colors={...preset.colors,...cfg.colors},custom=cfg.events?.[alert.type]||{},copy=alertCopy(alert),amount=eventAmount(alert),viewer=alert.viewer?.name||'Anonymous supporter';
 const card=node('div',`card alert-card card-${id}`);for(const key of Object.keys(preset.colors))if(/^#[0-9a-f]{6}$/i.test(colors[key]))card.style.setProperty(`--card-${key}`,colors[key]);
 const symbol=node('div','card-symbol');const chosen=custom.symbol||'event';
 if(chosen==='uploaded'&&/^\/media\/[a-f0-9-]{36}\.(png|jpg|gif|webp)$/.test(custom.upload||'')){const img=node('img','card-symbol-image');img.src=custom.upload;img.alt='';symbol.append(img);}
 else symbol.textContent=chosen==='none'?'':chosen==='event'||chosen==='uploaded'?copy.icon:CARD_SYMBOLS[chosen]||'';
 const content=node('div','card-content'),label=node('div','card-event',custom.label||copy.label),name=node('div','viewer-name');name.setAttribute('aria-label',viewer);const typed=node('span','name-typed',viewer);typed.setAttribute('aria-hidden','true');name.append(typed);name.style.setProperty('--letters',Math.max(1,Array.from(viewer).length));name.style.setProperty('--name-size',`${viewer.length>30?38:viewer.length>22?46:viewer.length>15?58:72}px`);
 const expand=template=>template.replace(/\{(count|unit|user)\}/g,(_,key)=>({count:amount.value,unit:amount.unit,user:viewer})[key]);const detail=expand(custom.detail||copy.detail);
 content.append(label,name,node('div','detail',detail));const metric=node('div','card-metric'),value=expand(custom.amountValue||'{count}');metric.style.setProperty('--amount-size',`${Math.min(62,Math.max(28,Math.floor(260/Math.max(1,Array.from(value).length))))}px`);metric.append(node('strong','card-value',value),node('span','card-unit',expand(custom.amountUnit||'{unit}')));card.append(symbol,content,metric);return card;
}
