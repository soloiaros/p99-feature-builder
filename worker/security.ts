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
