import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RobotHead } from 'robot-heads?gaze=1';
import {
  chromeCrossingX, clampTabX, gazePose, nearestReady, poseKey, standForPose, tabAnchorInViewport, warmPoses,
  type GazePose, type Point,
} from '../lib/favicon-gaze';

const SIZE = 72;
const SETTLE_MS = 300;
const STAGE: Point = { x: -2400, y: -2400 };
const TAB_KEY = 'p99-tab-x';
const POSES = warmPoses();

function metrics() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = `${nav.userAgentData?.platform || ''} ${navigator.platform} ${navigator.userAgent}`;
  return {
    screenX: window.screenX,
    screenY: window.screenY,
    outerHeight: window.outerHeight,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    mac: /mac/i.test(platform),
  };
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readTabX(): number | null {
  try {
    const value = Number(sessionStorage.getItem(TAB_KEY));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeTabX(x: number) {
  try { sessionStorage.setItem(TAB_KEY, String(Math.round(x))); } catch { /* private mode */ }
}

function wait(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));
}

function crop(source: HTMLCanvasElement) {
  const context = source.getContext('2d');
  if (!context || !source.width || !source.height) return '';
  const frame = context.getImageData(0, 0, source.width, source.height);
  const pixels = frame.data;
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (pixels[(y * source.width + x) * 4 + 3] <= 10) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return '';
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const scale = Math.min(1, 64 / Math.max(width, height));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(width * scale));
  out.height = Math.max(1, Math.round(height * scale));
  const ctx = out.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, minX, minY, width, height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

function publish(href: string, shown: { current: string }) {
  if (!href || href === shown.current) return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  shown.current = href;
  link.type = 'image/png';
  link.href = href;
}

function aim(node: HTMLDivElement, point: Point) {
  node.style.transform = `translate(${point.x - SIZE / 2}px, ${point.y - SIZE / 2}px)`;
}

/** Points the favicon from the tab toward the pointer. */
export function FaviconGaze() {
  const mover = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(() => !reducedMotion());
  const [tracking, setTracking] = useState(true);

  useEffect(() => {
    const node = mover.current;
    if (!node || reducedMotion()) return;
    let cancelled = false;
    let generation = 0;
    let touched = false;
    let bucket = '';
    const learned = { current: readTabX() };
    const cache = new Map<string, string>();
    const shown = { current: '' };
    const anchor = () => tabAnchorInViewport(metrics(), learned.current);

    const finish = () => {
      if (!cancelled && cache.size === POSES.length) setMounted(false);
    };
    const shoot = () => {
      const canvas = node.querySelector('canvas');
      return canvas ? crop(canvas) : '';
    };
    const settleAndShoot = async (gen: number) => {
      await wait(SETTLE_MS);
      if (cancelled || gen !== generation) return '';
      await nextFrame();
      if (cancelled || gen !== generation) return '';
      const first = shoot();
      if (first) return first;
      await nextFrame();
      if (cancelled || gen !== generation) return '';
      return shoot();
    };
    const show = (pose: GazePose) => {
      const exact = cache.get(poseKey(pose));
      if (exact) {
        publish(exact, shown);
        return;
      }
      const fallback = nearestReady(pose, [...cache.keys()].map(key => {
        const [yaw, dip] = key.split(':').map(Number);
        return { yaw, dip };
      }));
      if (fallback) publish(cache.get(poseKey(fallback)) || '', shown);
    };
    const learn = (event: PointerEvent) => {
      if (!event.isTrusted) return false;
      const x = chromeCrossingX(event.clientY, event.movementY, event.clientX);
      if (x == null) return false;
      const next = clampTabX(x, window.innerWidth);
      if (learned.current != null && Math.abs(learned.current - next) < 16) return false;
      learned.current = next;
      writeTabX(next);
      return true;
    };
    const capture = (pose: GazePose, cursor: Point) => {
      const key = poseKey(pose);
      if (cache.has(key)) return;
      const gen = ++generation;
      setTracking(true);
      aim(node, standForPose(cursor, pose));
      void settleAndShoot(gen).then(href => {
        if (!href || gen !== generation || cancelled) return;
        cache.set(key, href);
        if (bucket === key) publish(href, shown);
        if (cache.size === POSES.length) finish();
        else if (!touched) setTracking(false);
      });
    };

    const onMove = (event: PointerEvent) => {
      if (!event.isTrusted || cancelled) return;
      touched = true;
      const shifted = learn(event);
      const cursor = { x: event.clientX, y: event.clientY };
      const pose = gazePose(anchor(), cursor);
      const key = poseKey(pose);
      if (!shifted && key === bucket) return;
      bucket = key;
      show(pose);
      if (!cache.has(key)) capture(pose, cursor);
    };
    const onLeave = (event: PointerEvent) => {
      if (event.relatedTarget != null) return;
      onMove(event);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onLeave);

    void (async () => {
      for (const pose of POSES) {
        if (cancelled || touched) break;
        const gen = ++generation;
        aim(node, standForPose(STAGE, pose));
        document.dispatchEvent(new PointerEvent('pointermove', {
          clientX: STAGE.x,
          clientY: STAGE.y,
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
        }));
        const href = await settleAndShoot(gen);
        if (cancelled || touched || gen !== generation) break;
        if (href) cache.set(poseKey(pose), href);
      }
      if (cancelled || touched) return;
      finish();
      if (cache.size !== POSES.length) setTracking(false);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div aria-hidden="true" style={{ position: 'fixed', left: 0, top: 0, width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <div ref={mover}>
        <RobotHead size={SIZE} shape="square" color="#ed86b3" trimColor="#f4d3e3" screenColor="#ffffff" state="idle" paused={!tracking} antenna floorShadow />
      </div>
    </div>,
    document.body,
  );
}
