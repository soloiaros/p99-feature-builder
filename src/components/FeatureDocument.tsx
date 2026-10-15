import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDownToLine, ArrowRight, Check, Copy, FileText, LoaderCircle, Package, RotateCcw, X } from 'lucide-react';
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

function MarkdownDocument({ brief }: { brief: BriefResponse }) {
  // The viewer, clipboard and download all use exactly the same source.
  return <pre className="document-source" tabIndex={0} aria-label="Markdown source"><code>{brief.markdown}</code></pre>;
}

function downloadBrief(brief: BriefResponse, name: string, kind: 'md' | 'zip') {
  let blob: Blob;
  if (kind === 'zip') {
    const files: Record<string, Uint8Array> = {};
    for (const file of brief.files) files[file.name.replace(/[^a-zA-Z0-9._-]/g, '-')] = strToU8(file.content);
    if (!Object.keys(files).length) files['feature-brief.md'] = strToU8(brief.markdown);
    blob = new Blob([new Uint8Array(zipSync(files))], { type: 'application/zip' });
  } else blob = new Blob([brief.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = kind === 'md' ? filename(name) : filename(name).replace(/\.md$/, '.zip');
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

type PreviewProps = {
  match: FeatureMatch | null;
  brief: BriefResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onToast?: (message: string) => void;
};

function PreviewWindow({ match, brief, loading, error, onClose, onRetry, onToast }: PreviewProps & { match: FeatureMatch }) {
  const reducedMotion = useReducedMotion();
  const windowRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeHandler = useRef(onClose);
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');
  closeHandler.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const origin = [...document.querySelectorAll<HTMLButtonElement>('[data-document-trigger]')].find((element) => element.dataset.documentTrigger === match.id);
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    if (root) root.inert = true;
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeHandler.current(); return; }
      if (event.key !== 'Tab' || !windowRef.current) return;
      const focusable = [...windowRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); windowRef.current.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !windowRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !windowRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (root) root.inert = previousInert ?? false;
      document.removeEventListener('keydown', onKeyDown);
      const restoreTarget = origin?.isConnected ? origin : previousFocus;
      if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copy() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief.markdown);
      setCopied(true);
      setActionError('');
      onToast?.('Brief copied. Your editor awaits.');
    } catch { setActionError('Copy failed. Download the Markdown file instead.'); }
  }

  function download(kind: 'md' | 'zip') {
    if (!brief) return;
    try { downloadBrief(brief, match.feature.name, kind); setActionError(''); }
    catch { setActionError('The download did not start. Try again.'); }
  }

  return (
    <motion.div
      className="feature-document-overlay"
      initial={{ backgroundColor: 'rgba(252,252,252,0)', backdropFilter: 'blur(0px)' }}
      animate={{ backgroundColor: 'rgba(252,252,252,0.16)', backdropFilter: 'blur(6px)' }}
      exit={{ backgroundColor: 'rgba(252,252,252,0)', backdropFilter: 'blur(0px)' }}
      transition={{ duration: reducedMotion ? 0 : 0.28 }}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        ref={windowRef}
        className="feature-document-window"
        layoutId={reducedMotion ? undefined : layoutId(match.id)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ borderRadius: 16 }}
        initial={reducedMotion ? { opacity: 0 } : undefined}
        animate={reducedMotion ? { opacity: 1 } : undefined}
        exit={reducedMotion ? { opacity: 0 } : undefined}
        transition={{ type: 'spring', stiffness: 320, damping: 32, duration: reducedMotion ? 0 : undefined }}
      >
        <header className="feature-document-toolbar">
          <div className="document-window-controls">
            <button ref={closeRef} type="button" onClick={onClose} className="document-close" aria-label="Close feature preview" title="Close preview (Esc)"><X size={9} strokeWidth={2.8} /></button>
            <span className="document-traffic-light amber" aria-hidden="true" />
            <span className="document-traffic-light green" aria-hidden="true" />
          </div>
          <div className="document-window-filename" id={titleId}><FileText size={14} /><span>{filename(match.feature.name)}</span></div>
          <div className="document-toolbar-actions">
            <button type="button" onClick={copy} disabled={!brief || loading} title="Copy Markdown" aria-label={copied ? 'Markdown copied' : 'Copy Markdown'}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
            <button type="button" onClick={() => download('md')} disabled={!brief || loading} title="Download Markdown" aria-label="Download Markdown"><ArrowDownToLine size={16} /></button>
            <button type="button" className="document-bundle-button" onClick={() => download('zip')} disabled={!brief || loading} title="Download Markdown, wireframe, flow and sources"><Package size={15} /><span>Download files</span></button>
          </div>
        </header>
        <motion.div className="document-window-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18, delay: reducedMotion ? 0 : 0.08 }}>
          {actionError && <p className="document-action-error" role="alert">{actionError}</p>}
          {loading && !brief ? (
            <div className="document-state" role="status"><LoaderCircle size={22} className="document-loader" /><p>Opening the brief.</p></div>
          ) : error ? (
            <div className="document-state"><FileText size={24} /><p>The brief did not load.</p><span role="alert">{error}</span><button type="button" onClick={onRetry}><RotateCcw size={14} />Try again</button></div>
          ) : brief ? <MarkdownDocument brief={brief} /> : (
            <div className="document-state" role="status"><FileText size={24} /><p>Preparing the document.</p></div>
          )}
        </motion.div>
        <footer className="feature-document-statusbar"><span>{brief ? 'Markdown' : 'Preview'}</span><span>{brief ? `${Math.max(1, Math.round(brief.markdown.length / 1000))} KB` : ''}</span></footer>
      </motion.section>
    </motion.div>
  );
}

export function FeatureDocument(props: PreviewProps) {
  return createPortal(
    <AnimatePresence>{props.match && <PreviewWindow key={props.match.id} {...props} match={props.match} />}</AnimatePresence>,
    document.body,
  );
}
