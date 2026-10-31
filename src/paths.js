import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

export const projectRoot = fileURLToPath(new URL('../',import.meta.url));
export const dataRoot = process.env.ROBOT_DATA_DIR ? resolve(process.env.ROBOT_DATA_DIR) : join(projectRoot,'data');
export const avatarDirectory = join(dataRoot,'avatars');
export const mediaDirectory = join(dataRoot,'media');
