import type { Feature, Project } from '../src/shared/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(422, 'Expected a JSON object.');
  return value as Record<string, unknown>;
}
export function textField(value: unknown, name: string, max: number, fallback?: string): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) throw new ApiError(422, `${name} must contain 1–${max} characters.`);
  return value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
export async function limitedText(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ApiError(413, 'The supplied content is too large.'); }
      result += decoder.decode(chunk.value, { stream: true });
    }
    return result + decoder.decode();
  } finally { reader.releaseLock(); }
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'Send a JSON request.');
  if (Number(request.headers.get('content-length')) > 100_000) throw new ApiError(413, 'The request is too large.');
  const body = await limitedText(request.body, 100_000);
  try { return record(JSON.parse(body)); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'The request contains invalid JSON.'); }
}
export function parseProject(value: unknown): Project {
  const input = record(value);
  return {
    input: textField(input.input, 'Project input', 6000),
    description: textField(input.description, 'Project description', 12000),
    name: textField(input.name, 'Project name', 100),
    platform: textField(input.platform, 'Platform', 80),
    stack: textField(input.stack, 'Stack', 160),
    ...(typeof input.sourceUrl === 'string' ? { sourceUrl: validatePublicUrl(input.sourceUrl).href } : {}),
  };
}
export function parseFeature(value: unknown): Feature {
  const input = record(value);
  const name = textField(input.name, 'Feature name', 90);
  const id = textField(input.id, 'Feature id', 90);
  if (!/^[a-z0-9][a-z0-9-]{0,89}$/.test(id)) throw new ApiError(422, 'Feature ids must use lowercase letters, numbers and hyphens.');
  return { id, name, description: textField(input.description, 'Feature description', 400, name) };
}
export function parseFeatures(value: unknown): Feature[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) throw new ApiError(422, 'Choose between 1 and 7 features.');
  const parsed = value.map(parseFeature);
  if (new Set(parsed.map((item) => item.id)).size !== parsed.length) throw new ApiError(422, 'Choose each feature only once.');
  return parsed;
}

// Reject all literal IP URLs; URL normalizes unusual IPv4 spellings before this check.
export function validatePublicUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new ApiError(422, 'Enter a full HTTPS landing page URL.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host) || /(^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan)$/.test(host)) {
    throw new ApiError(422, 'Use a public HTTPS website address without credentials or a custom port.');
  }
  if (host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.split('.').some((part) => !part || part.length > 63 || part.startsWith('-') || part.endsWith('-'))) throw new ApiError(422, 'That website address is not supported.');
  url.hostname = host;
  url.hash = '';
  return url;
}

export function isPublicAddress(address: string): boolean {
  if (address.includes(':')) {
    // Only globally routable IPv6 2000::/3; reject embedded IPv4 and transition networks.
    const first = parseInt(address.split(':')[0], 16);
    if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff || address.includes('.') || /^2001:(?:0:|0?db8:|0?10:|0?20:)/i.test(address) || /^2002:/i.test(address)) return false;
    return /^[0-9a-f:]+$/i.test(address);
  }
  const chunks = address.split('.');
  if (chunks.length !== 4 || chunks.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b, c] = chunks.map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 2))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

export async function assertPublicDns(hostname: string, fetcher: typeof fetch = fetch): Promise<void> {
  const answers = await Promise.all(['A', 'AAAA'].map(async (type) => {
    const dnsUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`;
    const response = await fetcher.call(globalThis, dnsUrl, { headers: { accept: 'application/dns-json' }, redirect: 'manual', signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new ApiError(422, 'Could not safely resolve that website. Try a description instead.');
    const data = record(JSON.parse(await limitedText(response.body, 20000)));
    if (data.Status !== 0) throw new ApiError(422, 'That website could not be resolved. Try a description instead.');
    return Array.isArray(data.Answer) ? data.Answer.map(record).filter((item) => item.type === 1 || item.type === 28).map((item) => item.data) : [];
  }));
  const ips = answers.flat();
  if (ips.length === 0 || ips.some((ip) => typeof ip !== 'string' || !isPublicAddress(ip))) throw new ApiError(422, 'That website does not resolve exclusively to public addresses.');
}

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, (value) => {
    const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
    if (named[value.toLowerCase()]) return named[value.toLowerCase()];
    const n = value.toLowerCase().startsWith('&#x') ? parseInt(value.slice(3, -1), 16) : parseInt(value.slice(2, -1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
  });
}
export function pageText(html: string): { title: string; description: string } {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, ' ') ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const clean = html.replace(/<(script|style|noscript|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ');
  return { title, description: decodeEntities(clean).replace(/\s+/g, ' ').trim().slice(0, 10000) };
}
