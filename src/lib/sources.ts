export * from '../../shared/sources';
import { SOURCES } from '../../shared/sources';
import type { SourceId } from '../types';
export const meta = (id: SourceId) => SOURCES[id];
