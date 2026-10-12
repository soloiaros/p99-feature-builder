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
