import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent, FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Feature } from '../shared/types';
import './FeaturePicker.css';

export interface FeaturePickerProps {
  value: Feature[];
  onChange: (features: Feature[]) => void;
  disabled?: boolean;
}

const MAX_FEATURES = 7;
const FEATURE_MIME = 'application/x-p99-feature';
const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const suggestion = (id: string, name: string, description: string): Feature => ({ id, name, description });
const SUGGESTIONS: Feature[] = [
  suggestion('streaks', 'Daily streaks', 'Encourage consistency with a visible daily streak.'),
  suggestion('widgets', 'Home screen widgets', 'Show useful app information and actions on the home screen.'),
  suggestion('progress', 'Progress tracking', 'Make progress toward a goal easy to understand.'),
  suggestion('reminders', 'Smart reminders', 'Let people choose useful, timely reminders.'),
  suggestion('focus', 'Focus timer', 'Help people start and complete a focused session.'),
  suggestion('insights', 'Personal insights', 'Turn activity into useful trends and insights.'),
  suggestion('offline', 'Offline mode', 'Keep important actions available without a connection.'),
  suggestion('sync', 'Cloud sync', 'Keep user data consistent across devices.'),
  suggestion('onboarding', 'Guided onboarding', 'Guide new users toward their first useful result.'),
  suggestion('logging', 'Quick logging', 'Make it easy to record an activity or entry.'),
  suggestion('personalization', 'Personalization', 'Adapt the experience to user preferences.'),
  suggestion('social', 'Social circles', 'Help people share activity with a chosen group.'),
  suggestion('gamification', 'Rewards & badges', 'Recognize meaningful milestones with rewards.'),
  suggestion('subscriptions', 'Subscriptions', 'Offer clear subscription plans and account controls.'),
  suggestion('custom-ai-assistant', 'AI assistant', 'Help users complete tasks with an AI assistant.'),
  suggestion('custom-dark-mode', 'Dark mode', 'Offer a comfortable dark appearance.'),
  suggestion('search', 'Powerful search', 'Help people find the right content quickly.'),
  suggestion('custom-mood-tracking', 'Mood tracking', 'Record moods and reflect on changes over time.'),
  suggestion('custom-calendar-view', 'Calendar view', 'Organize activities in a useful calendar view.'),
  suggestion('custom-barcode-scanning', 'Barcode scanning', 'Find an item by scanning its barcode.'),
  suggestion('custom-voice-notes', 'Voice notes', 'Capture and revisit short voice recordings.'),
  suggestion('custom-photo-journal', 'Photo journal', 'Keep a journal of photos and reflections.'),
  suggestion('custom-shared-lists', 'Shared lists', 'Collaborate on a list with other people.'),
  suggestion('custom-map-discovery', 'Map discovery', 'Explore relevant places on an interactive map.'),
];
const ROWS = [SUGGESTIONS.slice(0, 8), SUGGESTIONS.slice(8, 16), SUGGESTIONS.slice(16)];

function customFeature(name: string): Feature {
  const normalized = normalize(name);
  const known = SUGGESTIONS.find((item) => normalize(item.name) === normalized || item.id === normalized);
  if (known) return known;
  const slug = normalized.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 38) || 'feature';
  let hash = 2166136261;
  for (const character of normalized) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return { id: `custom-${slug}-${(hash >>> 0).toString(36)}`, name, description: `Find interface patterns for ${name.toLocaleLowerCase()}.` };
}

export function FeaturePicker({ value, onChange, disabled = false }: FeaturePickerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [dragging, setDragging] = useState(false);
  const [overDrop, setOverDrop] = useState(false);
  const [touchGhost, setTouchGhost] = useState<{ name: string; x: number; y: number } | null>(null);
  const touch = useRef<{ feature: Feature; pointerId: number; x: number; y: number; active: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  const full = value.length >= MAX_FEATURES;
  const selected = (feature: Feature) => value.some((item) => item.id === feature.id || normalize(item.name) === normalize(feature.name));

  const endDrag = () => { touch.current = null; setDragging(false); setOverDrop(false); setTouchGhost(null); };
  useEffect(() => { if (disabled || full) endDrag(); }, [disabled, full]);

  const add = (features: Feature[]): Feature[] => {
    if (disabled) return features;
    const next = [...valueRef.current];
    const added: string[] = [];
    const unadded: Feature[] = [];
    let duplicate = false;
    for (const feature of features) {
      if (next.some((item) => item.id === feature.id || normalize(item.name) === normalize(feature.name))) { duplicate = true; continue; }
      if (next.length >= MAX_FEATURES) {
        if (!unadded.some((item) => item.id === feature.id || normalize(item.name) === normalize(feature.name))) unadded.push(feature);
        continue;
      }
      next.push(feature);
      added.push(feature.name);
    }
    if (added.length) {
      valueRef.current = next;
      onChange(next);
      setAnnouncement(`${added.join(', ')} added. ${next.length} of ${MAX_FEATURES} features selected.${unadded.length ? ' Remaining features are kept in the field. Remove a tag to add them.' : ''}`);
      return unadded;
    }
    setAnnouncement(unadded.length ? 'You can select up to 7 features. Your text is kept. Remove a tag to add another.' : duplicate ? 'That feature is already selected.' : '');
    return unadded;
  };
  const addDraft = (text: string) => {
    const names = text.split(',').map((name) => name.trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean);
    if (names.length) setDraft(add(names.map(customFeature)).map((feature) => feature.name).join(', '));
  };
  const remove = (feature: Feature) => {
    if (disabled) return;
    const next = valueRef.current.filter((item) => item.id !== feature.id);
    valueRef.current = next;
    onChange(next);
    setAnnouncement(`${feature.name} removed. ${next.length} of ${MAX_FEATURES} features selected.`);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addDraft(draft); }
    else if (event.key === 'Backspace' && !draft && value.length) {
      event.preventDefault();
      dropRef.current?.querySelector<HTMLButtonElement>('.fp-selected:last-of-type button')?.focus();
    }
  };
  const isFeatureDrag = (event: DragEvent) => Array.from(event.dataTransfer.types).includes(FEATURE_MIME);
  const canDrop = (event: DragEvent) => !disabled && !full && isFeatureDrag(event);
  const drop = (event: DragEvent<HTMLDivElement>) => {
    if (!isFeatureDrag(event)) return;
    event.preventDefault();
    if (!canDrop(event)) {
      if (!disabled) setAnnouncement('You can select up to 7 features. Remove a tag to add another.');
      endDrag();
      return;
    }
    const feature = SUGGESTIONS.find((item) => item.id === event.dataTransfer.getData(FEATURE_MIME));
    if (feature) add([feature]);
    endDrag();
  };
  const inDrop = (x: number, y: number) => {
    const rect = dropRef.current?.getBoundingClientRect();
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, feature: Feature) => {
    if (disabled || full || selected(feature) || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
    touch.current = { feature, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = touch.current;
    if (!current || current.pointerId !== event.pointerId || disabled) return;
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7) return;
    current.active = true;
    setDragging(true);
    setTouchGhost({ name: current.feature.name, x: event.clientX, y: event.clientY });
    setOverDrop(inDrop(event.clientX, event.clientY));
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = touch.current;
    if (current?.active) {
      suppressClickUntil.current = performance.now() + 400;
      if (inDrop(event.clientX, event.clientY)) add([current.feature]);
    }
    endDrag();
  };
  // The marquee freezes on focus; bring an offscreen original pill into view
  // without restarting its animation. Duplicate visual copies stay out of Tab.
  const focusSuggestion = (event: FocusEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLButtonElement) || !event.target.matches(':focus-visible')) return;
    const lane = event.currentTarget.getBoundingClientRect();
    const button = event.target.getBoundingClientRect();
    const shift = event.currentTarget.querySelector<HTMLElement>('.fp-focus-shift');
    if (!shift) return;
    const delta = button.left < lane.left + 12 ? lane.left + 12 - button.left : button.right > lane.right - 12 ? lane.right - 12 - button.right : 0;
    const offset = Number(shift.dataset.offset || 0) + delta;
    shift.dataset.offset = String(offset);
    shift.style.transform = `translateX(${offset}px)`;
  };

  return (
    <section className="feature-picker" aria-labelledby={`${id}-label`} data-disabled={disabled} data-dragging={dragging}>
      <div className="fp-label-row">
        <label id={`${id}-label`} htmlFor={`${id}-input`}>2. Features to add <span className="required-label">Required</span></label>
        <span id={`${id}-count`} aria-label={`${value.length} of ${MAX_FEATURES} features selected`}>{value.length} / {MAX_FEATURES}</span>
      </div>
      <div ref={dropRef} className={`fp-field${overDrop ? ' fp-drop-active' : ''}`} role="group" aria-labelledby={`${id}-label`}
        onDragOver={(event) => { if (isFeatureDrag(event)) { event.preventDefault(); const allowed = canDrop(event); event.dataTransfer.dropEffect = allowed ? 'copy' : 'none'; setOverDrop(allowed); } }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverDrop(false); }} onDrop={drop}>
        {value.map((feature) => (
          <span className="fp-selected" key={feature.id}>
            <span>{feature.name}</span>
            <button type="button" disabled={disabled} onClick={() => remove(feature)} aria-label={`Remove ${feature.name}`}><X size={12} aria-hidden="true" /></button>
          </span>
        ))}
        <div className="fp-input-wrap">
          <input ref={inputRef} id={`${id}-input`} value={draft} disabled={disabled} maxLength={240}
            placeholder={full ? 'Remove a tag to add another' : value.length ? 'Add another feature' : 'Type a feature'}
            autoComplete="off" aria-describedby={`${id}-hint ${id}-count`} onChange={(event) => setDraft(event.target.value)} onKeyDown={onInputKey} />
          {draft.trim() && !full && <button className="fp-add" type="button" disabled={disabled} aria-label="Add typed feature" onClick={() => { addDraft(draft); inputRef.current?.focus(); }}><Plus size={15} aria-hidden="true" /></button>}
        </div>
      </div>
      <p className="fp-hint" id={`${id}-hint`}>Choose at least one tag, or type your own.</p>
      <div className="fp-marquee" aria-label="Feature suggestions">
        {ROWS.map((row, rowIndex) => (
          <div className={`fp-lane fp-lane-${rowIndex}`} key={rowIndex} onFocusCapture={focusSuggestion}
            onBlurCapture={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              const shift = event.currentTarget.querySelector<HTMLElement>('.fp-focus-shift');
              if (shift) { shift.style.removeProperty('transform'); delete shift.dataset.offset; }
            }}>
            <div className="fp-focus-shift"><div className="fp-track">
              {[0, 1].map((copy) => <div className="fp-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                {row.map((feature) => {
                  const chosen = selected(feature);
                  return <button type="button" className={`fp-suggestion${chosen ? ' fp-is-selected' : ''}`} key={feature.id}
                    disabled={disabled || (full && !chosen)} aria-pressed={chosen} aria-label={`${chosen ? 'Selected' : 'Add'} ${feature.name}`}
                    tabIndex={copy === 1 ? -1 : undefined} draggable={!disabled && !full && !chosen}
                    onClick={() => { if (performance.now() < suppressClickUntil.current) return; add([feature]); }}
                    onDragStart={(event) => {
                      if (disabled || full || chosen) { event.preventDefault(); return; }
                      event.dataTransfer.setData(FEATURE_MIME, feature.id);
                      event.dataTransfer.setData('text/plain', feature.name);
                      event.dataTransfer.effectAllowed = 'copy'; setDragging(true);
                    }} onDragEnd={endDrag}
                    onPointerDown={(event) => pointerDown(event, feature)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={endDrag}>
                    {chosen ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}{feature.name}
                  </button>;
                })}
              </div>)}
            </div></div>
          </div>
        ))}
      </div>
      <span className="fp-announcement" role="status" aria-live="polite">{announcement}</span>
      {touchGhost && <span className="fp-touch-ghost" aria-hidden="true" style={{ left: touchGhost.x, top: touchGhost.y }}>{touchGhost.name}</span>}
    </section>
  );
}
