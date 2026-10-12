import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:5187';
const feature = (id, name, description = name) => ({ id, name, description });
const cases = [
 { name: 'Habit tracker', input: 'A gentle habit tracking app for busy people, with daily streaks, home screen widgets, personalized onboarding and progress insights.', features: [feature('streaks', 'Daily streaks'), feature('widgets', 'Home screen widgets'), feature('onboarding', 'Personalized onboarding')] },
 { name: 'Daily journal', input: 'A private daily journal with mood tracking, guided reflection prompts, reminders and a searchable timeline of memories.', features: [feature('custom-mood-tracking', 'Mood tracking'), feature('reminders', 'Gentle reminders'), feature('search', 'Searchable memories'), feature('quantum-progress', 'Quantum teleportation progress', 'Daily progress and insights for quantum teleportation')], unmatched: ['quantum-progress'] },
 { name: 'Fitness companion', input: 'A strength training app with personalized workout plans, workout logging, progress charts, and shared challenges with friends.', features: [feature('logging', 'Workout logging'), feature('progress', 'Workout progress'), feature('social', 'Shared challenges with friends')] },
];
async function post(path, body) {
 const response = await fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const data=await response.json(); assert.equal(response.status,200,`${path}: ${JSON.stringify(data)}`); return data;
}
const health=await fetch(`${base}/api/health`).then(r=>r.json());assert.equal(health.catalogCount,1000);assert.equal(health.mode,'jev');
for(const {name,input,features,unmatched=[]} of cases){
 const start=performance.now();
 const analyzed=await post('analyze',{input,features,profile:{name,platform:'iOS',stack:'SwiftUI'}});
 assert.deepEqual(analyzed.features,features);assert.equal(analyzed.suggested,false);
 const matched=await post('match',{project:analyzed.project,features:analyzed.features});
 assert.equal(matched.mode,'jev',matched.notice);
 assert.deepEqual((matched.unmatchedFeatures||[]).map(f=>f.id),unmatched);
 assert.deepEqual(matched.matches.map(m=>m.feature),features.filter(f=>!unmatched.includes(f.id)));
 assert.equal(new Set(matched.matches.map(m=>m.feature.id)).size,matched.matches.length);
 const elapsed=Math.round(performance.now()-start);
 const brief=await post('brief',{project:analyzed.project,match:matched.matches[0]});
 assert.ok(brief.markdown.length>6000);assert.ok(brief.files.length>=4);assert.match(brief.wireframeSvg,/<svg/);assert.match(brief.flowMermaid,/flowchart/);
 assert.ok(matched.matches.every(m=>m.stats.find(s=>s.label==='Monthly revenue')?.status==='unavailable'));
 console.log(JSON.stringify({name,elapsedMs:elapsed,analyzeMs:analyzed.durationMs,matchMs:matched.durationMs,mode:matched.mode,matches:matched.matches.map(m=>`${m.feature.name}: ${m.app.name}`),unmatched:matched.unmatchedFeatures.map(f=>f.name),briefWords:brief.markdown.split(/\s+/).length}));
}
