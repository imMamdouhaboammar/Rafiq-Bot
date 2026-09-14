import type { Table } from 'dexie';
import './registerDbV6.js';
import { db } from './db.js';
import type {
  AttachmentRecord,
  BotStoryEvent,
  CapabilityHealth,
  GroupTurnJob,
  LifeStoryEvent,
  MemoryRecord,
  StorySignal,
} from '../contracts/rafiqV6.js';
import type { SocialAgencyRecord } from './dbV6Migration.js';

export interface TransferStagingRecord {
  id: string;
  status: 'staging' | 'validated' | 'committing' | 'committed' | 'rolled_back' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  payload?: unknown;
}

const table = <T, TKey = string>(name: string): Table<T, TKey> => (
  db.table<T, TKey>(name)
);

export const v6Tables = {
  lifeStoryEvents: () => table<LifeStoryEvent>('lifeStoryEvents'),
  storySignals: () => table<StorySignal>('storySignals'),
  botStoryEvents: () => table<BotStoryEvent>('botStoryEvents'),
  memoryRecords: () => table<MemoryRecord>('memoryRecords'),
  socialAgency: () => table<SocialAgencyRecord>('socialAgency'),
  attachmentRecords: () => table<AttachmentRecord>('attachmentRecords'),
  groupTurnJobs: () => table<GroupTurnJob>('groupTurnJobs'),
  capabilityHealth: () => table<CapabilityHealth, CapabilityHealth['capability']>('capabilityHealth'),
  transferStaging: () => table<TransferStagingRecord>('transferStaging'),
};
