import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const signatures = [
  ['png','image/png',b=>b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))],
  ['jpg','image/jpeg',b=>b[0]===255&&b[1]===216&&b[2]===255],
  ['gif','image/gif',b=>['GIF87a','GIF89a'].includes(b.subarray(0,6).toString('ascii'))],
  ['webp','image/webp',b=>b.subarray(0,4).toString('ascii')==='RIFF'&&b.subarray(8,12).toString('ascii')==='WEBP'],
  ['mp4','video/mp4',b=>b.subarray(4,8).toString('ascii')==='ftyp'],
  ['webm','video/webm',b=>b.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'))]
];
const limit=25*1024*1024;
export async function saveMedia(req) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('File exceeds 25 MB.');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks), match=signatures.find(([,,check])=>check(bytes));
  if(!match||bytes.length<12)throw new Error('Use an MP4, WebM, GIF, PNG, JPG or WebP file.');
  const name=`${randomUUID()}.${match[0]}`;await mkdir('data/media',{recursive:true});await writeFile(`data/media/${name}`,bytes,{flag:'wx'});return `/media/${name}`;
}
export async function getMedia(name){
  if(!/^[a-f0-9-]{36}\.(png|jpg|gif|webp|mp4|webm)$/.test(name))return null;
  const type=signatures.find(([ext])=>name.endsWith(`.${ext}`))?.[1];
  try{return {bytes:await readFile(`data/media/${name}`),type};}catch{return null;}
}
