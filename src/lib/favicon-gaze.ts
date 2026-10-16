export interface Point { x: number; y: number }

export interface WindowMetrics {
  screenX: number;
  screenY: number;
  outerHeight: number;
  innerHeight: number;
  innerWidth?: number;
  mac: boolean;
}

export interface GazePose { yaw: number; dip: number }

const TAB_ROW = 22;
const MAC_TAB_ICON = 112;
const OTHER_TAB_ICON = 46;

/** Horizontal look, in pointer pixels. Negative is left of the tab. */
export const YAW_STEPS = [-200, -100, -35, 0, 35, 100, 200] as const;

/** How far below the tab the pointer is. Larger values crook the head further down. */
export const DIP_STEPS = [160, 420, 780] as const;

export function defaultTabX(metrics: WindowMetrics): number {
  return metrics.mac ? MAC_TAB_ICON : OTHER_TAB_ICON;
}

export function clampTabX(x: number, innerWidth = 1280): number {
  const max = Math.max(48, innerWidth - 28);
  return Math.min(max, Math.max(28, x));
}

/** The active tab's icon, in viewport coordinates.
 *
 * Nothing on the page can read the tab strip. Until the pointer meets the
 * top of the window, the icon is assumed to be the first slot. A learned
 * `x` is the column where the pointer entered the chrome, which is the tab.
 */
export function tabAnchorInViewport(metrics: WindowMetrics, learnedX?: number | null): Point {
  const chrome = Math.max(0, metrics.outerHeight - metrics.innerHeight);
  const x = learnedX == null ? defaultTabX(metrics) : clampTabX(learnedX, metrics.innerWidth);
  return { x, y: TAB_ROW - chrome };
}

/** The pointer's x when it is moving into the tab strip, otherwise null. */
export function chromeCrossingX(y: number, movementY: number, x: number): number | null {
  if (y <= 0) return x;
  if (y <= 8 && movementY < 0) return x;
  return null;
}

function nearestStep(value: number, steps: readonly number[]): number {
  let best = steps[0];
  let bestDist = Infinity;
  for (const step of steps) {
    const dist = Math.abs(value - step);
    if (dist < bestDist) {
      bestDist = dist;
      best = step;
    }
  }
  return best;
}

/** Yaw from the tab, plus how far down the page the pointer is. */
export function gazePose(origin: Point, cursor: Point): GazePose {
  return {
    yaw: nearestStep(cursor.x - origin.x, YAW_STEPS),
    dip: nearestStep(Math.max(0, cursor.y - origin.y), DIP_STEPS),
  };
}

export function poseKey(pose: GazePose): string {
  return `${pose.yaw}:${pose.dip}`;
}

/** Place the head so the pointer sits at this yaw and dip from its center. */
export function standForPose(cursor: Point, pose: GazePose): Point {
  return { x: cursor.x - pose.yaw, y: cursor.y - pose.dip };
}

/** Medium crook first, then the deeper one, then the glance just under the tab. */
export function warmPoses(): GazePose[] {
  const dips = [420, 780, 160];
  const yaws = [0, -35, 35, -100, 100, -200, 200];
  const poses: GazePose[] = [];
  for (const dip of dips) for (const yaw of yaws) poses.push({ yaw, dip });
  return poses;
}

export function nearestReady(target: GazePose, ready: GazePose[]): GazePose | null {
  let best: GazePose | null = null;
  let bestScore = Infinity;
  for (const pose of ready) {
    const score = Math.abs(pose.yaw - target.yaw) / 35 + Math.abs(pose.dip - target.dip) / 260;
    if (score < bestScore) {
      bestScore = score;
      best = pose;
    }
  }
  return best;
}
