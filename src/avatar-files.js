import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function deleteAvatarFiles(id, directory='data/avatars') {
  if (typeof id !== 'string' || !/^\d{1,32}$/.test(id)) return;
  for (const ext of ['png','jpg','webp']) {
    try { await unlink(join(directory,`${id}.${ext}`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
