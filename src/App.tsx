import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, CircleHelp, Plus, SlidersHorizontal, Star, X } from 'lucide-react';
import { SearchScene } from './components/SearchScene';
import { RobotCompanion } from './components/RobotCompanion';
import { FeaturePicker } from './components/FeaturePicker';
import { DocumentTrigger, FeatureDocument } from './components/FeatureDocument';
import { iconThumbnail } from './lib/app-icons';
import type { AnalyzeResponse, AppSummary, BriefResponse, CatalogResponse, Feature, FeatureMatch, MatchResponse, Project, ProjectProfile } from './shared/types';

type Stage = 'home' | 'analyzing' | 'matching' | 'results';
type SavedProject = { id: string; project: Project; features?: Feature[]; matches: FeatureMatch[]; savedAt: string; mode: string };

async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal });
  const data = await response.json() as T & { error?: string | { message?: string }; message?: string };
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'The request failed. Try again.');
  return data;
}
function loadSaved(): SavedProject[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('p99-projects') || localStorage.getItem('borrow-projects') || '[]');
    return Array.isArray(raw) ? raw.filter(item => item?.project?.name && Array.isArray(item?.matches)).slice(0, 12) : [];
  } catch { return []; }
}
function AppIcon({ app, flightId }: { app: Pick<AppSummary, 'id' | 'name' | 'iconUrl'>; flightId?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="app-icon" data-flight-id={flightId}>{!failed && app.iconUrl ? <img src={iconThumbnail(app.iconUrl)} alt={`${app.name} icon`} onError={() => setFailed(true)} /> : <span>{app.name.slice(0, 1)}</span>}</div>;
}
function Evidence({ match }: { match: FeatureMatch }) {
  return <details className="reference-evidence"><summary>Why this app <ChevronDown size={13} /></summary><div className="evidence-body">
    <p>{match.confidenceDetail}</p>
    {match.evidence.map((item, i) => <blockquote key={i}><p>{item.statement}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel} <ArrowUpRight size={12} /></a><time>{item.asOf}</time></blockquote>)}
    <div className="evidence-metrics">{match.stats.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.status}</small></div>)}</div>
    <p className="evidence-footnote">The rating is the app's public App Store score on the date in the sources.</p>
  </div></details>;
}
