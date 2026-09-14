import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home',
  '.lan',
  '.test',
  '.invalid',
];

const normalizeHostname = (hostname: string): string => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized;
};

const parseIpv4 = (address: string): number[] | null => {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const values = parts.map(part => Number(part));
  if (values.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return values;
};

const isBlockedIpv4 = (address: string): boolean => {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const normalizeIpv6 = (address: string): string => normalizeHostname(address).split('%')[0];

const isBlockedIpv6 = (address: string): boolean => {
  const normalized = normalizeIpv6(address);
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('ff')) return true;
  if (normalized.startsWith('2001:db8:') || normalized === '2001:db8::') return true;

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isBlockedIpv4(mappedIpv4[1]);

  return false;
};

export const isPublicIpAddress = (address: string): boolean => {
  const normalized = normalizeHostname(address);
  const family = net.isIP(normalized);
  if (family === 4) return !isBlockedIpv4(normalized);
  if (family === 6) return !isBlockedIpv6(normalized);
  return false;
};

export const validatePublicUrl = (rawUrl: string): URL => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('The URL is invalid.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only public HTTP and HTTPS URLs are supported.');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs containing credentials are not supported.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new UnsafeUrlError('Non-standard URL ports are blocked.');
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname === 'localhost' || BLOCKED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))) {
    throw new UnsafeUrlError('Local and private hostnames are blocked.');
  }

  const family = net.isIP(hostname);
  if (family && !isPublicIpAddress(hostname)) {
    throw new UnsafeUrlError('Private, loopback, reserved, and link-local IP addresses are blocked.');
  }

  url.hash = '';
  return url;
};

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: HostResolver = async hostname => (
  dns.lookup(hostname, { all: true, verbatim: true })
);

export interface PinnedPublicTarget {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
  resolvedAddresses: string[];
}

export const resolvePinnedPublicTarget = async (
  rawUrl: string,
  resolver: HostResolver = defaultResolver,
): Promise<PinnedPublicTarget> => {
  const url = validatePublicUrl(rawUrl);
  const hostname = normalizeHostname(url.hostname);

  if (net.isIP(hostname)) {
    return {
      url,
      hostname,
      address: hostname,
      family: net.isIP(hostname) as 4 | 6,
      resolvedAddresses: [hostname],
    };
  }

  const resolved = await resolver(hostname);
  if (resolved.length === 0) {
    throw new UnsafeUrlError('The hostname did not resolve to an address.');
  }

  const normalized = resolved.map(item => ({
    address: normalizeIpv6(item.address),
    family: item.family,
  }));
  const unsafe = normalized.filter(item => !isPublicIpAddress(item.address));
  if (unsafe.length > 0) {
    throw new UnsafeUrlError('The hostname resolves to a private, loopback, reserved, or link-local address.');
  }

  const chosen = normalized[0];
  if (chosen.family !== 4 && chosen.family !== 6) {
    throw new UnsafeUrlError('The hostname resolved to an unsupported address family.');
  }

  return {
    url,
    hostname,
    address: chosen.address,
    family: chosen.family,
    resolvedAddresses: normalized.map(item => item.address),
  };
};

export const validateRedirectTarget = async (
  currentUrl: string,
  location: string,
  resolver: HostResolver = defaultResolver,
): Promise<PinnedPublicTarget> => {
  const nextUrl = new URL(location, currentUrl);
  return resolvePinnedPublicTarget(nextUrl.toString(), resolver);
};
