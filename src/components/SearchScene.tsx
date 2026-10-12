import { useEffect, useLayoutEffect, useRef } from 'react';
import type * as Three from 'three';
import type { AppSummary, FeatureMatch } from '../shared/types';
import { iconThumbnail } from '../lib/app-icons';
import { measureSearchCenter } from '../lib/scene-layout';

type IconApp = Pick<AppSummary, 'id' | 'name' | 'iconUrl'>;
export interface SearchSceneProps {
  apps: IconApp[];
  matches: FeatureMatch[];
  phase: 'searching' | 'settling';
  disabled: boolean;
  runId: number;
  onSettled: () => void;
}

type Runtime = { settle: (matches: FeatureMatch[]) => void; syncApps: (apps: IconApp[]) => void; dispose: () => void };
type IconMesh = Three.Mesh<Three.ShapeGeometry, Three.MeshBasicMaterial>;
type Particle = { app: IconApp; mesh: IconMesh; index: number; seed: number; size: number; opacity: number };
type HiddenIcon = { element: HTMLElement; visibility: string; priority: string; flightAttribute: string | null };
type Flight = {
  particle: Particle; target: HiddenIcon; x: number; y: number; z: number;
  width: number; height: number; rotation: Three.Euler; delay: number; finished: boolean;
};

/** A decorative scene only: results and their controls never wait for the canvas. */
export function SearchScene(props: SearchSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const latest = useRef(props);
  const settledRun = useRef<number | null>(null);
  latest.current = props;

  const notifySettled = () => {
    const current = latest.current;
    if (current.phase !== 'settling' || settledRun.current === current.runId) return;
    settledRun.current = current.runId;
    current.onSettled();
  };

  useLayoutEffect(() => {
    runtimeRef.current?.syncApps(props.apps);
    if (props.phase !== 'settling') return;
    // Cached results can beat the lazy import. In that case reveal them immediately.
    if (props.disabled || !runtimeRef.current) {
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      notifySettled();
    } else runtimeRef.current.settle(props.matches);
  }, [props.apps, props.phase, props.matches, props.disabled, props.runId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!canvas || props.disabled || motion.matches || settledRun.current === props.runId) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const run = props.runId;
    void import('three').then((THREE) => {
      if (cancelled || latest.current.disabled || settledRun.current === run || latest.current.runId !== run) return;
      let renderer: Three.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      } catch {
        notifySettled();
        return;
      }
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 1, 2500);
      camera.position.z = 1000;
      let width = window.innerWidth;
      let height = window.innerHeight;
      let units = 1;
      let layout = measureSearchCenter();
      let disposed = false;
      let frame = 0;
      let settlingAt: number | null = null;
      const started = performance.now();
      const textures = new Set<Three.Texture>();
      const textureByApp = new Map<string, Three.Texture | null>();
      const loadedApps = new Set<string>();
      const loadedAt = new Map<string, number>();
      const loadingImages = new Set<HTMLImageElement>();
      const particles: Particle[] = [];
      let initialAppCount: number | null = null;
      const flights: Flight[] = [];
      const driftFrom = new Map<Particle, Three.Vector3>();
      const driftOrigin = new THREE.Vector3();
      const hidden = new Set<HiddenIcon>();
      const temp = new THREE.Vector3();

      // Rounded geometry clips the actual texture; there is no square backing plane.
      const shape = new THREE.Shape();
      const r = 0.22;
      shape.moveTo(-0.5 + r, -0.5);
      shape.lineTo(0.5 - r, -0.5);
      shape.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
      shape.lineTo(0.5, 0.5 - r);
      shape.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5);
      shape.lineTo(-0.5 + r, 0.5);
      shape.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r);
      shape.lineTo(-0.5, -0.5 + r);
      shape.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
      const iconGeometry = new THREE.ShapeGeometry(shape, 8);
      const positions = iconGeometry.getAttribute('position');
      const uv = iconGeometry.getAttribute('uv');
      for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) + 0.5, positions.getY(i) + 0.5);

      const restore = (item: HiddenIcon) => {
        if (item.visibility) item.element.style.setProperty('visibility', item.visibility, item.priority);
        else item.element.style.removeProperty('visibility');
        if (item.flightAttribute === null) item.element.removeAttribute('data-flight-active');
        else item.element.setAttribute('data-flight-active', item.flightAttribute);
        hidden.delete(item);
      };
      const restoreAll = () => { for (const item of [...hidden]) restore(item); };
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        restoreAll();
        window.removeEventListener('resize', resize);
        window.removeEventListener('scroll', interruptFlight, true);
        document.removeEventListener('visibilitychange', visibilityChanged);
        motion.removeEventListener('change', motionChanged);
        canvas.removeEventListener('webglcontextlost', contextLost);
        for (const image of loadingImages) { image.onload = null; image.onerror = null; }
        loadingImages.clear();
        for (const particle of particles) particle.mesh.material.dispose();
        for (const texture of textures) texture.dispose();
        iconGeometry.dispose();
        scene.clear();
        renderer.clear();
        renderer.dispose();
        renderer.forceContextLoss();
        if (runtimeRef.current?.dispose === dispose) runtimeRef.current = null;
      };
      const finish = () => { dispose(); if (!cancelled && latest.current.runId === run) notifySettled(); };
      const measureAnchor = () => { layout = measureSearchCenter(); };
      const interruptFlight = () => { if (settlingAt !== null) finish(); else measureAnchor(); };
      const motionChanged = () => { if (motion.matches) { dispose(); notifySettled(); } };
      const contextLost = (event: Event) => { event.preventDefault(); dispose(); notifySettled(); };
      const resize = () => {
        if (settlingAt !== null) { finish(); return; }
        width = window.innerWidth;
        height = window.innerHeight;
        units = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z / Math.max(1, height);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        renderer.setSize(width, height, false);
        measureAnchor();
      };
      // Use a camera ray so a z=0 destination projects to the exact DOM rectangle.
      const atPixel = (x: number, y: number, z: number, output: Three.Vector3) => {
        output.set(x / width * 2 - 1, 1 - y / height * 2, 0.5).unproject(camera).sub(camera.position);
        output.multiplyScalar((z - camera.position.z) / output.z).add(camera.position);
      };
      const textureFor = (app: IconApp) => {
        if (textureByApp.has(app.id)) return textureByApp.get(app.id) ?? null;
        // Pending or failed artwork is invisible, never a substitute letter tile.
        textureByApp.set(app.id, null);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        loadingImages.add(image);
        image.onload = () => {
          loadingImages.delete(image);
          if (disposed || cancelled) return;
          const texture = new THREE.Texture(image);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          texture.needsUpdate = true;
          textures.add(texture);
          textureByApp.set(app.id, texture);
          loadedApps.add(app.id);
          loadedAt.set(app.id, performance.now());
          // Upload before a possible flight rather than on its first moving frame.
          try { renderer.initTexture(texture); } catch { /* A normal render can retry the upload. */ }
          for (const particle of particles) if (particle.app.id === app.id) {
            particle.mesh.material.map = texture;
            particle.mesh.material.needsUpdate = true;
          }
        };
        image.onerror = () => { loadingImages.delete(image); };
        if (app.iconUrl) image.src = iconThumbnail(app.iconUrl);
        else loadingImages.delete(image);
        return null;
      };
      const orbit = (particle: Particle, elapsed: number) => {
        const seed = particle.seed;
        // Interleave a fixed Fibonacci sphere so the first gallery icons are
        // distributed throughout its volume. New candidates never move old ones.
        const slot = (particle.index * 19 + 7) % 47;
        const latitude = 1 - 2 * (slot + 0.5) / 47;
        const ring = Math.sqrt(1 - latitude * latitude);
        const longitude = slot * Math.PI * (3 - Math.sqrt(5));
        const baseX = Math.cos(longitude) * ring;
        const baseZ = Math.sin(longitude) * ring;
        const yaw = 0.38 + elapsed * 0.14;
        const pitch = 0.24 + Math.sin(elapsed * 0.065) * 0.13;
        const roll = -0.1 + Math.sin(elapsed * 0.045) * 0.08;
        const rotatedX = baseX * Math.cos(yaw) + baseZ * Math.sin(yaw);
        const yawZ = -baseX * Math.sin(yaw) + baseZ * Math.cos(yaw);
        const rotatedY = latitude * Math.cos(pitch) - yawZ * Math.sin(pitch);
        const rotatedZ = latitude * Math.sin(pitch) + yawZ * Math.cos(pitch);
        const volumeRadius = 0.63 + seed * 0.36;
        const z = rotatedZ * volumeRadius * 260;
        const perspective = camera.position.z / (camera.position.z - z);
        const drift = seed * Math.PI * 2;
        const offsetX = (rotatedX * Math.cos(roll) - rotatedY * Math.sin(roll)) * volumeRadius * layout.orbitExtentX * 0.93 * perspective + Math.sin(elapsed * 0.22 + drift) * 5;
        const offsetY = (rotatedX * Math.sin(roll) + rotatedY * Math.cos(roll)) * volumeRadius * (layout.orbitExtentY - 28) * 0.93 * perspective + Math.cos(elapsed * 0.18 + drift) * 4;
        const x = layout.x + offsetX;
        const y = layout.y + offsetY;
        // Let the cloud pass softly behind the protected face area. Pushing
        // every hidden icon outward would collect them into an artificial ring.
        const iconHalf = particle.size * perspective * 0.6;
        const clearance = layout.robotSize / 2 + iconHalf + 4;
        const faceDistance = Math.max(Math.abs(offsetX), Math.abs(offsetY)) - clearance;
        const faceFade = THREE.MathUtils.smoothstep(faceDistance, 0, 22);
        const candidateCount = Math.max(0, particles.length - (initialAppCount ?? particles.length));
        const isCandidate = particle.index >= (initialAppCount ?? particles.length);
        const prominenceRank = isCandidate ? particle.index - (initialAppCount ?? 0) : candidateCount + particle.index;
        const densityFade = prominenceRank < (width <= 600 ? 18 : 26) ? 1 : 0.12;
        const galleryFade = candidateCount > 0 && !isCandidate ? 0.68 : 1;
        const depthFade = 0.35 + THREE.MathUtils.smoothstep(z, -250, 210) * 0.63;
        particle.opacity = depthFade * faceFade * densityFade * galleryFade;
        // Unprojection preserves this depth-aware pixel layout while actual
        // geometry depth still changes icon scale and overlap in the renderer.
        atPixel(x, y, z, particle.mesh.position);
        particle.mesh.scale.setScalar(particle.size * units);
        particle.mesh.rotation.set(Math.sin(elapsed * 0.11 + drift) * 0.13, Math.cos(elapsed * 0.12 + drift) * 0.2, Math.sin(elapsed * 0.1 + drift) * 0.14);
      };
      const addParticle = (app: IconApp, source?: Particle) => {
        const index = particles.length;
        const material = new THREE.MeshBasicMaterial({ map: textureFor(app), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        const mesh = new THREE.Mesh(iconGeometry, material);
        const particle: Particle = { app, mesh, index, seed: ((index + 1) * 0.61803398875) % 1, size: 20 + ((index + 1) * 0.41421356237 % 1) * 11, opacity: 0 };
        particles.push(particle);
        scene.add(mesh);
        if (source) { mesh.position.copy(source.mesh.position); mesh.rotation.copy(source.mesh.rotation); mesh.scale.copy(source.mesh.scale); }
        else orbit(particle, (performance.now() - started) / 1000);
        return particle;
      };
      const syncApps = (apps: IconApp[]) => {
        if (disposed || settlingAt !== null) return;
        initialAppCount ??= Math.min(apps.length, 46);
        for (const app of apps) {
          if (particles.some((particle) => particle.app.id === app.id)) continue;
          // Parent merges gallery icons with the current query's actual candidates.
          // Existing positions are preserved while each new candidate preloads now.
          if (particles.length >= 46) break;
          addParticle(app);
        }
      };
      const settle = (matches: FeatureMatch[]) => {
        if (disposed || settlingAt !== null) return;
        atPixel(layout.x, layout.y, 0, driftOrigin);
        driftFrom.clear();
        for (const particle of particles) driftFrom.set(particle, particle.mesh.position.clone());
        settlingAt = performance.now();
        if (!matches.length) return;
        const destinations = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-flight-id]')).map((element) => [element.dataset.flightId, element]));
        const used = new Set<Particle>();
        for (const match of matches) {
          const element = destinations.get(match.id);
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) continue;
          const existing = particles.find((particle) => particle.app.id === match.app.id);
          const particle = existing && !used.has(existing) ? existing : addParticle(match.app, existing);
          used.add(particle);
          // Never replace a real DOM icon with a letter placeholder mid-flight.
          // A late or CORS-blocked image leaves the result visible immediately.
          if (!loadedApps.has(match.app.id)) continue;
          const projected = particle.mesh.position.clone().project(camera);
          const perspective = camera.position.z / (camera.position.z - particle.mesh.position.z);
          const target: HiddenIcon = { element, visibility: element.style.getPropertyValue('visibility'), priority: element.style.getPropertyPriority('visibility'), flightAttribute: element.getAttribute('data-flight-active') };
          hidden.add(target);
          element.style.visibility = 'hidden';
          element.setAttribute('data-flight-active', 'true');
          flights.push({ particle, target, x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2, z: particle.mesh.position.z,
            width: particle.mesh.scale.x / units * perspective, height: particle.mesh.scale.y / units * perspective,
            rotation: particle.mesh.rotation.clone(), delay: Math.min(flights.length * 10, 60), finished: false });
          particle.mesh.renderOrder = 10;
          particle.mesh.material.depthTest = false;
        }
      };
      const tick = (now: number) => {
        if (disposed) return;
        const elapsed = (now - started) / 1000;
        if (settlingAt === null) {
          for (const particle of particles) {
            orbit(particle, elapsed);
            const imageEntrance = Math.min(1, (now - (loadedAt.get(particle.app.id) ?? now)) / 180);
            particle.mesh.material.opacity = loadedApps.has(particle.app.id) ? particle.opacity * imageEntrance : 0;
          }
        } else {
          const time = now - settlingAt;
          const escape = Math.min(1, time / 700);
          const flightParticles = new Set(flights.map((flight) => flight.particle));
          for (const particle of particles) if (!flightParticles.has(particle)) {
            const home = driftFrom.get(particle);
            if (home) {
              particle.mesh.position.copy(home).sub(driftOrigin).multiplyScalar(1 + escape * 2.6).add(driftOrigin);
              particle.mesh.position.y += escape * 90;
            }
            particle.mesh.material.opacity = loadedApps.has(particle.app.id) ? particle.opacity * (1 - escape) : 0;
          }
          // Read all rectangles before writing any visibility changes.
          const rectangles = flights.map((flight) => flight.target.element.getBoundingClientRect());
          flights.forEach((flight, index) => {
            if (flight.finished) return;
            const rect = rectangles[index];
            if (!flight.target.element.isConnected || !rect.width || !rect.height) {
              flight.particle.mesh.visible = false; flight.finished = true; restore(flight.target); return;
            }
            const p = Math.max(0, Math.min(1, (time - flight.delay) / 510));
            const eased = 1 - (1 - p) ** 3;
            const x = flight.x + (rect.left + rect.width / 2 - flight.x) * eased;
            const y = flight.y + (rect.top + rect.height / 2 - flight.y) * eased - Math.sin(p * Math.PI) * 25;
            const z = flight.z * (1 - eased);
            atPixel(x, y, z, temp);
            flight.particle.mesh.position.copy(temp);
            const depthUnits = units * (camera.position.z - z) / camera.position.z;
            flight.particle.mesh.scale.set((flight.width + (rect.width - flight.width) * eased) * depthUnits, (flight.height + (rect.height - flight.height) * eased) * depthUnits, 1);
            flight.particle.mesh.rotation.set(flight.rotation.x * (1 - eased), flight.rotation.y * (1 - eased), flight.rotation.z * (1 - eased));
            flight.particle.mesh.material.opacity = 1;
            if (p >= 1) { flight.particle.mesh.visible = false; flight.finished = true; restore(flight.target); }
          });
          if ((escape >= 1 && flights.every((flight) => flight.finished)) || time >= 980) { finish(); return; }
        }
        try { renderer.render(scene, camera); } catch { finish(); return; }
        frame = requestAnimationFrame(tick);
      };
      const visibilityChanged = () => {
        if (document.hidden) { if (settlingAt !== null) finish(); else cancelAnimationFrame(frame); }
        else if (!disposed) { cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); }
      };
      resize();
      syncApps(latest.current.apps);
      runtimeRef.current = { settle, syncApps, dispose };
      cleanup = dispose;
      window.addEventListener('resize', resize, { passive: true });
      window.addEventListener('scroll', interruptFlight, { passive: true, capture: true });
      document.addEventListener('visibilitychange', visibilityChanged);
      motion.addEventListener('change', motionChanged);
      canvas.addEventListener('webglcontextlost', contextLost);
      if (latest.current.phase === 'settling') settle(latest.current.matches);
      if (!disposed) frame = requestAnimationFrame(tick);
    }).catch(() => { if (!cancelled && latest.current.runId === run) notifySettled(); });
    return () => { cancelled = true; cleanup?.(); };
  }, [props.runId, props.disabled]);

  return <canvas ref={canvasRef} aria-hidden="true" data-search-scene="three" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 30, display: props.disabled ? 'none' : 'block' }} />;
}
