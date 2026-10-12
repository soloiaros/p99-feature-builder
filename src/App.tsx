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
