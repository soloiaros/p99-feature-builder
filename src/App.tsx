import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, CircleHelp, Plus, SlidersHorizontal, Star, X } from 'lucide-react';
import { SearchScene } from './components/SearchScene';
import { RobotCompanion } from './components/RobotCompanion';
import { FeaturePicker } from './components/FeaturePicker';
import { DocumentTrigger, FeatureDocument } from './components/FeatureDocument';
import { manifestDependencies } from './lib/manifest';
import { iconThumbnail } from './lib/app-icons';
import type { AccountState, AnalyzeResponse, AppSummary, BriefResponse, CatalogResponse, Feature, FeatureMatch, MatchResponse, Project, ProjectProfile } from './shared/types';

class ApiClientError extends Error { constructor(message: string, public status: number) { super(message); } }

type Stage = 'home' | 'analyzing' | 'matching' | 'results';
type SavedProject = { id: string; project: Project; features?: Feature[]; matches: FeatureMatch[]; savedAt: string; mode: string };

async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal });
  const data = await response.json() as T & { error?: string | { message?: string }; message?: string };
  if (!response.ok) throw new ApiClientError(typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'The request failed. Try again.', response.status);
  return data;
}
function loadSaved(key = 'p99-projects'): SavedProject[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) || '[]');
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

export default function App() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('home');
  const [input, setInput] = useState('');
  const [features, setFeatures] = useState<Feature[]>([]);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [profile, setProfile] = useState<ProjectProfile>({ name: 'My app', platform: 'Not sure', stack: 'Use existing stack' });
  const [manifest, setManifest] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [matches, setMatches] = useState<FeatureMatch[]>([]);
  const [unmatched, setUnmatched] = useState<Feature[]>([]);
  const [mode, setMode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'about' | 'saved' | 'account' | 'premium' | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [saved, setSaved] = useState<SavedProject[]>(() => loadSaved());
  const [sceneActive, setSceneActive] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [runId, setRunId] = useState(0);
  const [candidates, setCandidates] = useState<AppSummary[]>([]);
  const [documentMatch, setDocumentMatch] = useState<FeatureMatch | null>(null);
  const [briefs, setBriefs] = useState<Record<string, BriefResponse>>({});
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const briefController = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const busy = stage === 'analyzing' || stage === 'matching';
  const overlayOpen = !!documentMatch || !!modal;
  const sceneApps = useMemo(() => [...new Map([...(catalog?.apps.slice(0, 18) || []), ...candidates].map(app => [app.id, app])).values()], [catalog, candidates]);
  const finishScene = useCallback(() => setSceneActive(false), []);

  async function refreshAccount() {
    try { setAccount(await api<AccountState>('account')); setAccountError(''); }
    catch { setAccountError('Your account could not load. Try again.'); }
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('checkout') !== 'success') void refreshAccount();
    if (params.has('checkout')) { setModal('premium'); if (params.get('checkout') === 'success') void restorePurchase(params.get('session_id') || undefined); history.replaceState(null, '', location.pathname); }
    if (params.has('auth')) {
      try {
        const draft = JSON.parse(sessionStorage.getItem('p99-signin-draft') || 'null');
        if (draft) { setInput(draft.input || ''); setFeatures(draft.features || []); setProfile(draft.profile); setManifest(draft.manifest || ''); }
        sessionStorage.removeItem('p99-signin-draft');
      } catch { /* A damaged draft does not block sign-in. */ }
      if (params.get('auth') === 'error') { setAccountError('Sign-in was canceled or expired. Please try again.'); setModal('account'); }
      history.replaceState(null, '', location.pathname);
    }
  }, []);
  function signIn(provider: 'google' | 'github') {
    try { sessionStorage.setItem('p99-signin-draft', JSON.stringify({ input, features, profile, manifest })); }
    catch { setAccountError('Your draft could not be saved. Copy it before signing in.'); return; }
    location.assign(`/api/auth/start?provider=${provider}`);
  }
  async function checkout() {
    if (!account?.user) { setModal('account'); return; }
    setAccountBusy(true); setAccountError('');
    try { const result = await api<{ url: string }>('billing/checkout', {}); location.assign(result.url); }
    catch (error) { setAccountError((error as Error).message); setAccountBusy(false); }
  }
  async function restorePurchase(sessionId?: string) {
    if (!account?.user && !sessionId) { setModal('account'); return; }
    setAccountBusy(true); setAccountError('');
    try {
      const restored = await api<AccountState>('billing/restore', sessionId ? { sessionId } : {});
      setAccount(restored); setBriefs({});
      setToast(restored.premium ? 'Premium is ready. Your integration kits are unlocked.' : 'No active pass yet. If you just paid, try Restore purchase shortly.');
    } catch (error) { setAccountError((error as Error).message); }
    finally { setAccountBusy(false); }
  }
  async function signOut() {
    setAccountBusy(true);
    try { await api('auth/logout', {}); resetSearch(true); setProfile({ name: 'My app', platform: 'Not sure', stack: 'Use existing stack' }); setManifest(''); setBriefs({}); setSaved([]); setModal(null); await refreshAccount(); }
    catch (error) { setAccountError((error as Error).message); }
    finally { setAccountBusy(false); }
  }
  useEffect(() => {
    const ctrl = new AbortController();
    api<CatalogResponse>('catalog', undefined, ctrl.signal).then(setCatalog).catch(error => {
      if (error.name !== 'AbortError') setError('The app library could not load. Refresh to try again.');
    });
    return () => ctrl.abort();
  }, []);
  useEffect(() => {
    if (!catalog || reducedMotion) return;
    for (const app of catalog.apps.slice(0, 18)) { const image = new Image(); image.crossOrigin = 'anonymous'; image.src = iconThumbnail(app.iconUrl); }
    const timer = setTimeout(() => { void import('three').catch(() => {}); }, 250);
    return () => clearTimeout(timer);
  }, [catalog, reducedMotion]);
  useEffect(() => () => { controller.current?.abort(); briefController.current?.abort(); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (documentMatch) return;
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); setModal(null); resetSearch(); }
      if (event.key === 'Escape') { if (modal) setModal(null); else if (busy) cancel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [documentMatch, modal, busy]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]') || []);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [modal]);

  useEffect(() => { setSaved(loadSaved(account?.user ? `p99-projects:${account.user.id}` : 'p99-projects')); }, [account?.user?.id]);

  function resetSearch(clear = false) {
    controller.current?.abort(); briefController.current?.abort();
    setBriefBusy(false); setDocumentMatch(null); setSceneActive(false); setStage('home'); setError(''); setBriefError('');
    if (clear) { setInput(''); setFeatures([]); setProject(null); setMatches([]); setUnmatched([]); }
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function cancel() { controller.current?.abort(); setSceneActive(false); setStage('home'); setError(''); }
  async function analyze() {
    if (busy) return;
    if (!account) { setError('Wait for your account to load, then try again.'); void refreshAccount(); return; }
    if (account.configured && account.remaining === 0) { setModal(account.user ? 'premium' : 'account'); return; }
    if (input.trim().length < 12) { setError('Add a link, or a few sentences about the app.'); inputRef.current?.focus(); return; }
    if (!features.length) { setError('Add at least one feature.'); return; }
    let dependencies: string[];
    try { dependencies = manifest.trim() ? manifestDependencies(manifest) : profile.dependencies || []; } catch (error) { setError((error as Error).message); return; }
    controller.current?.abort(); briefController.current?.abort();
    const ctrl = new AbortController(); controller.current = ctrl;
    const started = performance.now();
    setProject(null); setMatches([]); setUnmatched([]); setCandidates([]); setBriefs({}); setBriefBusy(false); setBriefError(''); setDocumentMatch(null);
    setStage('analyzing'); setRunId(id => id + 1); setSceneActive(true); setSkipped(false); setError('');
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      const analyzed = await api<AnalyzeResponse>('analyze', { input, features, profile: { ...profile, dependencies, name: !profile.name.trim() || profile.name === 'My app' ? undefined : profile.name } }, ctrl.signal);
      if (ctrl.signal.aborted || controller.current !== ctrl) return;
      setProject(analyzed.project); setCandidates(analyzed.candidates || []); setStage('matching');
      const result = await api<MatchResponse>('match', { project: analyzed.project, features: analyzed.features, searchToken: analyzed.searchToken }, ctrl.signal);
      if (ctrl.signal.aborted || controller.current !== ctrl) return;
      const remaining = 2000 - (performance.now() - started);
      if (remaining > 0) {
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
          const timer = window.setTimeout(() => { ctrl.signal.removeEventListener('abort', onAbort); resolve(); }, remaining);
          if (ctrl.signal.aborted) onAbort();
          else ctrl.signal.addEventListener('abort', onAbort, { once: true });
        });
      }
      if (ctrl.signal.aborted || controller.current !== ctrl) return;
      setMatches(result.matches); setUnmatched(result.unmatchedFeatures || analyzed.features.filter(feature => !result.matches.some(match => match.feature.id === feature.id)));
      setMode(result.mode); setNotice(result.notice); setStage('results'); void refreshAccount();
    } catch (error) {
      if (ctrl.signal.aborted || controller.current !== ctrl) return;
      setError((error as Error).message); setSceneActive(false); setStage('home'); void refreshAccount();
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 429)) setModal('account');
    }
  }
  async function getBrief(match: FeatureMatch) {
    setBriefError('');
    if (briefs[match.id] || !project) return;
    briefController.current?.abort();
    const ctrl = new AbortController(); briefController.current = ctrl; setBriefBusy(true);
    try {
      const result = await api<BriefResponse>('brief', { project, match }, ctrl.signal);
      if (ctrl.signal.aborted || briefController.current !== ctrl) return;
      setBriefs(previous => ({ ...previous, [match.id]: result }));
    } catch (error) { if (!ctrl.signal.aborted && briefController.current === ctrl) setBriefError((error as Error).message); }
    finally { if (!ctrl.signal.aborted && briefController.current === ctrl) setBriefBusy(false); }
  }
  function openDocument(match: FeatureMatch) { setDocumentMatch(match); void getBrief(match); }
  function closeDocument() { briefController.current?.abort(); setBriefBusy(false); setDocumentMatch(null); setBriefError(''); }
  function saveProject() {
    if (!project) return;
    const next = [{ id: crypto.randomUUID(), project, features, matches, savedAt: new Date().toISOString(), mode }, ...saved.filter(item => item.project.input !== project.input)].slice(0, 12);
    try { localStorage.setItem(account?.user ? `p99-projects:${account.user.id}` : 'p99-projects', JSON.stringify(next)); setSaved(next); setToast('Saved in this browser.'); }
    catch { setToast('This browser storage is full. Download the briefs to keep them.'); }
  }
  function reopen(item: SavedProject) {
    controller.current?.abort(); briefController.current?.abort(); setBriefBusy(false); setBriefError(''); setDocumentMatch(null); setSceneActive(false);
    setProject(item.project); setProfile({ name: item.project.name, platform: item.project.platform, stack: item.project.stack, integrationNotes: item.project.integrationNotes, dependencies: item.project.dependencies }); setManifest(''); setInput(item.project.input);
    const savedFeatures = item.features || item.matches.map(match => match.feature);
    setFeatures(savedFeatures); setMatches(item.matches); setUnmatched(savedFeatures.filter(feature => !item.matches.some(match => match.feature.id === feature.id)));
    setMode(item.mode); setNotice('Saved earlier in this browser. Check the source dates.'); setBriefs({}); setModal(null); setStage('results'); window.scrollTo({ top: 0, behavior: 'instant' });
  }

  return <MotionConfig reducedMotion="user"><LayoutGroup>
    <div className="app-shell" data-stage={stage}>
      <RobotCompanion stage={stage} hasInput={!!input.trim()} hasError={!!error || !!briefError} working={briefBusy} paused={overlayOpen || (busy && skipped)} onActivate={() => { if (!busy && !overlayOpen) resetSearch(); }} />
      <header className="site-header" inert={busy || !!modal} aria-hidden={busy}>
        <div className="brand-group"><span className="robot-dock" data-robot-dock aria-hidden="true" /><button className="brand" onClick={() => resetSearch()} aria-label="p99 home">p99</button></div>
        <nav aria-label="Main navigation"><button className="nav-link premium-link" onClick={() => { setAccountError(''); setModal('premium'); }}>Premium</button><button className="nav-link" onClick={() => setModal('account')}>{account?.user ? 'Account' : 'Sign in'}</button><button className="nav-link" onClick={() => setModal('saved')}><Bookmark size={15} /> Saved{saved.length > 0 && <span className="count-badge">{saved.length}</span>}</button><button className="icon-button" onClick={() => setModal('about')} aria-label="How p99 works"><CircleHelp size={17} /></button></nav>
      </header>
      <main inert={!!modal}>
        <AnimatePresence initial={false}>
          {stage === 'home' && <motion.section key="home" className="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
            <div className="hero"><h1>Great app features, tailored to your codebase.</h1><p className="hero-description">Choose what to add. Get a build brief that fits your stack, data and design.</p></div>
            <form className="search-form" aria-labelledby="brief-builder-title" onSubmit={event => { event.preventDefault(); void analyze(); }}>
              <div className="builder-heading"><h2 id="brief-builder-title">Shape your build brief</h2><span>Two essentials. One useful starting point.</span></div><label className="field-label" htmlFor="app-context">1. Your app <span className="required-label">Required</span></label>
              <motion.div className="search-box" layoutId="project-query" transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
                <textarea ref={inputRef} id="app-context" required aria-required="true" value={input} maxLength={6000} onChange={event => { setInput(event.target.value); setError(''); }} placeholder="Paste a public app link, or describe what your app does." onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void analyze(); } }} />
              </motion.div>
              <FeaturePicker value={features} onChange={next => { setFeatures(next); setError(''); }} />
              <div className="build-context-heading"><h3>Build context</h3><p>Choose your platform and stack, or let the brief guide discovery.</p></div>
              <div className="profile-fields"><label>App name<input value={profile.name} maxLength={100} onChange={event => setProfile({ ...profile, name: event.target.value })} /></label><label>Platform<select value={profile.platform} onChange={event => setProfile({ ...profile, platform: event.target.value })}><option>Not sure</option><option>iOS</option><option>Android</option><option>Web</option><option>Cross-platform</option></select></label><label>Stack<input required value={profile.stack} maxLength={160} onChange={event => setProfile({ ...profile, stack: event.target.value })} /></label></div>
              <button type="button" className="context-toggle" aria-expanded={showProfile} aria-controls="extra-context" onClick={() => setShowProfile(value => !value)}><SlidersHorizontal size={14} />Add existing app details <span>Optional</span><ChevronDown size={13} /></button>
              <AnimatePresence>{showProfile && <motion.div id="extra-context" className="profile-fields extra-context" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><label className="context-wide">Integration notes<textarea value={profile.integrationNotes || ''} maxLength={2400} onChange={event => setProfile({ ...profile, integrationNotes: event.target.value })} placeholder="Existing routes, database entities, auth, design system, and anything the feature must reuse." /></label><label className="context-wide">package.json<span>Only package names and versions are used. Omit secrets.</span><textarea value={manifest} maxLength={30000} onChange={event => setManifest(event.target.value)} placeholder='{"dependencies": {"react": "^19.0.0"}}' /></label></motion.div>}</AnimatePresence>
              <div className="search-actions"><span className="allowance-note">{account?.configured ? account.user ? `${account.remaining} searches left` : 'One free search. No account needed.' : 'Explore app patterns and build briefs.'}</span><button type="submit" className="primary" disabled={!account || input.trim().length < 12 || !features.length}>Find the best apps <ArrowRight size={17} /></button></div>
              {error && <p className="error-message" role="alert">{error}</p>}
              <p className="search-footnote">Public app evidence → a brief for your existing app.</p>
            </form>
          </motion.section>}
        </AnimatePresence>
        {stage !== 'home' && <div className={`query-dock ${busy ? 'query-dimmed' : 'query-resting'}`}><motion.div className="query-card" layoutId="project-query" transition={{ type: 'spring', stiffness: 300, damping: 32 }}><div className="query-top"><span>{project?.name || 'Your app'}</span>{!busy && <button className="text-button" onClick={() => resetSearch()}>Edit search</button>}</div><p className="query-text">{input}</p><div className="query-tags">{features.map(feature => <span key={feature.id}>{feature.name}</span>)}</div></motion.div></div>}
        {busy && <section className="search-stage" aria-live="polite"><div className="search-status"><p>{stage === 'analyzing' ? 'Reading your app.' : 'Comparing apps for each feature.'}</p><span>One app for each feature.</span><div className="progress-controls"><button onClick={cancel}>Cancel</button>{!skipped && !reducedMotion && <button onClick={() => setSkipped(true)}>Less motion</button>}</div></div></section>}
        <AnimatePresence>{stage === 'results' && <motion.section key="results" className="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }}>
          <div className="results-heading"><div><h1>The good ones.</h1><p>One app for each feature. Open a card for the brief.</p></div>{matches.length > 0 && <button className="save-button" onClick={saveProject}><Bookmark size={15} /><span>Save</span></button>}</div>
          <div className="result-list">{features.map(feature => {
            const match = matches.find(item => item.feature.id === feature.id);
            if (!match) return <article className="unmatched-row" key={feature.id}><span className="empty-feature-icon"><Plus size={22} /></span><div><h2>{feature.name}</h2><p>No app in this set describes that feature clearly enough to cite.</p></div><button onClick={() => resetSearch()}>Refine</button></article>;
            const excerpt = match.evidence.find(item => item.kind === 'publisher-description')?.statement;
            return <article className="reference-card" key={match.id} aria-label={`${feature.name} reference`}><div className="reference-main"><AppIcon app={match.app} flightId={match.id} /><div className="reference-copy"><p className="feature-label">{feature.name}</p><h2><a href={match.app.appStoreUrl} target="_blank" rel="noreferrer">{match.app.name}<ArrowUpRight size={16} /></a></h2><div className="reference-meta">{match.app.rating !== null && <span><Star size={12} fill="currentColor" /> {match.app.rating.toFixed(1)}{match.app.ratingCount !== null && <span className="rating-count"> · {new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(match.app.ratingCount)} ratings</span>}</span>}<span>{match.app.category}</span></div>{excerpt && <p className="reference-excerpt">{excerpt}</p>}</div><DocumentTrigger match={match} onOpen={() => openDocument(match)} isOpen={documentMatch?.id === match.id} /></div><Evidence match={match} /></article>;
          })}</div>
          {unmatched.length > 0 && matches.length === 0 && <p className="results-note">Try a more common feature name.</p>}
          <p className="results-note">You can open the public listing and rating for each app. Each source has a date. <button onClick={() => setModal('about')}>How we pick</button></p>
          {mode !== 'jev' && notice && <p className="engine-notice" role="status">{notice}</p>}
        </motion.section>}</AnimatePresence>
      </main>
      <footer className="site-footer" inert={busy || !!modal}><span>p99</span><span>{catalog ? catalog.total.toLocaleString() : '1,000'} apps, US App Store</span></footer>
      {sceneActive && <SearchScene apps={sceneApps} matches={matches} phase={stage === 'results' ? 'settling' : 'searching'} disabled={skipped || !!reducedMotion} runId={runId} onSettled={finishScene} />}
    </div>
    <FeatureDocument match={documentMatch} brief={documentMatch ? briefs[documentMatch.id] || null : null} loading={briefBusy} error={briefError || null} onClose={closeDocument} onRetry={() => { if (documentMatch) void getBrief(documentMatch); }} onToast={setToast} onUpgrade={() => { closeDocument(); setModal('premium'); }} />
    <AnimatePresence>{modal && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}><motion.div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" className="modal" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .97 }} onClick={event => event.stopPropagation()}><button className="icon-button modal-close" aria-label="Close" onClick={() => setModal(null)}><X size={18} /></button>
      {modal === 'premium' ? <div className="premium-offer"><span className="premium-eyebrow">p99 Premium</span><h2 id="modal-title">A pattern. A plan.<br />Ready for your app.</h2><div className="premium-preview" aria-hidden="true"><span>your-feature.md</span><code># Implementation brief<br /><br />## Your stack & integration map<br />## Data contracts & edge cases<br />## Acceptance criteria</code><span className="premium-preview-files">+ wireframe.svg · flow.mmd · contract.json</span></div><dl className="premium-benefits"><div><dt>Explore</dt><dd>100 searches per 30-day pass</dd></div><div><dt>Build</dt><dd>Tailored Markdown and complete integration kits</dd></div><div><dt>Bring to your agent</dt><dd>Original wireframes, flows, structured requirements and sources</dd></div></dl>
        {account?.premium ? <><p className="premium-price">Your pass is active</p><p>Access until {new Date(account.expiresAt!).toLocaleDateString()}.</p><button className="primary" onClick={() => setModal(null)}>Keep building <ArrowRight size={16} /></button></> : <><p className="premium-price">{account?.priceLabel || '$9'} <span>for 30 days</span></p><p className="premium-terms">One payment. No automatic renewal.</p><button className="primary" disabled={accountBusy || (Boolean(account?.user) && !account?.checkoutEnabled)} onClick={() => void checkout()}>{accountBusy ? 'Opening…' : account?.user ? 'Get Premium' : 'Sign in to get Premium'}<ArrowRight size={16} /></button>{account?.user && !account.checkoutEnabled && <p>Checkout is being set up. Your free searches are still available.</p>}</>}
        <button className="restore-purchase" disabled={accountBusy} onClick={() => void restorePurchase()}>Restore purchase</button><p className="premium-free">Free accounts keep five searches a month and the complete Markdown brief.</p>{accountError && <p className="error-message" role="alert">{accountError}</p>}
      </div> : modal === 'account' ? <><h2 id="modal-title">{account?.user ? 'Your account' : 'Keep exploring'}</h2>
        {account?.user ? <><p>{account.user.email}</p><p>{account.remaining} of {account.limit} searches left {account.premium ? 'with your Premium pass' : 'this month'}.</p><button onClick={() => setModal('premium')}>{account.premium ? 'Manage Premium' : 'Explore Premium'}</button><button onClick={signOut} disabled={accountBusy}>Sign out</button></> : <><p>Try one search on us. Sign in to get five searches each month and keep building.</p><div className="auth-options"><button disabled={!account?.providers.includes('google')} onClick={() => signIn('google')}>Continue with Google</button><button disabled={!account?.providers.includes('github')} onClick={() => signIn('github')}>Continue with GitHub</button></div>{account && !account.providers.length && <p>Sign-in is being set up. Please check back shortly.</p>}</>}
        {accountError && <p role="alert" className="error-message">{accountError}</p>}{!account && <button onClick={() => void refreshAccount()}>Retry account</button>}
      </> : modal === 'about' ? <><h2 id="modal-title">How we pick</h2><p>You describe your app and pick the features. Jev scores a short list of App Store apps for each feature and keeps one.</p><p>Open a card for the brief written for your stack.</p><details className="about-data"><summary>Where the numbers come from <ChevronDown size={14} /></summary><p>The search covers {catalog?.total.toLocaleString() || '1,000'} US App Store apps. Each match cites the publisher description and the public rating, with the date of that listing.</p><p>We send your description, or the public page you paste, to Jev. You keep saved projects in this browser.</p></details></> : <><h2 id="modal-title">Saved</h2><p>You keep these in this browser.</p><div className="saved-list">{saved.length ? saved.map(item => <button key={item.id} onClick={() => reopen(item)}><span className="saved-icons">{item.matches.slice(0, 3).map(match => <AppIcon key={match.id} app={match.app} />)}</span><span><strong>{item.project.name}</strong><small>{item.matches.length} feature references</small></span><ArrowRight size={16} /></button>) : <p className="empty-saved">No saved projects yet.</p>}</div></>}
    </motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><Check size={16} />{toast}</motion.div>}</AnimatePresence>
  </LayoutGroup></MotionConfig>;
}
