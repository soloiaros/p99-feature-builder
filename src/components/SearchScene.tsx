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
