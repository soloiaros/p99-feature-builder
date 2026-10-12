import type { BriefResponse, BriefSection, Feature, FeatureMatch, Project } from '../src/shared/types';
import { capturedAt } from './catalog';
import { featureDefinition } from './features';

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join('\n');
const numbered = (items: string[]) => items.map((item, i) => `${i + 1}. ${item}`).join('\n');
const safeText = (value: string) => value.replace(/[<>`]/g, '').replace(/[\r\n]+/g, ' ').trim();
const xml = (value: string) => value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);
