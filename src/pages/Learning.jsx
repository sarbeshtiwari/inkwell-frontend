import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { md } from "../lib/markdown";
import { Alert, Badge, Button, Empty, Icon, Seg, Spinner, fail, toast, useDebounced } from "../ui/kit";
import { Kpi } from "../ui/shared";

const Md = ({ text, className = "" }) => <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: md(text) }} />;
const TRACK_ICON = { ai_ml: "sparkles", system_design: "layers", full_stack: "laptop", dsa: "puzzle" };
const GRADES = [["again", "Again", "bad"], ["hard", "Hard", "warn"], ["good", "Good", "ok"], ["easy", "Easy", "brand"]];

function Reveal({ label = "Show answer", children }) {
  const [open, setOpen] = useState(false);
  return open ? <div className="lr-answer">{children}</div>
    : <button type="button" className="link-btn" onClick={() => setOpen(true)}><Icon name="eye" />{label}</button>;
}

function Question({ q }) {
  return (
    <div className="lr-q">
      <b>{q.question}</b>
      <Reveal><p>{q.answer}</p>
        {q.follow_up && <><b className="lr-follow">Follow-up: {q.follow_up}</b><Reveal label="Show follow-up answer"><p>{q.follow_up_answer}</p></Reveal></>}
      </Reveal>
    </div>
  );
}

function Track({ t }) {
  const [tab, setTab] = useState("basics");
  const b = t.basics, iv = t.interview;
  return (
    <section className="card lr-track">
      <header className="card-head"><span className="lr-ic"><Icon name={TRACK_ICON[t.key]} /></span><h3>{t.title}</h3><span className="muted">{t.topic}</span></header>
      <div className="card-pad">
        <Seg size="sm" value={tab} onChange={setTab} options={[["basics", "Learn it"], ["interview", "Interview"], ["notebook", "Notebook"]]} />
        {tab === "basics" && <div className="lr-body">
          <h4>{b.title}</h4><Md text={b.idea} />
          <div className="lr-example"><b>Example</b><Md text={b.example} /></div>
          {b.steps?.length > 0 && <ol>{b.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
          <div className="lr-task"><b>Try it</b><Md text={b.task} /><Reveal><Md text={b.answer} /></Reveal></div>
          {b.words && <dl className="lr-words">{Object.entries(b.words).map(([w, d]) => <div key={w}><dt>{w}</dt><dd>{d}</dd></div>)}</dl>}
          {t.job_use && <p className="help"><Icon name="briefcase" /> At work: {t.job_use}</p>}
        </div>}
        {tab === "interview" && <div className="lr-body">
          <Md text={iv.explanation} />
          <div className="lr-example"><b>Scenario</b><Md text={iv.scenario} /></div>
          {(iv.questions || []).map((q, i) => <Question key={i} q={q} />)}
          {iv.mistake && <Alert tone="warn" icon="alert">Common mistake: {iv.mistake}</Alert>}
          {iv.drill && <p><b>Drill: </b>{iv.drill}</p>}
          {iv.checks?.length > 0 && <ul className="lr-checks">{iv.checks.map((c, i) => <li key={i}><Icon name="check" />{c}</li>)}</ul>}
        </div>}
        {tab === "notebook" && <div className="lr-body"><h4>{t.notebook.title}</h4><Md text={t.notebook.text} /></div>}
      </div>
    </section>
  );
}

function Dsa({ d, done, onDone, busy }) {
  const [deep, setDeep] = useState(false);
  return (
    <section className="card lr-track">
      <header className="card-head"><span className="lr-ic"><Icon name="puzzle" /></span><h3>DSA practice</h3><span className="muted">{d.topic}</span>
        <span className="grow" />{done ? <Badge tone="ok">Practised today</Badge> : <Button size="sm" busy={busy} onClick={onDone} icon="check">Mark practised</Button>}</header>
      <div className="card-pad lr-body">
        <Seg size="sm" value={deep ? "depth" : "basics"} onChange={v => setDeep(v === "depth")} options={[["basics", "The idea"], ["depth", "Interview depth"]]} />
        {deep ? <><Md text={d.depth.concept} /><Md text={d.depth.walkthrough} /><Md text={d.depth.interview} /></>
          : <><Md text={d.basics.concept} /><Md text={d.basics.worked_example} /></>}
      </div>
    </section>
  );
}

function Today({ s, reload }) {
  const L = s.lesson;
  const [busy, setBusy] = useState("");
  const done = s.done.includes(L.day);
  const act = async (key, path, json) => {
    setBusy(key);
    try { await api(path, { json }); await reload(); if (key === "day") toast(`Day ${L.day} done. Its questions come back for review tomorrow.`); }
    catch (e) { fail(e); }
    setBusy("");
  };
  return <>
    <div className="lr-hero card">
      <div>
        <span className="lr-day">Day {L.day} of 90 · Week {L.spec.week}</span>
        <h2>{L.spec.title}</h2>
        <p className="muted">{L.week.title} · project: {L.week.project}</p>
        <ul className="lr-obj">{(L.spec.objectives || []).map((o, i) => <li key={i}>{o}</li>)}</ul>
      </div>
      <div className="lr-hero-act">
        {done ? <Badge tone="ok">Done</Badge> : <Button variant="primary" icon="check" busy={busy === "day"} onClick={() => act("day", `/api/learning/day/${L.day}/complete`, {})}>Mark day {L.day} done</Button>}
        <span className="help">{L.spec.session_label}</span>
      </div>
    </div>
    <div className="lr-grid">{L.tracks.map(t => <Track key={t.key} t={t} />)}
      <Dsa d={L.dsa} done={!!s.dsa_today.completed_at} busy={busy === "dsa"} onDone={() => act("dsa", "/api/learning/dsa/complete", {})} />
    </div>
    <section className="card"><header className="card-head"><span className="lr-ic"><Icon name="columns" /></span><h3>This week's lab</h3></header>
      <div className="card-pad"><Md text={L.lab} /></div></section>
    <section className="card"><header className="card-head"><span className="lr-ic"><Icon name="message" /></span><h3>Today's interview questions</h3>
      <span className="muted">{L.questions.length}</span></header>
      <div className="card-pad">{L.questions.map(q => <Question key={q.id} q={q} />)}</div></section>
  </>;
}

function Reviews({ s, reload }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const q = s.due[i];
  if (!q) return <Empty icon="check" title="No reviews due">Questions from the days you finish come back here on a spaced schedule (FSRS), just before you'd forget them.</Empty>;
  const grade = async r => {
    setBusy(true);
    try { await api(`/api/learning/review/${encodeURIComponent(q.id)}`, { json: { rating: r } }); await reload(); setI(0); } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <section className="card card-pad lr-review">
      <span className="muted">{s.due_count} due · {q.track_title} · Day {q.day}: {q.topic}</span>
      <h3>{q.question}</h3>
      <Reveal label="Show the answer">
        <p>{q.answer}</p>
        <div className="lr-grades"><span className="help">How well did you remember it?</span>
          {GRADES.map(([k, l, tone]) => <Button key={k} size="sm" className={`tone-${tone}`} disabled={busy} onClick={() => grade(k)}>{l}</Button>)}</div>
      </Reveal>
    </section>
  );
}

function CourseMap({ s, onOpen }) {
  const [d, setD] = useState(null);
  useEffect(() => { api("/api/learning/syllabus").then(setD).catch(fail); }, [s.done.length]);
  if (!d) return <Spinner />;
  return <div className="lr-map">{d.weeks.map(w => (
    <section key={w.week} className="card card-pad">
      <div className="lr-week"><b>Week {w.week}</b><span>{w.title}</span><span className="muted">{w.project}</span></div>
      <div className="lr-days">{w.days.map(x => (
        <button key={x.day} type="button" className={`lr-dot ${x.done ? "on" : ""} ${x.day === s.current ? "now" : ""}`} title={`Day ${x.day}: ${x.title}`} onClick={() => onOpen(x.day)}>{x.day}</button>
      ))}</div>
    </section>))}</div>;
}

function DayView({ day, onBack }) {
  const [d, setD] = useState(null);
  useEffect(() => { api(`/api/learning/day/${day}`).then(setD).catch(fail); }, [day]);
  if (!d) return <Spinner />;
  const L = d.lesson;
  return <>
    <Button variant="ghost" icon="arrow-left" onClick={onBack}>Course map</Button>
    <div className="lr-hero card"><div><span className="lr-day">Day {day} · Week {L.spec.week}</span><h2>{L.spec.title}</h2>
      <ul className="lr-obj">{(L.spec.objectives || []).map((o, i) => <li key={i}>{o}</li>)}</ul></div>{d.done && <Badge tone="ok">Done</Badge>}</div>
    <div className="lr-grid">{L.tracks.map(t => <Track key={t.key} t={t} />)}</div>
  </>;
}

function Questions() {
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const dq = useDebounced(q, 300);
  useEffect(() => { setPage(1); }, [dq, track]);
  useEffect(() => { api(`/api/learning/questions?q=${encodeURIComponent(dq)}&track=${track}&page=${page}`).then(setD).catch(fail); }, [dq, track, page]);
  return <>
    <div className="lr-qbar">
      <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search 564 interview questions" aria-label="Search questions" />
      <Seg size="sm" value={track} onChange={setTrack} options={[["", "All"], ...(d?.tracks || []).map(t => [t.key, t.title])]} />
    </div>
    {d && <><p className="muted">{d.total} question{d.total === 1 ? "" : "s"}</p>
      {d.items.map(x => <section key={x.id} className="card card-pad"><span className="muted">{x.track_title} · Day {x.day} · {x.topic}</span><Question q={x} /></section>)}
      {d.pages > 1 && <div className="lr-pager"><Button size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <span>Page {d.page} of {d.pages}</span><Button size="sm" disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}>Next</Button></div>}</>}
  </>;
}

export function Briefing({ compact = false }) {
  const [d, setD] = useState(null);
  const load = () => api("/api/learning/briefing").then(setD).catch(fail);
  useEffect(() => { load(); }, []);
  useEffect(() => { if (d?.building) { const t = setTimeout(load, 4000); return () => clearTimeout(t); } }, [d]);
  const rebuild = async () => { try { await api("/api/learning/briefing", { json: {} }); setD(x => ({ ...x, building: true })); } catch (e) { fail(e); } };
  const b = d?.briefing;
  if (!d) return <Spinner />;
  if (!b) return <Empty icon="sparkles" title={d.building ? "Writing today's briefing…" : "No briefing yet"}>{d.building ? "Reading papers, tech news and new GitHub projects. This takes a minute." : "It's written each morning."}</Empty>;
  const r = b.report, n = b.notes || {};
  return (
    <div className="lr-brief">
      <div className="lr-brief-head"><h3>Briefing · {new Date(b.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3><span className="grow" />
        {!compact && <Button size="sm" variant="ghost" icon="refresh" busy={d.building} onClick={rebuild}>Rebuild</Button>}</div>
      {n.focus && <Alert tone="info" icon="sparkles">{n.focus}</Alert>}
      <div className="kpis four">
        <Kpi icon="book" label="Today's lesson" value={b.goal.day} sub={b.goal.title} />
        <Kpi icon="refresh" label="Reviews due" value={b.goal.due_reviews} />
        <Kpi icon="clock" label="Follow-ups due" value={r.followups.length} href="/app/applications" />
        <Kpi icon="zap" label="Strong matches to apply" value={r.matches.length} href="/app/ai-jobs" />
      </div>
      {!compact && <div className="lr-brief-grid">
        <section className="card"><header className="card-head"><h3>Your job search</h3></header><div className="card-pad">
          <p className="muted">Yesterday: {r.applied} applied · {r.heard} heard back · {r.interviews} interviews</p>
          {r.followups.length > 0 && <><b>Follow up</b><ul>{r.followups.map((f, i) => <li key={i}>{f.company}: {f.role}{f.overdue ? ` (${f.overdue} days overdue)` : ""}</li>)}</ul></>}
          {r.matches.length > 0 && <><b>Apply to</b><ul>{r.matches.map((m, i) => <li key={i}>{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer">{m.title}</a> : m.title} · {m.company} <Badge tone="ok">{m.score}</Badge></li>)}</ul></>}
        </div></section>
        <section className="card"><header className="card-head"><h3>Papers</h3></header><div className="card-pad">
          {b.papers.map((p, i) => <div key={p.url} className="lr-item"><a href={p.url} target="_blank" rel="noopener noreferrer"><b>{p.title}</b></a>
            <span className="muted">{p.authors} · {p.published}</span><p>{(n.papers || [])[i] || p.summary}</p></div>)}
        </div></section>
        <section className="card"><header className="card-head"><h3>Tech news</h3></header><div className="card-pad"><ul className="lr-news">
          {b.news.map(x => <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a> <a className="muted" href={x.comments} target="_blank" rel="noopener noreferrer">{x.points} points</a></li>)}
        </ul></div></section>
        <section className="card"><header className="card-head"><h3>New on GitHub</h3></header><div className="card-pad">
          {b.repos.map((x, i) => <div key={x.url} className="lr-item"><a href={x.url} target="_blank" rel="noopener noreferrer"><b>{x.name}</b></a>
            <span className="muted">★ {x.stars}{x.language ? ` · ${x.language}` : ""}</span><p>{(n.repos || [])[i] || x.description}</p></div>)}
        </div></section>
      </div>}
    </div>
  );
}

export default function Learning() {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("today");
  const [day, setDay] = useState(null);
  const reload = () => api("/api/learning").then(setS).catch(fail);
  useEffect(() => { reload(); }, []);
  const a = s?.activity;
  const pct = useMemo(() => (s ? Math.round(s.done.length / 90 * 100) : 0), [s]);
  if (!s) return <Spinner />;
  return (
    <div className="lr">
      <div className="kpis four">
        <Kpi icon="check" label="Course" value={pct} suffix="%" sub={`${s.done.length} of 90 days`} />
        <Kpi icon="zap" label="Streak" value={a.current_streak || 0} sub={`best ${a.best_streak || 0} days`} />
        <Kpi icon="star" label="Level" value={a.level || 1} sub={`${a.xp || 0} XP`} />
        <Kpi icon="refresh" label="Reviews due" value={s.due_count} />
      </div>
      <Seg value={tab} onChange={t => { setTab(t); setDay(null); }} options={[["today", "Today", "calendar"], ["briefing", "Briefing", "sparkles"],
        ["reviews", "Reviews", "refresh", s.due_count || undefined], ["map", "Course map", "grid"], ["questions", "Question bank", "message"]]} />
      <div className="lr-pane">
        {tab === "today" && (s.finished && !s.completed_today ? <Empty icon="star" title="You finished the 90-day course">Keep your reviews going and use the question bank before interviews.</Empty> : <Today s={s} reload={reload} />)}
        {tab === "briefing" && <Briefing />}
        {tab === "reviews" && <Reviews s={s} reload={reload} />}
        {tab === "map" && (day ? <DayView day={day} onBack={() => setDay(null)} /> : <CourseMap s={s} onOpen={setDay} />)}
        {tab === "questions" && <Questions />}
      </div>
      <p className="help lr-credit">Course content, spaced review and briefing adapted from <a href="https://github.com/GuptaSoujanya/Morrow" target="_blank" rel="noopener noreferrer">Morrow</a> (MIT licence).</p>
    </div>
  );
}
