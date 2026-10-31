export async function readJsonBody(req) {
  const chunks=[];let size=0;
  for await (const chunk of req) { const bytes=Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);size+=bytes.length;if(size>32768)throw new Error('Request too large.');chunks.push(bytes); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
