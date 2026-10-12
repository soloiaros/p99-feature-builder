import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowDownToLine, ArrowRight, Check, Copy, FileText, LoaderCircle, Package, RotateCcw, X } from 'lucide-react';
import { strToU8, zipSync } from 'fflate';
import type { BriefResponse, FeatureMatch } from '../shared/types';
import './FeatureDocument.css';

const filename = (value: string) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'feature'}.md`;
const layoutId = (id: string) => `feature-document-${id}`;

export function DocumentTrigger({ match, onOpen, disabled, isOpen = false }: {
  match: FeatureMatch;
  onOpen: () => void;
  disabled?: boolean;
  isOpen?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      className="document-trigger"
      layoutId={reducedMotion ? undefined : layoutId(match.id)}
      onClick={onOpen}
      disabled={disabled}
      aria-label={`Steal the feature: ${match.feature.name}`}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      data-document-trigger={match.id}
      data-document-open={isOpen || undefined}
      style={{ borderRadius: 16 }}
      whileHover={reducedMotion || isOpen ? undefined : { y: -8, rotate: -2, transition: { type: 'spring', stiffness: 420, damping: 24 } }}
      whileTap={reducedMotion || isOpen ? undefined : { y: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      <span className="document-trigger-chrome" aria-hidden="true">
        <span className="document-mini-lights"><i /><i /><i /></span>
        <span className="document-mini-filename">{filename(match.feature.name)}</span>
      </span>
      <span className="document-trigger-paper" aria-hidden="true">
        <span className="document-mini-title" />
        <span className="document-mini-line" /><span className="document-mini-line" />
        <span className="document-mini-line short" />
        <span className="document-mini-flow"><i /><b /><i /><b /><i /></span>
      </span>
      <span className="document-trigger-label">Steal the feature <ArrowRight size={13} /></span>
    </motion.button>
  );
}

/** Markdown is rendered as React text nodes. HTML and non-web link protocols never execute. */
function inline(text: string): ReactNode[] {
  const pattern = /(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*\n]+\*\*|`[^`\n]+`|~~[^~\n]+~~|\*[^*\n]+\*)/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <s key={index}>{part.slice(2, -2)}</s>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}
