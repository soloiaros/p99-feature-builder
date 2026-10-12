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

/** One persistent companion canvas, moving between a real header dock and search. */
export function RobotCompanion({ stage, hasInput, hasError, working, paused, onActivate }: RobotCompanionProps) {
  const reducedMotion = useReducedMotion();
  const location = stage === 'analyzing' || stage === 'matching' ? 'search' : stage;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(60 / CANVAS_SIZE);
  const opacity = useMotionValue(0);
  const latestStage = useRef(stage);
  const latestReducedMotion = useRef(reducedMotion);
  const lastDestination = useRef<Destination | null>(null);
  const animations = useRef<AnimationPlaybackControls[]>([]);
  const [arriving, setArriving] = useState(false);
  const [keyboardReaction, setKeyboardReaction] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestStage.current = stage;
  latestReducedMotion.current = reducedMotion;

  const stopTravel = () => {
    for (const animation of animations.current) animation.stop();
    animations.current = [];
  };

  const place = (animateTravel: boolean) => {
    // Read the current stage here: a queued resize must never remeasure the
    // busy center from the query after results have begun their arrival.
    const target = destination(latestStage.current);
    if (!target) return;
    const previous = lastDestination.current;
    if (!latestReducedMotion.current && previous && Math.abs(previous.x - target.x) < .25 && Math.abs(previous.y - target.y) < .25 && Math.abs(previous.scale - target.scale) < .001) return;
    lastDestination.current = target;
    stopTravel();
    opacity.set(1);
    if (!previous || !animateTravel || latestReducedMotion.current) {
      x.set(target.x);
      y.set(target.y);
      scale.set(target.scale);
      return;
    }
    animations.current = [
      animate(x, target.x, travel),
      animate(y, target.y, travel),
      animate(scale, target.scale, travel),
    ];
  };

  useLayoutEffect(() => {
    place(true);
    // Only stage transitions travel. Resize and scroll measurements snap to
    // their new geometry without lag or a React update on every frame.
    const updateGeometry = () => place(false);
    const observer = new ResizeObserver(updateGeometry);
    for (const selector of ['[data-robot-dock]', '.site-header', '.query-dock']) {
      const element = document.querySelector(selector);
      if (element) observer.observe(element);
    }
    window.addEventListener('resize', updateGeometry, { passive: true });
    window.addEventListener('scroll', updateGeometry, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', updateGeometry, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateGeometry);
      window.removeEventListener('scroll', updateGeometry, true);
      window.visualViewport?.removeEventListener('resize', updateGeometry);
    };
  }, [location, reducedMotion]);

  useEffect(() => {
    if (stage !== 'results') {
      setArriving(false);
      return;
    }
    setArriving(true);
    const timer = setTimeout(() => setArriving(false), 1500);
    return () => clearTimeout(timer);
  }, [stage]);

  useEffect(() => () => {
    stopTravel();
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
  }, []);

  const activate = (event: MouseEvent<HTMLButtonElement>) => {
    // Pointer clicks reach RobotHead's own span and retain its native hop/spin.
    // Keyboard clicks target this button, so give them the same happy response.
    if (event.detail === 0) {
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
      setKeyboardReaction(true);
      reactionTimer.current = setTimeout(() => setKeyboardReaction(false), 850);
    }
    onActivate();
  };

  let state: RobotHeadState = 'idle';
  if (keyboardReaction) state = 'happy';
  else if (hasError) state = 'error';
  else if (working) state = 'working';
  else if (stage === 'analyzing') state = 'thinking';
  else if (stage === 'matching') state = 'searching';
  else if (stage === 'home' && hasInput) state = 'listening';
  else if (stage === 'results' && arriving) state = 'happy';

  const busy = stage === 'analyzing' || stage === 'matching';
  const label = busy
    ? `p99 companion, ${stage === 'analyzing' ? 'thinking' : 'searching'}. Say hello.`
    : stage === 'results' ? 'p99 companion. Start a new search.' : 'p99 companion. Focus your app idea.';

  return <motion.button
    type="button"
    className="robot-companion"
    data-robot-companion="true"
    data-robot-state={state}
    aria-label={label}
    onClick={activate}
    style={{
      position: 'absolute', top: 0, left: 0, zIndex: 31,
      width: CANVAS_SIZE, height: CANVAS_SIZE, minHeight: 0, padding: 0,
      border: 0, background: 'transparent', boxShadow: 'none', overflow: 'visible',
      transformOrigin: '50% 50%', transition: 'none', x, y, scale, opacity,
    }}
  >
    <RobotHead
      size={CANVAS_SIZE}
      shape="square"
      color="#ed86b3"
      trimColor="#f4d3e3"
      screenColor="#ffffff"
      state={state}
      paused={paused || !!reducedMotion}
      interactive
      floorShadow
      antenna={stage !== 'results'}
      aria-hidden="true"
    />
  </motion.button>;
}
