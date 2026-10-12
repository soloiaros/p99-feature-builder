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

function flowNodes(source: string): { id: string; label: string; decision: boolean }[] {
  // Render the server's documented flow without executing Mermaid or interpreting HTML.
  const nodes = new Map<string, { id: string; label: string; decision: boolean }>();
  for (const match of source.matchAll(/\b([A-Za-z][\w]*)(\[|\{)"([^"\n]+)"(?:\]|\})/g)) {
    const label = match[3].replace(/#(\d+);/g, (original, digits: string) => Number(digits) <= 0x10ffff ? String.fromCodePoint(Number(digits)) : original);
    nodes.set(match[1], { id: match[1], label, decision: match[2] === '{' });
  }
  return [...nodes.values()].slice(0, 16);
}

function FlowDiagram({ source }: { source: string }) {
  const nodes = useMemo(() => flowNodes(source), [source]);
  const recovery = nodes.find((node) => node.id === 'R');
  const mainNodes = nodes.filter((node) => node.id !== 'R');
  if (!mainNodes.length) return <pre className="document-code"><code>{source}</code></pre>;
  return (
    <figure className="document-flow">
      <figcaption>How it flows</figcaption>
      <ol aria-label="Feature flow">
        {mainNodes.map((node, index) => (
          <li key={node.id} className={node.decision ? 'document-flow-decision' : undefined}>
            <span className="document-flow-number">{String(index + 1).padStart(2, '0')}</span>
            <span>{node.label}{node.decision && recovery && <small>If it needs attention: {recovery.label}. Then try the action again.</small>}</span>
            {index < mainNodes.length - 1 && <ArrowDown size={14} className="document-flow-arrow" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function MarkdownDocument({ brief }: { brief: BriefResponse }) {
  const content = useMemo(() => {
    const lines = brief.markdown.replace(/\r\n/g, '\n').split('\n');
    const output: ReactNode[] = [];
    let index = 0;
    while (index < lines.length) {
      const start = index;
      const line = lines[index];
      if (!line.trim()) { index++; continue; }
      if (/^```/.test(line)) {
        const language = line.slice(3).trim();
        const code: string[] = [];
        index++;
        while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
        index++;
        output.push(language === 'mermaid' ? <FlowDiagram key={start} source={code.join('\n')} /> : <pre key={start} className="document-code"><code>{code.join('\n')}</code></pre>);
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        const text = inline(heading[2]);
        output.push(level === 1 ? <h1 key={start}>{text}</h1> : level === 2 ? <h2 key={start}>{text}</h2> : <h3 key={start}>{text}</h3>);
        if (heading[2] === 'Product scope & user flow' && brief.flowMermaid) output.push(<FlowDiagram key={`${start}-flow`} source={brief.flowMermaid} />);
        if (heading[2] === 'Original interface & accessibility' && brief.wireframeSvg) output.push(
          <figure key={`${start}-wireframe`} className="document-wireframe">
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(brief.wireframeSvg)}`} alt={`Original interface concept for ${brief.title}`} />
            <figcaption>A starting point for your interface. Make it yours.</figcaption>
          </figure>,
        );
        index++;
        continue;
      }
      if (/^\s*(?:[-*+] |\d+\. )/.test(line)) {
        const ordered = /^\s*\d+\. /.test(line);
        const items: ReactNode[] = [];
        const itemPattern = ordered ? /^\s*\d+\. (.*)$/ : /^\s*[-*+] (.*)$/;
        while (index < lines.length && itemPattern.test(lines[index])) {
          const item = lines[index].replace(itemPattern, '$1');
          const key = index++;
          const continued: string[] = [item];
          while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^\s*(?:[-*+] |\d+\. )/.test(lines[index])) continued.push(lines[index++].trim());
          items.push(<li key={key}>{inline(continued.join(' '))}</li>);
        }
        output.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>);
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quote: string[] = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
        output.push(<blockquote key={start}>{inline(quote.join(' '))}</blockquote>);
        continue;
      }
      if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { output.push(<hr key={start} />); index++; continue; }
      const paragraph: string[] = [line];
      index++;
      while (index < lines.length && lines[index].trim() && !/^(?:#{1,6}\s|```|>\s?|\s*[-*+] |\s*\d+\. )/.test(lines[index])) paragraph.push(lines[index++]);
      output.push(<p key={start}>{paragraph.map((part, partIndex) => <Fragment key={partIndex}>{partIndex > 0 && <br />}{inline(part)}</Fragment>)}</p>);
    }
    return output;
  }, [brief]);
  return <article className="document-markdown">{content}</article>;
}
