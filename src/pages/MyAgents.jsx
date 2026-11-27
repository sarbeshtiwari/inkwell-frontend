import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { ago } from "../lib/format";
import { go } from "../lib/router";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, Field, Sk, Switch, fail, toast } from "../ui/kit";

// Start your agents and follow what they did. What they want to do outside Inkwell waits in Approvals.
const NAMES = {
  orchestrator: "Find and prepare applications", outreach: "Email campaign", communicator: "Handle replies",
  inbox_watcher: "Sort my inbox", job_alerts: "Check job alerts", weekly_digest: "Weekly summary", morning: "Morning routine",
};
const HIDDEN = new Set(["job_scout", "job_analyst", "researcher", "writer", "applicant"]);  // started by the Orchestrator
const TONE = { done: "ok", failed: "bad", dead_letter: "bad", cancelled: "muted", queued: "", running: "brand",
  waiting_approval: "warn", waiting_children: "brand" };
const STATUS = { waiting_approval: "waiting for you", waiting_children: "working", dead_letter: "gave up" };
const name = id => NAMES[id] || id.replace(/_/g, " ");

export default function MyAgents() {
  const [agents, setAgents] = useState(null);
  const [mode, setMode] = useState("");
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => api("/api/agents/tasks").then(r => setRows(r.tasks.filter(t => !HIDDEN.has(t.agent_id)))).catch(fail), []);
  useEffect(() => {
    api("/api/agents").then(r => setAgents(r.agents.filter(a => !HIDDEN.has(a.id)))).catch(fail);
    api("/api/agents/mode").then(r => setMode(r.mode)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  return (
    <div className="stack">
      {mode && <Alert tone={mode === "on" ? "ok" : mode === "off" ? "bad" : "info"}>
        Your agents are <b>{mode}</b>. {mode === "shadow" ? "They look and report what they would do, but change nothing and contact no one." :
          mode === "on" ? "They can act for you; every message or application still waits in Approvals for your yes." : "They don't run."}
        {" "}<a href="/app/approvals" onClick={e => { e.preventDefault(); go("approvals"); }}>Change it in Approvals</a>.</Alert>}
      <FindJobs onStarted={load} disabled={mode === "off"} />
      <div className="card card-pad">
        <b>Other agents</b>
        <div className="stack-sm">
          {!agents ? <Sk w="60%" /> : agents.filter(a => a.id !== "orchestrator").map(a => <RunAgent key={a.id} a={a} onStarted={load} disabled={mode === "off"} />)}
        </div>
      </div>
      <div className="card card-pad">
        <b>Recent runs</b>
        <div className="stack-sm">
          {!rows ? <Sk w="70%" /> : !rows.length ? <Empty icon="sparkles" title="No runs yet">Start an agent above.</Empty> :
            rows.map(t => (
              <div key={t.id} className="row-xs" style={{ justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpen(t.id)}>
                <span>{name(t.agent_id)} <span className="small-label">· {ago(t.created_at)}</span></span>
                <Badge tone={TONE[t.status]}>{STATUS[t.status] || t.status.replace(/_/g, " ")}</Badge>
              </div>))}
        </div>
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} wide label="Agent run">
        {open && <RunDetail id={open} onClose={() => setOpen(null)} />}
      </Drawer>
    </div>
  );
}

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
        <Field label="Goal (optional)"><input value={f.goal} placeholder="e.g. 5 remote backend roles at product companies" onChange={set("goal")} /></Field>
        <div className="row-3">
          <Field label="Role"><input value={f.role} placeholder="e.g. Backend Developer" onChange={set("role")} /></Field>
          <Field label="Years of experience"><input type="number" min="0" value={f.years} onChange={set("years")} /></Field>
          <Field label="Location"><input value={f.location} placeholder="any" onChange={set("location")} /></Field>
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
    <div className="row-xs" style={{ justifyContent: "space-between", gap: 12 }}>
      <span><b>{name(a.id)}</b> <span className="small-label">· {a.description}</span></span>
      <Button size="sm" busy={busy} disabled={disabled} onClick={run}>Run now</Button>
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
