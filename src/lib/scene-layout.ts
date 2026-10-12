export interface SearchCenter {
  /** Center in viewport pixels, shared by the DOM robot and WebGL icons. */
  x: number;
  y: number;
  /** Horizontal icon-center radius and total vertical artwork radius. */
  orbitExtentX: number;
  orbitExtentY: number;
  robotSize: number;
}

/** Measure the stable outer dock, never its animated query-card child. */
export function measureSearchCenter(): SearchCenter {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const mobile = width <= 600;
  const dockBottom = document.querySelector('.query-dock')?.getBoundingClientRect().bottom ?? 200;
  const orbitExtentY = mobile ? 120 : 160;
  const desired = dockBottom + (mobile ? 160 : 230);
  return {
    x: width / 2,
    // On a short viewport, preserving query clearance wins over fitting an
    // entire search stage. Ordinary viewports retain a bottom margin too.
    y: Math.max(dockBottom + orbitExtentY + 24, Math.min(desired, height - orbitExtentY - 24)),
    orbitExtentX: Math.min(mobile ? 145 : 260, Math.max(70, width / 2 - 44)),
    orbitExtentY,
    robotSize: mobile ? 86 : 108,
  };
}
