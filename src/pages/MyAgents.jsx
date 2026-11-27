import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { ago } from "../lib/format";
import { go } from "../lib/router";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, Field, Sk, SkBlock, Switch, fail, toast } from "../ui/kit";

// Your agents in a plain list; clicking one opens its own page with what it is doing now, its recent runs and its
// numbers. What they want to do outside Inkwell waits in Approvals.
const ABOUT = {  // what each one does, in a sentence
  orchestrator: "Takes a role you want, sends the scout and analyst out, and puts the shortlist on AI job match.",
  job_scout: "Searches company career sites and job boards for open roles in the place you asked for.",
  job_analyst: "Scores each job against your resume and says why it fits or doesn't.",
  researcher: "Reads a company's own website for size, team and hiring contacts.",
  writer: "Reorders your resume and drafts a cover letter for one job. Nothing is sent.",
  applicant: "Fills in the application form once you've approved it.",
  communicator: "Reads replies to your emails and drafts an answer for you to approve.",
  inbox_watcher: "Files interview invites, rejections and recruiter mail as they arrive.",
  outreach: "Sends a campaign you've written, one person at a time, after you approve it.",
  job_alerts: "Reads job-alert emails and tells you which new jobs are worth opening.",
  weekly_digest: "Sends a Monday note: strong matches, follow-ups due and replies.",
  morning: "Syncs your mail each morning and lists what needs you today.",
  email_finder: "Finds the hiring addresses companies publish on their own sites.",
};
const NAMES = {
  orchestrator: "Find and prepare applications", outreach: "Email campaign", communicator: "Handle replies",
  inbox_watcher: "Sort my inbox", email_finder: "Email finder", job_alerts: "Check job alerts", weekly_digest: "Weekly summary", morning: "Morning routine",
};
const MEMBER = new Set(["job_scout", "job_analyst", "researcher", "writer", "applicant"]);  // started by the Orchestrator
const TONE = { done: "ok", failed: "bad", dead_letter: "bad", cancelled: "muted", queued: "", running: "brand",
  waiting_approval: "warn", waiting_children: "brand" };
const STATUS = { waiting_approval: "waiting for you", waiting_children: "working", dead_letter: "gave up" };
const name = id => NAMES[id] || id.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());

const about = id => ABOUT[id] || "";

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
  const table = (title, list) => (
    <div className="card table-card">
      <div className="card-head"><h3>{title}</h3></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Agent</th><th>Now</th><th>Last run</th></tr></thead>
        <tbody>{list.map(a => <AgentRow key={a.id} a={a} busy={busy(a.id)} last={last(a.id)} />)}</tbody>
      </table></div>
    </div>
  );
  return (
    <div className="stack">
      {mode && <ModeLine mode={mode} />}
      {!agents ? <SkBlock h={320} /> : <>
        {table("Your agents", lead)}
        {table("Job search team · started by Find and prepare applications", team)}
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

function AgentRow({ a, busy, last }) {
  const open = () => go(`my-agents/${a.id}`);
  const now = busy[0];
  return (
    <tr className="click" onClick={open}>
      <td>
        <a href={`/app/my-agents/${a.id}`} onClick={e => { e.preventDefault(); open(); }} className="ag-name">{name(a.id)}</a>
        <div className="ag-about">{about(a.id) || a.description}</div>
      </td>
      <td className="ag-now">{now ? <Badge tone={TONE[now.status]}>{STATUS[now.status] || now.status.replace(/_/g, " ")}</Badge>
        : <span className="ag-muted">Idle</span>}</td>
      <td className="ag-last">{last ? <>{ago(last.created_at)} <span className="ag-muted">· {STATUS[last.status] || last.status.replace(/_/g, " ")}</span></>
        : <span className="ag-muted">Never</span>}</td>
    </tr>
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
      <div className="ag-head">
        <h2>{name(id)}</h2>
        <p>{about(id) || d?.agent.description}</p>
        {d && <div className="ag-meta">
          Version {d.agent.version} · {d.mode === "on" ? "On" : d.mode === "off" ? "Off" : "Shadow (looks, changes nothing)"}
          {d.agent.paused && <> · <b className="ag-bad">paused by the Super Admin</b></>}
          {d.pending_approvals > 0 && <> · <a href="/app/approvals" onClick={e => { e.preventDefault(); go("approvals"); }}>
            {d.pending_approvals} waiting for your approval</a></>}
        </div>}
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
      <b>{NAMES.orchestrator}</b>
      <div className="small-label" style={{ marginTop: 4 }}>The Orchestrator plans it: the Job Scout searches, the Job Analyst ranks and checks your rules, the Researcher looks up companies, the Writer drafts, the Applicant applies after you approve each one.</div>
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
    <DrawerHead title={t ? name(t.agent_id) : "Agent run"} onClose={onClose} />
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
