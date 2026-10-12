import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowDownToLine, ArrowRight, Check, Copy, FileText, LoaderCircle, Package, RotateCcw, X } from 'lucide-react';
import { strToU8, zipSync } from 'fflate';
import type { BriefResponse, FeatureMatch } from '../shared/types';
import './FeatureDocument.css';

const filename = (value: string) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'feature'}.md`;
const layoutId = (id: string) => `feature-document-${id}`;
