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
