import { describe, expect, it } from 'vitest';
import {
  chromeCrossingX, gazePose, nearestReady, standForPose, tabAnchorInViewport, warmPoses,
} from '../src/lib/favicon-gaze';

const windowMetrics = { screenX: 0, screenY: 0, outerHeight: 900, innerHeight: 800, innerWidth: 1200, mac: true };

describe('favicon gaze', () => {
  it('starts in the first tab slot and then uses a learned column', () => {
    expect(tabAnchorInViewport(windowMetrics).x).toBe(112);
    expect(tabAnchorInViewport(windowMetrics, 640).x).toBe(640);
    expect(tabAnchorInViewport({ ...windowMetrics, mac: false }).x).toBe(46);
    expect(tabAnchorInViewport(windowMetrics).y).toBe(22 - 100);
  });

  it('reads the tab column from the pointer meeting the top of the window', () => {
    expect(chromeCrossingX(-4, 0, 710)).toBe(710);
    expect(chromeCrossingX(3, -6, 540)).toBe(540);
    expect(chromeCrossingX(80, -12, 540)).toBeNull();
    expect(chromeCrossingX(4, 2, 540)).toBeNull();
  });

  it('looks left of a tab that sits on the right, and right of one on the left', () => {
    const cursor = { x: 360, y: 420 };
    const rightTab = gazePose({ x: 860, y: -40 }, cursor);
    const leftTab = gazePose({ x: 112, y: -40 }, cursor);
    expect(rightTab.yaw).toBeLessThan(0);
    expect(leftTab.yaw).toBeGreaterThan(0);
  });

  it('crooks further down as the pointer moves down the page', () => {
    const tab = { x: 480, y: -60 };
    const near = gazePose(tab, { x: 480, y: 80 });
    const mid = gazePose(tab, { x: 480, y: 360 });
    const far = gazePose(tab, { x: 480, y: 980 });
    expect(near.dip).toBeLessThan(mid.dip);
    expect(mid.dip).toBeLessThan(far.dip);
    expect(near.yaw).toBe(0);
  });

  it('prepares a distinct pose for every yaw and dip', () => {
    const poses = warmPoses();
    const keys = new Set(poses.map(pose => `${pose.yaw}:${pose.dip}`));
    expect(keys.size).toBe(poses.length);
    expect(poses.length).toBeGreaterThan(8);
    const cursor = { x: 0, y: 0 };
    for (const pose of poses) {
      const stand = standForPose(cursor, pose);
      expect(gazePose(stand, cursor)).toEqual(pose);
    }
  });

  it('falls back to the closest pose already drawn', () => {
    const ready = [{ yaw: 0, dip: 420 }, { yaw: -200, dip: 780 }];
    expect(nearestReady({ yaw: 35, dip: 780 }, ready)).toEqual({ yaw: 0, dip: 420 });
    expect(nearestReady({ yaw: -200, dip: 160 }, ready)).toEqual({ yaw: -200, dip: 780 });
  });
});