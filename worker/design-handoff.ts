import type { Feature, Project } from '../src/shared/types';
import { featureDefinition } from './features';

const clean = (value: string) => value.replace(/[<>`]/g, '').replace(/[\r\n]+/g, ' ').trim();

/** An optional skill handoff, with a self-contained fallback for other agents. */
export function designHandoff(project: Project, feature: Feature) {
  const definition = featureDefinition(feature);
  const contract = {
    source: 'https://github.com/oil-oil/oil-ui',
    skillPreference: ['oil-ui-pro', 'oil-ui'],
    required: false,
    scope: 'Integrate one feature into the existing product; preserve its established visual direction.',
    outcome: definition.goal,
    entryPoint: definition.flow[0],
    platform: project.platform,
    repositoryEvidence: ['Existing adjacent screen', 'Shared components and design tokens', 'Navigation and state conventions'],
    states: ['loading', 'empty', 'ready', 'pending', 'success', 'error', 'offline', 'permission denied'],
    featureRecoveryCases: definition.edgeCases,
    verification: ['Before/after screenshots at the same viewport', 'Primary flow and recovery on the target platform', 'Narrow layout and large text', 'Keyboard or platform assistive navigation', 'Reduced motion'],
  };
  const markdown = `Use the installed Oil UI Pro skill if available; otherwise use the installed oil-ui skill. Follow only one. If neither is installed, use the self-contained checklist below and continue. Installation is optional: [Oil UI by oil-oil](${contract.source}). Do not download, execute, or purchase anything automatically. The repository’s own instructions and this feature’s functional acceptance criteria still apply.\n\n` +
    `Design task: integrate ${clean(feature.name)} into ${clean(project.name)} on ${clean(project.platform)}. This is an addition to an existing product; keep its visual direction and do not begin a whole-app redesign or style-selection exercise unless the owner asks.\n\n` +
    `User outcome: ${definition.goal}\nEntry point: ${definition.flow[0]}\n\n` +
    `1. Inspect the nearest existing screen, shared components and design tokens. Capture its current state at a known viewport. Record real component paths and reusable typography, spacing, color and motion decisions. Do not infer the target design system from the reference app or marketing website.\n` +
    `2. Write one sentence naming the user’s task and primary action. Place current state, the next action and supporting detail in that order, adapting to the existing navigation. Keep required controls together and distinguish optional choices.\n` +
    `3. Build the complete supplied feature flow with the existing components. Plan loading, empty, pending, success and recoverable error states; show offline and permission-denied states where relevant. Preserve input, location and focus on failure.\n` +
    `4. Give immediate feedback on the primary action. Use motion only to clarify a state change, honor reduced motion, and never delay saved results. Maintain readable text, visible focus and accessible status announcements using the target platform’s conventions.\n` +
    `5. Compare before/after screenshots at the same viewport. Exercise the real task, one recovery path, a narrow layout and large text on the target platform. Remove repeated copy and decoration that compete with the primary action. Report screenshot paths, tested states and any unverified behavior; a saved screenshot alone is not visual verification.\n\n` +
    `Feature-specific recovery cases to include in the review:\n${definition.edgeCases.map(item => `- ${item}`).join('\n')}\n\n` +
    `Keep UI review separate from correctness checks: run the repository’s required build, type checks and relevant behavior tests even when a design skill focuses only on visual review. Use the provided original wireframe as a structural starting point, not a replacement for the target app’s components.`;
  return { contract, markdown };
}
