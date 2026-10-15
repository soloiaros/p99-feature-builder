import { describe, expect, it, vi } from 'vitest';
import { limitedText, pageText, readLandingPage } from '../worker/security';

describe('bounded landing page context', () => {
  it('uses metadata from large pages instead of rejecting their scripts', async () => {
    const fetcher = vi.fn(async (url: string) => url.startsWith('https://cloudflare-dns.com/')
      ? Response.json({ Status: 0, Answer: [{ type: 1, data: '93.184.215.14' }] })
      : new Response(`<title>My app</title><meta content="A private daily journal with thoughtful prompts and a searchable history." name="description"><script>${'x'.repeat(1_500_000)}</script>`, { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    const page = await readLandingPage('https://public-site.com', fetcher);
    expect(page.title).toBe('My app');
    expect(page.description).toContain('thoughtful prompts');
    expect(page.description).not.toContain('xxxxx');
  });
  it('cancels oversized streams while still rejecting oversized API input', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('useful context and excess')); }, cancel });
    expect(await limitedText(stream, 14, 'truncate')).toBe('useful context');
    expect(cancel).toHaveBeenCalledOnce();
    await expect(limitedText(new Response('oversized').body, 4)).rejects.toMatchObject({ status: 413 });
  });
  it('ignores an unfinished script and supports metadata attribute order', () => {
    expect(pageText('<meta property="og:description" content="Keep &amp; organize your notes"><script>bad content').description).toBe('Keep & organize your notes');
  });
});
