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
