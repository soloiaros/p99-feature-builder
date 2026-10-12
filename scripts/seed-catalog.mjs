/** Refresh a small US App Store corpus from Apple's public feeds. Node 20+. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const catalogPath = fileURLToPath(new URL('../data/catalog.json', import.meta.url));
const limit = Math.max(18, Math.min(3000, Number(process.env.CATALOG_LIMIT) || 1000));
const demoIds = [570060128, 963034692, 1528595748, 866450515, 493145008, 571800810,
  426826309, 387771637, 341232718, 572688855, 626144601, 1232780281, 1016366447,
  1010865877, 1454778585, 1523682319, 1499198946, 1458862350];
const genres = [
  [6013, 'Health & Fitness'], [6007, 'Productivity'], [6017, 'Education'],
  [6012, 'Lifestyle'], [6015, 'Finance'], [6011, 'Music'], [6008, 'Photo & Video'],
  [6005, 'Social Networking'], [6003, 'Travel'], [6023, 'Food & Drink'],
];
const featurePatterns = [
  ['streaks', /\bstreaks?\b/i],
  ['widgets', /\bwidgets?\b/i],
  ['onboarding', /\bonboarding\b|\b(personality|assessment|personalization|personalisation|initial|short|quick) (quiz|questionnaire|assessment)\b|\bpersonalized (plan|program)\b/i],
  ['reminders', /\breminders?\b|\breminds? you\b|\b(push|custom|smart|scheduled|rich) notifications?\b/i],
  ['progress', /\b(progress tracking|track your progress|track your exercise progress|visualize progress|progress charts?|progress graphs?|progress reports?|goal tracking|goal tracker)\b/i],
  ['social', /\b(leaderboards?|community challenges|follow your friends?|share your tasks|shared focus|share.*with friends|co-plant|social feed|group challenges)\b/i],
  ['gamification', /\b(gamif\w*|achievements?|earn rewards|playful rewards|unlock.*rewards|earn.*badges|collect.*characters)\b/i],
  ['insights', /\b(analytics|insights|statistics|detailed stats|monthly recaps|muscle group graphs|activity.*charts)\b/i],
  ['focus', /\b(focus timer|pomodoro|focus sessions?|block distracting|app blocker|distraction blocker|screen time limits?)\b/i],
  ['logging', /\b(log your|log workouts?|food logging|food diary|journaling|mood tracker|water log|logs calendar|record daily|habit tracker|workout tracker|track calories)\b/i],
  ['personalization', /\b(personalized|personalised|customizable|customisable|personalize your|personalise your|custom themes?|color themes?|customize.*appearance)\b/i],
  ['offline', /\b(offline|without (an? )?internet|no internet required)\b/i],
  ['search', /\b(search your|search for text|full.text search|powerful search|search notes|search filters|search.*library)\b/i],
  ['sync', /\b(syncs?|synchroni[sz]\w*|real.time updates between devices)\b/i],
  ['subscriptions', /\b(subscriptions?|monthly.*annual|premium.*plan)\b/i],
];

// A match is an auditable retrieval hint, never independent proof of product quality.
function enrich(app) {
  const text = app.description || '';
  const features = [];
  for (const [id, pattern] of featurePatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const matchAt = match.index;
    const previousBreak = Math.max(text.lastIndexOf('\n', matchAt), text.lastIndexOf('. ', matchAt));
    const start = Math.max(previousBreak < 0 ? 0 : previousBreak + 1, matchAt - 150);
    const nextBreaks = [text.indexOf('\n', matchAt + match[0].length), text.indexOf('. ', matchAt + match[0].length)].filter(x => x >= 0);
    const end = Math.min(nextBreaks.length ? Math.min(...nextBreaks) + 1 : text.length, matchAt + match[0].length + 250);
    features.push({ id, evidence: text.slice(start, end).trim(), confidence: 'medium',
      sourceUrl: app.metadataSource, method: 'description-keyword-v1', tier: 'estimated' });
  }
  return { ...app, features };
}
