import { fileURLToPath } from 'url';
import { dirname } from 'path';

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(__filename);