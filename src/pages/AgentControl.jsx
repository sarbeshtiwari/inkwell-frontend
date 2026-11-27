import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { ago } from "../lib/format";
import { useApp } from "../lib/store";
import { Alert, Badge, Button, Chips, Empty, Field, Sk, fail, modal, toast } from "../ui/kit";

// Super Admin only: the Supervisor and every control over the agents. All of it is metadata: no user content.
export default function AgentControl() {
  const { me } = useApp();
  if (me && me.role !== "super_admin") return <div className="card"><Empty icon="shield" title="Super Admin only">This page controls every agent for every user.</Empty></div>;
  return <div className="stack"><Supervisor /><Switches /><Model /><Budgets /></div>;
}

// Every control change needs a short reason: it goes into the audit log.
const askReason = async label => {
  const r = await modal({ title: label, text: "Reason (recorded in the audit log):", input: "", confirm: "Confirm" });
  if (r === null || r === undefined || r === false) return null;
  if (String(r).trim().length < 5) { toast("Give a reason of at least 5 characters.", true); return null; }
  return String(r).trim();
};

function Card({ title, sub, right, children }) {
  return (
    <div className="card card-pad">
      <div className="row-xs" style={{ justifyContent: "space-between", flexWrap: "wrap" }}><b>{title}</b>{right}</div>
      {sub && <div className="small-label" style={{ marginTop: 4 }}>{sub}</div>}
      <div className="stack-sm">{children}</div>
    </div>
  );
}

function Supervisor() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/api/admin/supervisor?limit=10").then(setD).catch(fail), []);
  useEffect(() => { load(); }, [load]);
  const setMode = async mode => {
    if (!d || mode === d.mode) return;
    const reason = await askReason(mode === "act" ? "Let the Supervisor pause failing agents and cancel stuck tasks?" : "Supervisor reports only?");
    if (!reason) return;
    try { await api("/api/admin/supervisor", { method: "PUT", json: { mode, reason } }); toast(`Supervisor: ${mode}`); load(); } catch (e) { fail(e); }
  };
  const runNow = async () => {
    setBusy(true);
    try { const r = await api("/api/admin/supervisor/run", { json: {} }); toast(r.report ? "Check done" : "The Supervisor is stopped (kill switch)"); load(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  const last = d?.reports?.[0];
  return (
    <Card title="Supervisor" sub="An agent that checks every agent every 5 minutes. In Observe it only reports; in Act it may pause a failing agent or cancel a stuck task. Only you can undo that."
      right={d ? <div className="row-xs"><Chips value={d.mode} onChange={setMode} options={[["observe", "Observe"], ["act", "Act"]]} />
        <Button size="sm" icon="refresh" busy={busy} onClick={runNow}>Check now</Button></div> : <Sk w={220} h={28} />}>
      {!d ? <Sk w="70%" /> : !last ? <div className="small-label">No checks yet.</div> : <>
        <div className="small-label">Last check {ago(last.at)} · {last.notes?.[0]}</div>
        {last.findings.length ? last.findings.map(f => (
          <Alert key={f.kind + f.subject} tone={f.kind === "failing_agent" || f.kind === "model_errors" ? "bad" : "warn"}>
            <b>{f.subject}</b>: {f.detail}</Alert>
        )) : <Alert tone="ok">Every agent looks healthy.</Alert>}
        {last.actions?.map((a, i) => <div key={i} className="small-label">→ {a.tool.replace("supervision.", "")} {a.args?.agent_id || a.args?.task_id || ""}: {typeof a.result === "string" ? a.result : "done"}</div>)}
        <AgentTable agents={last.health?.agents || {}} queue={last.health?.queue} />
      </>}
    </Card>
  );
}

function AgentTable({ agents, queue }) {
  const rows = Object.entries(agents);
  return <>
    {queue && <div className="small-label">Queue: {queue.queued} waiting (oldest {queue.oldest_minutes} min) · {queue.waiting_approval} waiting for approval · {queue.dead_letter_recent} gave up recently</div>}
    {rows.length > 0 && <table className="table"><thead><tr><th>Agent</th><th>Runs (last hour)</th><th>Failed</th><th>Errors</th></tr></thead>
      <tbody>{rows.map(([id, a]) => <tr key={id}><td>{id.replace(/_/g, " ")}</td><td>{a.runs}</td><td>{a.failed}</td>
        <td>{Object.entries(a.error_classes || {}).map(([k, n]) => `${k} ×${n}`).join(", ")}</td></tr>)}</tbody></table>}
  </>;
}

function Switches() {
  const [rows, setRows] = useState(null);
  const [agents, setAgents] = useState([]);
  const load = useCallback(() => api("/api/admin/kill-switches").then(r => setRows(r.switches)).catch(fail), []);
  useEffect(() => { load(); api("/api/agents").then(r => setAgents(r.agents.map(a => a.id))).catch(() => {}); }, [load]);
  const active = new Set((rows || []).filter(s => s.active).map(s => s.scope));
  const toggle = async (scope, label) => {
    const on = active.has(scope);
    const reason = await askReason(on ? `Resume ${label}?` : `Stop ${label}? Running work stops at its next step.`);
    if (!reason) return;
    const target = scope === "global" ? {} : { agent_id: scope.slice(6) };
    try {
      await api(`/api/admin/kill-switches${on ? "/clear" : ""}`, { json: { ...target, reason, ...(on ? {} : { cancel_running: true }) } });
      toast(on ? `${label} resumed` : `${label} stopped`); load();
    } catch (e) { fail(e); }
  };
  return (
    <Card title="Kill switches" sub="Stop agents at once, for everyone. Each change is recorded in the audit log.">
      {!rows ? <Sk w="60%" /> : <>
        <div className="row-xs" style={{ justifyContent: "space-between" }}><b>All agents</b>
          <Button size="sm" variant={active.has("global") ? "primary" : "danger"} onClick={() => toggle("global", "all agents")}>
            {active.has("global") ? "Resume all" : "Stop all"}</Button></div>
        {[...new Set(["supervisor", ...agents])].map(id => (
          <div key={id} className="row-xs" style={{ justifyContent: "space-between" }}>
            <span>{id.replace(/_/g, " ")} {active.has(`agent:${id}`) && <Badge tone="bad">stopped</Badge>}</span>
            <Button size="sm" variant="ghost" onClick={() => toggle(`agent:${id}`, id.replace(/_/g, " "))}>{active.has(`agent:${id}`) ? "Resume" : "Stop"}</Button>
          </div>))}
        {rows.filter(s => s.active && s.by?.startsWith("agent:")).map(s => <div key={s.scope} className="small-label">{s.scope}: {s.reason}</div>)}
      </>}
    </Card>
  );
}

function Model() {
  const [d, setD] = useState(null);
  const [f, setF] = useState({ provider: "anthropic", model: "" });
  const load = useCallback(() => api("/api/admin/model").then(r => { setD(r); if (r.config) setF({ provider: r.config.provider, model: r.config.model }); }).catch(fail), []);
  useEffect(() => { load(); }, [load]);
  const save = async clear => {
    const reason = await askReason(clear ? "Go back to each user's own model?" : `Use ${f.model} for every agent?`);
    if (!reason) return;
    try { await api("/api/admin/model", { method: "PUT", json: clear ? { provider: null, reason } : { ...f, reason } }); toast("Saved"); load(); } catch (e) { fail(e); }
  };
  return (
    <Card title="Agents' model" sub="One model for every agent, paid with the platform key set on the server. Without one, agents use each user's own model settings.">
      {!d ? <Sk w="50%" /> : <>
        <div className="small-label">Now: {d.config ? `${d.config.model} (${d.config.provider}), version ${d.config.version}` : "each user's own model"}</div>
        <div className="row-2">
          <Field label="Provider"><select className="select" value={f.provider} onChange={e => setF({ ...f, provider: e.target.value })}>
            {d.providers.map(p => <option key={p.id} value={p.id} disabled={!p.key_configured}>{p.label}{p.key_configured ? "" : " (no key on the server)"}</option>)}</select></Field>
          <Field label="Model"><input value={f.model} placeholder="e.g. claude-sonnet-5-5" onChange={e => setF({ ...f, model: e.target.value })} /></Field>
        </div>
        <div className="row-xs" style={{ justifyContent: "flex-end" }}>
          {d.config && <Button variant="ghost" onClick={() => save(true)}>Use users' own models</Button>}
          <Button variant="primary" disabled={!f.model} onClick={() => save(false)}>Save</Button>
        </div>
      </>}
    </Card>
  );
}

const LIMITS = [["daily_calls", "Calls a day"], ["daily_tokens", "Tokens a day"], ["daily_cost", "Cost a day ($)"],
  ["monthly_calls", "Calls a month"], ["monthly_tokens", "Tokens a month"], ["monthly_cost", "Cost a month ($)"]];

function Budgets() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api("/api/admin/budgets").then(r => setRows(r.budgets)).catch(fail), []);
  useEffect(() => { load(); }, [load]);
  return (
    <Card title="Budgets" sub="Platform-paid model use stops once a limit is reached. Empty means no limit.">
      {!rows ? <Sk w="50%" /> : [["user_default", "Each user", { per_user: true }], ["global", "The whole service", {}]].map(([scope, label, target]) =>
        <BudgetRow key={scope} label={label} target={target} current={rows.find(r => r.scope === scope)?.limits || {}} onSaved={load} />)}
    </Card>
  );
}

function BudgetRow({ label, target, current, onSaved }) {
  const [v, setV] = useState(() => Object.fromEntries(LIMITS.map(([k]) => [k, current[k] ?? ""])));
  const save = async () => {
    const reason = await askReason(`Change the limits for ${label.toLowerCase()}?`);
    if (!reason) return;
    const limits = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x !== null).map(([k, x]) => [k, Number(x)]));
    try { await api("/api/admin/budgets", { json: { ...target, limits, reason } }); toast("Budget saved"); onSaved(); } catch (e) { fail(e); }
  };
  return <>
    <b style={{ marginTop: 6 }}>{label}</b>
    <div className="row-3">{LIMITS.map(([k, l]) => <Field key={k} label={l}>
      <input type="number" min="0" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></Field>)}</div>
    <div className="row-xs" style={{ justifyContent: "flex-end" }}><Button onClick={save}>Save {label.toLowerCase()}</Button></div>
  </>;
}
