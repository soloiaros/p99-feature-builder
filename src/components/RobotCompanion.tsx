import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from 'motion/react';
import { RobotHead, type RobotHeadState } from 'robot-heads';
import { measureSearchCenter } from '../lib/scene-layout';

type Stage = 'home' | 'analyzing' | 'matching' | 'results';

export interface RobotCompanionProps {
  stage: Stage;
  hasInput: boolean;
  hasError: boolean;
  working: boolean;
  paused: boolean;
  onActivate: () => void;
}

type Destination = { x: number; y: number; scale: number };

// Keep the canvas and its baked artwork at one size. Only the outer transform
// changes, so moving between the header and search does not recreate textures.
const CANVAS_SIZE = 160;
const travel = { type: 'spring' as const, stiffness: 240, damping: 27, mass: .8 };

function destination(stage: Stage): Destination | null {
  if (stage === 'analyzing' || stage === 'matching') {
    const center = measureSearchCenter();
    return {
      x: center.x + window.scrollX - CANVAS_SIZE / 2,
      y: center.y + window.scrollY - CANVAS_SIZE / 2,
      scale: center.robotSize / CANVAS_SIZE,
    };
  }

  const dock = document.querySelector<HTMLElement>('[data-robot-dock]');
  if (!dock) return null;
  const rect = dock.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: rect.left + rect.width / 2 + window.scrollX - CANVAS_SIZE / 2,
    y: rect.top + rect.height / 2 + window.scrollY - CANVAS_SIZE / 2,
    scale: Math.min(rect.width, rect.height) / CANVAS_SIZE,
  };
}
