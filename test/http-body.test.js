import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJsonBody } from '../src/http-body.js';

test('JSON reader correctly decodes UTF-8 split across chunks', async () => {
 const bytes=Buffer.from(JSON.stringify({text:'Hej 😀 åäö'}));
 const chunks=Array.from(bytes,byte=>Buffer.from([byte]));
 assert.deepEqual(await readJsonBody(Readable.from(chunks)),{text:'Hej 😀 åäö'});
});
test('JSON reader enforces the limit using bytes and handles empty input', async () => {
 assert.deepEqual(await readJsonBody(Readable.from([])),{});
 await assert.rejects(readJsonBody(Readable.from([Buffer.alloc(32769)])),/too large/);
});
