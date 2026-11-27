import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { emit, on } from "../lib/bus";
import { ago, fmtDT, safeHref } from "../lib/format";
import { Alert, Badge, Button, Chips, Empty, Field, Icon, Sk, fail, toast } from "../ui/kit";

// What an agent wants to do outside Inkwell waits here: nothing is sent or submitted until you approve it.
const FILTERS = [["pending", "Waiting for you"], ["", "All"], ["executed", "Done"], ["rejected", "Declined"], ["expired", "Expired"]];
const STATUS = {
  pending: ["Waiting for you", "warn"], approved: ["Approved, running", "brand"], executing: ["Running", "brand"],
  executed: ["Done", "ok"], failed: ["Failed", "bad"], rejected: ["Declined", "muted"], withdrawn: ["Withdrawn", "muted"],
  expired: ["Expired", "muted"],
};
const TOOL = {
  "applications.submit": ["Submit a job application", "briefcase"],
};
const LABEL = { title: "Role", company: "Company", location: "Location", url: "Job page", apply_url: "Application form",
  to: "To", body: "Message", subject: "Subject" };
const READONLY = new Set(["id", "ats", "board"]);

const toolName = id => (TOOL[id] || [id.replace(/[._]/g, " ")])[0];
const toolIcon = id => (TOOL[id] || [null, "shield"])[1];

export default function Approvals() {
  const [f, setF] = useState("pending");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api(`/api/agents/approvals${f ? `?status=${f}` : ""}`)
    .then(r => { setRows(r.approvals); setErr(""); }).catch(e => setErr(e.message)), [f]);
  useEffect(() => { load(); return on("approvals-changed", load); }, [load]);
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);  // agents add new ones

  if (err) return <div className="card"><Empty icon="alert" title="Couldn't load approvals">{err}</Empty></div>;
  return (
    <div>
      <Alert tone="info" icon="shield" style={{ marginBottom: 14 }}>
        Agents never send a message or submit an application on their own. Each one waits here for your yes, and runs
        exactly once with the details you approve. Requests you don't answer within 2 days expire, and the agent carries
        on without them.
      </Alert>
      <div className="toolbar"><Chips value={f} onChange={setF} options={FILTERS.map(([k, l]) => [k, l])} /></div>
      <div className="stack">
        {!rows && [0, 1].map(i => <div key={i} className="card card-pad"><Sk w="40%" h={18} /><Sk w="80%" style={{ marginTop: 14 }} /></div>)}
        <AnimatePresence initial={false}>
          {(rows || []).map(a => <ApprovalCard key={a.id} a={a} onDone={() => { load(); emit("approvals-changed"); }} />)}
        </AnimatePresence>
        {rows && !rows.length && <div className="card"><Empty icon="check" title={f === "pending" ? "Nothing waiting for you" : "Nothing here"}>
          When an agent you started wants to do something outside Inkwell, like submitting an application, it asks here first.
        </Empty></div>}
      </div>
    </div>
  );
}

// The editable leaves of the proposed details: strings only (ids and board names stay as they are).
function leaves(obj, path = []) {
  return Object.entries(obj || {}).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? leaves(v, [...path, k]) : typeof v === "string" ? [[[...path, k], v]] : []);
}
const setAt = (obj, path, v) => path.length === 1 ? { ...obj, [path[0]]: v } : { ...obj, [path[0]]: setAt(obj[path[0]], path.slice(1), v) };

function ApprovalCard({ a, onDone }) {
  const [edit, setEdit] = useState(false);
  const [args, setArgs] = useState(a.proposed);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [label, tone] = STATUS[a.status] || [a.status, ""];
  const pending = a.status === "pending";
  const changed = JSON.stringify(args) !== JSON.stringify(a.proposed);

  const decide = async decision => {
    setBusy(decision); setError("");
    try {
      await api(`/api/agents/approvals/${a.id}`, { json: { decision, ...(decision === "approve" && changed ? { args } : {}) } });
      toast(decision === "approve" ? "Approved. It runs once, in a moment." : "Declined. It won't be done.");
      onDone();
    } catch (e) {
      if (e.field === "args") setError(e.message); else fail(e);
      if (e.status === 409) onDone();  // already decided or expired: show the current state
    } finally { setBusy(""); }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="card card-pad">
      <div className="row-xs" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="row-xs"><Icon name={toolIcon(a.tool_id)} /><b>{toolName(a.tool_id)}</b>
          {a.agent_id && <span className="small-label">· asked by {a.agent_id.replace(/_/g, " ")}</span>}</div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="small-label" style={{ marginTop: 6 }}>
        Asked {ago(a.created_at)}{pending && a.expires_at ? ` · expires ${fmtDT(a.expires_at)}` : ""}
        {a.decided_at && !pending ? ` · ${label.toLowerCase()} ${ago(a.decided_at)}` : ""}{a.edited ? " · you edited it" : ""}
      </div>
      <div className="stack-sm">
        {leaves(edit ? args : (a.approved_args || a.proposed)).map(([path, v]) => {
          const key = path.join("."), name = path[path.length - 1], lab = LABEL[name] || name.replace(/_/g, " ");
          if (!edit || READONLY.has(name)) {
            return <div key={key} className="row-xs" style={{ alignItems: "baseline" }}><span className="small-label" style={{ minWidth: 120 }}>{lab}</span>
              {/^https?:\/\//.test(v) ? <a href={safeHref(v)} target="_blank" rel="noreferrer noopener">{v}</a> : <span style={{ whiteSpace: "pre-wrap" }}>{v}</span>}</div>;
          }
          const long = v.length > 80 || name === "body";
          return <Field key={key} label={lab}>
            {long ? <textarea rows={5} value={v} onChange={e => setArgs(x => setAt(x, path, e.target.value))} />
              : <input value={v} onChange={e => setArgs(x => setAt(x, path, e.target.value))} />}
          </Field>;
        })}
      </div>
      {a.result && <Alert tone={a.result.state === "applied" ? "ok" : "info"} style={{ marginTop: 12 }}>{a.result.detail || a.result.state}</Alert>}
      {a.error && <Alert tone="bad" style={{ marginTop: 12 }}>{a.error}</Alert>}
      {error && <Alert tone="bad" style={{ marginTop: 12 }}>{error}</Alert>}
      {pending && <div className="row-xs" style={{ marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {edit ? <Button variant="ghost" onClick={() => { setEdit(false); setArgs(a.proposed); setError(""); }}>Cancel edit</Button>
          : <Button variant="ghost" icon="note" onClick={() => setEdit(true)}>Edit details</Button>}
        <Button variant="ghost" busy={busy === "reject"} disabled={!!busy} onClick={() => decide("reject")}>Decline</Button>
        <Button variant="primary" icon="check" busy={busy === "approve"} disabled={!!busy} onClick={() => decide("approve")}>
          {changed ? "Approve with my changes" : "Approve"}</Button>
      </div>}
    </motion.div>
  );
}
