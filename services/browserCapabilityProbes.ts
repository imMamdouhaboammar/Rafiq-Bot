import {
  RafiqTransferV2ManifestSchema,
  type CapabilityHealth,
} from '../contracts/rafiqV6.js';
import type { CapabilityProbe } from './capabilityHealthRepository.js';

type OpfsStorageManager = Omit<StorageManager, 'getDirectory'> & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

const runServerProbe = async (
  capability: Extract<CapabilityHealth['capability'], 'gemini' | 'web_search'>,
) => {
  const response = await fetch('/api/capability-test', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capability }),
  });
  const payload = await response.json().catch(() => ({})) as {
    ok?: boolean;
    kind?: 'real_provider';
    reason?: string;
    error?: string;
  };
  return {
    ok: response.ok && payload.ok === true,
    kind: 'real_provider' as const,
    reason: payload.reason || payload.error || `Probe failed with status ${response.status}.`,
  };
};

const runOpfsProbe = async () => {
  const storage = navigator.storage as OpfsStorageManager;
  if (!storage.getDirectory) {
    return {
      ok: false,
      kind: 'staging' as const,
      reason: 'OPFS is not available in this browser.',
    };
  }

  const root = await storage.getDirectory();
  const fileName = `.rafiq-health-${crypto.randomUUID()}.txt`;
  const handle = await root.getFileHandle(fileName, { create: true });
  try {
    const writable = await handle.createWritable();
    await writable.write('rafiq-opfs-health');
    await writable.close();
    const file = await handle.getFile();
    const content = await file.text();
    if (content !== 'rafiq-opfs-health') {
      throw new Error('OPFS read-back content did not match the written content.');
    }
    return {
      ok: true,
      kind: 'staging' as const,
      reason: 'OPFS write, read, and cleanup probe passed.',
    };
  } finally {
    await root.removeEntry(fileName).catch(() => undefined);
  }
};

const runTransferContractProbe = async () => {
  RafiqTransferV2ManifestSchema.parse({
    format: 'rafiq-transfer',
    version: 2,
    createdAt: new Date(),
    appVersion: 'health-check',
    encrypted: false,
    includesPrivateStory: false,
    includesSensitiveMemory: false,
    includesBinaryMedia: false,
    checksums: {},
    counts: {
      chats: 0,
      messages: 0,
      lifeStoryEvents: 0,
      botStoryEvents: 0,
      memories: 0,
      attachments: 0,
    },
  });
  return {
    ok: true,
    kind: 'staging' as const,
    reason: 'Transfer v2 manifest validation passed locally.',
  };
};

const unavailableProbe = (
  capability: CapabilityHealth['capability'],
  requirement: string,
): CapabilityProbe => ({
  capability,
  requirements: () => [{ name: requirement, present: false }],
  run: async () => ({
    ok: false,
    kind: 'staging',
    reason: `${requirement} is not installed yet.`,
  }),
});

export const createDefaultCapabilityProbes = (): CapabilityProbe[] => [
  {
    capability: 'gemini',
    requirements: () => [{ name: 'Authenticated capability-test endpoint', present: typeof fetch === 'function' }],
    run: () => runServerProbe('gemini'),
  },
  {
    capability: 'web_search',
    requirements: () => [{ name: 'Authenticated capability-test endpoint', present: typeof fetch === 'function' }],
    run: () => runServerProbe('web_search'),
  },
  {
    capability: 'attachments',
    requirements: () => [{
      name: 'Origin Private File System',
      present: typeof navigator !== 'undefined' && typeof (navigator.storage as OpfsStorageManager)?.getDirectory === 'function',
    }],
    run: runOpfsProbe,
  },
  {
    capability: 'import_export',
    requirements: () => [{ name: 'Transfer v2 contract', present: true }],
    run: runTransferContractProbe,
  },
  unavailableProbe('groups', 'Real-model group smoke probe'),
  unavailableProbe('web_reader', 'Safe rendered-reader staging probe'),
  unavailableProbe('selfie', 'Confirmed selfie staging probe'),
];
