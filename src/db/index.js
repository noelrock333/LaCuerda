import config from '../config/index.js';
import { ChordsDatabase } from './client.js';

export const db = new ChordsDatabase(config.postgres);
export { ChordsDatabase };
