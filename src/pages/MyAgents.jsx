import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { ago } from "../lib/format";
import { go } from "../lib/router";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, Field, Sk, SkBlock, Switch, fail, toast } from "../ui/kit";

import { Robot, agentAbout, agentColor, agentLabel, agentName, agentRole } from "./agents/crew";

// Your crew of agents, each with a name and a robot; clicking one opens their own page with what they are doing now,
// their recent runs and numbers. What they want to do outside Inkwell waits in Approvals.
const MEMBER = new Set(["job_scout", "job_analyst", "researcher", "writer", "applicant"]);  // started by the Orchestrator
const TONE = { done: "ok", failed: "bad", dead_letter: "bad", cancelled: "muted", queued: "", running: "brand",
  waiting_approval: "warn", waiting_children: "brand" };
const STATUS = { waiting_approval: "waiting for you", waiting_children: "working", dead_letter: "gave up" };
const name = agentName;
const about = agentAbout;

export default function MyAgents({ route }) {
  return route?.param ? <AgentPage id={route.param} /> : <Overview />;
}

function Overview() {
  const [agents, setAgents] = useState(null);
  const [mode, setMode] = useState("");
  const [rows, setRows] = useState([]);
  const load = useCallback(() => api("/api/agents/tasks").then(r => setRows(r.tasks)).catch(() => {}), []);
  useEffect(() => {
    api("/api/agents").then(r => setAgents(r.agents)).catch(fail);
    api("/api/agents/mode").then(r => setMode(r.mode)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  const busy = id => rows.filter(t => t.agent_id === id && !["done", "failed", "cancelled", "dead_letter"].includes(t.status));
  const last = id => rows.find(t => t.agent_id === id);
  const lead = (agents || []).filter(a => !MEMBER.has(a.id)), team = (agents || []).filter(a => MEMBER.has(a.id));
  const grid = list => <div className="crew-grid">{list.map(a => <AgentCard key={a.id} a={a} busy={busy(a.id)} last={last(a.id)} />)}</div>;
  return (
    <div className="stack">
      {mode && <ModeLine mode={mode} />}
      {!agents ? <div className="crew-grid">{[0, 1, 2, 3].map(i => <div key={i} className="card sk-card" style={{ height: 190 }} />)}</div> : <>
        <h3 className="sec-title">Your crew</h3>
        {grid(lead)}
        <h3 className="sec-title">Maya's job search team <span className="crew-sub">she sends them out when you look for jobs</span></h3>
        {grid(team)}
      </>}
    </div>
  );
}

function ModeLine({ mode }) {
  const text = mode === "on" ? "Agents are on. Anything they'd send or submit waits in Approvals for your yes."
    : mode === "shadow" ? "Agents are in shadow mode: they look and report what they would do, and change nothing."
      : "Agents are off.";
  return <p className="ag-mode">{text} <a href="/app/approvals" onClick={e => { e.preventDefault(); go("approvals"); }}>Change</a></p>;
}

function AgentCard({ a, busy, last }) {
  const now = busy[0];
  const open = e => { e.preventDefault(); go(`my-agents/${a.id}`); };
  return (
    <a href={`/app/my-agents/${a.id}`} onClick={open} className={`card crew-card ${now ? "working" : ""}`} style={{ "--rb": agentColor(a.id) }}>
      <div className="crew-top">
        <span className="crew-av"><Robot id={a.id} size={64} working={!!now} />{now && <i className="crew-live" />}</span>
        <div className="crew-who"><b>{agentName(a.id)}</b><span>{agentRole(a.id)}</span></div>
      </div>
      <p className="crew-about">{about(a.id) || a.description}</p>
      <div className="crew-foot">
        {now ? <span className="crew-now">Working · {STATUS[now.status] || now.status.replace(/_/g, " ")}</span>
          : last ? <span>Last worked {ago(last.created_at)} · {STATUS[last.status] || last.status.replace(/_/g, " ")}</span>
            : <span>Hasn't worked yet</span>}
      </div>
    </a>
  );
}

function AgentPage({ id }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const load = useCallback(() => api(`/api/agents/${id}`).then(r => { setD(r); setErr(""); }).catch(e => setErr(e.message)), [id]);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);
  if (err) return <div className="card"><Empty icon="alert" title="Couldn't load this agent">{err}</Empty></div>;
  const cur = d?.current;
  return (
    <div className="stack">
      <a href="/app/my-agents" className="small-label" onClick={e => { e.preventDefault(); go("my-agents"); }}>← All agents</a>
      <div className="ag-head" style={{ "--rb": agentColor(id) }}>
        <Robot id={id} size={92} working={!!cur} />
        <div style={{ minWidth: 0 }}>
        <h2>{agentName(id)} <span className="crew-role">{agentRole(id)}</span></h2>
        <p>{about(id) || d?.agent.description}</p>
        {d && <div className="ag-meta">
          Version {d.agent.version} · {d.mode === "on" ? "On" : d.mode === "off" ? "Off" : "Shadow (looks, changes nothing)"}
          {d.agent.paused && <> · <b className="ag-bad">paused by the Super Admin</b></>}
          {d.pending_approvals > 0 && <> · <a href="/app/approvals" onClick={e => { e.preventDefault(); go("approvals"); }}>
            {d.pending_approvals} waiting for your approval</a></>}
        </div>}
        </div>
      </div>
      {!d ? <SkBlock h={200} /> : <>
        <div className="kpis four">
          <Stat label="Runs (30 days)" value={d.stats.runs_30d} />
          <Stat label="Finished" value={d.stats.done || 0} />
          <Stat label="Failed" value={(d.stats.failed || 0) + (d.stats.dead_letter || 0)} />
          <Stat label="Model calls · tokens" value={`${d.usage.calls} · ${d.usage.tokens}`} />
        </div>
        <div className="card card-pad">
          <b>Working on now</b>
          {!cur ? <div className="small-label" style={{ marginTop: 8 }}>Nothing right now.</div> : <div className="stack-sm">
            <div className="row-xs" style={{ justifyContent: "space-between" }}>
              <span>{STATUS[cur.status] || cur.status.replace(/_/g, " ")} · started {ago(cur.created_at)} · attempt {cur.attempts}</span>
              <Button size="sm" onClick={() => setOpen(cur.id)}>Open</Button>
            </div>
            {cur.doing && <div className="small-label">Current step: {cur.doing_type?.replace(/_/g, " ")} · {cur.doing}</div>}
            {cur.children?.length > 0 && <div className="row-xs" style={{ flexWrap: "wrap" }}>{cur.children.map(c => (
              <Badge key={c.id} tone={TONE[c.status]}>{name(c.agent_id)}: {STATUS[c.status] || c.status.replace(/_/g, " ")}</Badge>))}</div>}
          </div>}
        </div>
        {id === "orchestrator" ? <FindJobs onStarted={load} disabled={d.mode === "off"} />
          : id === "email_finder" ? <div className="card card-pad row-xs" style={{ justifyContent: "space-between" }}>
            <span className="small-label">Give it company websites on the Email finder page.</span>
            <Button variant="primary" size="sm" onClick={() => go("finder")}>Open Email finder</Button></div>
          : !MEMBER.has(id) && <RunAgent a={{ id, description: d.agent.description }} onStarted={load} disabled={d.mode === "off"} />}
        <div className="card card-pad">
          <b>Recent runs</b>
          <div className="stack-sm">{!d.runs.length ? <div className="small-label">No runs yet.</div> : d.runs.map(t => (
            <div key={t.id} className="row-xs ag-run" onClick={() => setOpen(t.id)}>
              <span>{ago(t.created_at)}{t.depth > 0 ? " · for the Orchestrator" : ""}{t.error_class ? ` · ${t.error_class.replace(/_/g, " ")}` : ""}</span>
              <Badge tone={TONE[t.status]}>{STATUS[t.status] || t.status.replace(/_/g, " ")}</Badge>
            </div>))}</div>
        </div>
        <div className="card card-pad">
          <b>Tools it may use</b>
          <div className="row-xs" style={{ flexWrap: "wrap", marginTop: 8 }}>{d.agent.tools.length ? d.agent.tools.map(t => <Badge key={t}>{t}</Badge>)
            : <span className="small-label">None: it delegates to other agents.</span>}</div>
          <div className="small-label" style={{ marginTop: 8 }}>At most {d.agent.max_steps} steps per run.</div>
        </div>
      </>}
      <Drawer open={!!open} onClose={() => setOpen(null)} wide label="Agent run">
        {open && <RunDetail id={open} onClose={() => setOpen(null)} />}
      </Drawer>
    </div>
  );
}

const Stat = ({ label, value }) => <div className="kpi card"><span className="small-label">{label}</span><b style={{ fontSize: 22 }}>{value}</b></div>;

function FindJobs({ onStarted, disabled }) {
  const [f, setF] = useState({ goal: "", role: "", years: "", location: "", count: 5, research: false, prepare: true, apply: false });
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const start = async () => {
    setBusy(true);
    try {
      const criteria = { role: f.role, years: Number(f.years) || 0, location: f.location, count: Number(f.count) || 5,
        research: f.research, prepare: f.prepare, apply: f.apply };
      await api("/api/agents/tasks", { json: { agent_id: "orchestrator", input: { goal: f.goal, criteria } } });
      toast("Started. Follow it below."); onStarted();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <div className="card card-pad">
      <b>Give Maya a job search</b>
      <div className="small-label" style={{ marginTop: 4 }}>Maya plans it: Arjun searches, Priya ranks, Kabir looks up companies, Ira drafts, and Dev applies after you approve each one.</div>
      <div className="stack-sm">
        <Field label="Goal (optional)"><input className="input" value={f.goal} placeholder="e.g. 5 remote backend roles at product companies" onChange={set("goal")} /></Field>
        <div className="row-3">
          <Field label="Role"><input className="input" value={f.role} placeholder="e.g. Backend Developer" onChange={set("role")} /></Field>
          <Field label="Years of experience"><input className="input" type="number" min="0" value={f.years} onChange={set("years")} /></Field>
          <Field label="Location"><input className="input" value={f.location} placeholder="any" onChange={set("location")} /></Field>
        </div>
        <div className="row-xs" style={{ flexWrap: "wrap", gap: 18 }}>
          <Switch checked={f.research} onChange={v => setF({ ...f, research: v })}>Research the companies</Switch>
          <Switch checked={f.prepare} onChange={v => setF({ ...f, prepare: v })}>Draft resume and cover letter</Switch>
          <Switch checked={f.apply} onChange={v => setF({ ...f, apply: v })}>Apply (each one needs your approval)</Switch>
        </div>
        <div className="row-xs" style={{ justifyContent: "flex-end" }}>
          <Button variant="primary" icon="sparkles" busy={busy} disabled={disabled || (!f.role && !f.goal)} onClick={start}>Start</Button>
        </div>
      </div>
    </div>
  );
}

function RunAgent({ a, onStarted, disabled }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await api("/api/agents/tasks", { json: { agent_id: a.id, input: {} } }); toast(`${name(a.id)}: started`); onStarted(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <div className="card card-pad row-xs" style={{ justifyContent: "space-between", gap: 12 }}>
      <span><b>Run it now</b> <span className="small-label">· {a.description}</span></span>
      <Button variant="primary" size="sm" busy={busy} disabled={disabled} onClick={run}>Run now</Button>
    </div>
  );
}

function RunDetail({ id, onClose }) {
  const [d, setD] = useState(null);
  const [trace, setTrace] = useState(null);
  useEffect(() => {
    api(`/api/agents/tasks/${id}`).then(setD).catch(fail);
    api(`/api/agents/tasks/${id}/trace`).then(r => setTrace(r.trace)).catch(() => {});
  }, [id]);
  const cancel = async () => { try { await api(`/api/agents/tasks/${id}/cancel`, { json: {} }); toast("Stopping at its next step"); onClose(); } catch (e) { fail(e); } };
  const t = d?.task, rep = t?.result?.report;
  return <>
    <DrawerHead title={t ? agentLabel(t.agent_id) : "Agent run"} onClose={onClose} />
    {!t ? <Sk w="60%" /> : <div className="stack" style={{ padding: 16 }}>
      <div className="row-xs" style={{ justifyContent: "space-between" }}>
        <Badge tone={TONE[t.status]}>{STATUS[t.status] || t.status.replace(/_/g, " ")}</Badge>
        {!["done", "failed", "cancelled", "dead_letter"].includes(t.status) && <Button size="sm" variant="danger" onClick={cancel}>Stop</Button>}
      </div>
      {t.status === "waiting_approval" && <Alert tone="warn">Waiting for you in <a href="/app/approvals" onClick={e => { e.preventDefault(); go("approvals"); }}>Approvals</a>.</Alert>}
      {t.error && <Alert tone="bad">{t.error}</Alert>}
      {rep ? <Report rep={rep} /> : t.result && <Notes notes={t.result.notes} outcomes={t.result.outcomes || t.result.outcome} />}
      {trace && <div className="stack-sm"><b>Steps</b>{trace.spans.filter(s => s.type !== "model_call").map(s => (
        <div key={s.span_id} className="small-label">{s.status === "error" ? "✗" : "✓"} {s.type.replace(/_/g, " ")}: {s.name}{s.error_class ? ` (${s.error_class})` : ""} · {s.ms} ms</div>))}
        <div className="small-label">{trace.trace?.totals?.model_calls || 0} model calls · {(trace.trace?.totals?.input_tokens || 0) + (trace.trace?.totals?.output_tokens || 0)} tokens</div>
      </div>}
    </div>}
  </>;
}

function Report({ rep }) {
  return <div className="stack-sm">
    <div className="small-label">Looked for {rep.criteria?.role}{rep.criteria?.location ? ` in ${rep.criteria.location}` : ""} · {rep.found} found · {rep.analysed} analysed · mode {rep.mode}</div>
    {rep.problems?.map(p => <Alert key={p} tone="warn">{p}</Alert>)}
    <b>Recommended</b>
    {!rep.recommended?.length ? <div className="small-label">Nothing strong enough this time.</div> : rep.recommended.map(p => (
      <div key={p.id} className="card card-pad">
        <div className="row-xs" style={{ justifyContent: "space-between" }}><b>{p.title} · {p.company}</b><Badge tone="ok">{p.model_fit ?? p.score}</Badge></div>
        {p.verdict && <div className="small-label">{p.verdict}</div>}
        {p.reasons?.length > 0 && <div className="small-label">✓ {p.reasons.slice(0, 3).join(" · ")}</div>}
        {p.gaps?.length > 0 && <div className="small-label">△ {p.gaps.slice(0, 3).join(" · ")}</div>}
        {p.materials?.cover_letter && <details><summary className="small-label">Draft cover letter</summary><p style={{ whiteSpace: "pre-wrap" }}>{p.materials.cover_letter}</p></details>}
        {p.application && <div className="small-label">Application: {p.application.state.replace(/_/g, " ")}{p.application.detail ? ` · ${p.application.detail}` : ""}</div>}
      </div>))}
    {rep.skipped_for_rules?.length > 0 && <><b>Skipped (your rules)</b>{rep.skipped_for_rules.map(s => <div key={s.id} className="small-label">{s.title} · {s.company}: {s.rule_breaks[0]?.rule}</div>)}</>}
  </div>;
}

function Notes({ notes, outcomes }) {
  const list = Array.isArray(outcomes) ? outcomes : outcomes ? [outcomes] : [];
  return <div className="stack-sm">
    {(notes || []).map((n, i) => <div key={i} className="small-label">{n}</div>)}
    {list.map((o, i) => <div key={i} className="small-label">→ {o.state || o.would}{o.why ? `: ${o.why}` : ""}{o.detail ? ` · ${o.detail}` : ""}</div>)}
  </div>;
}
