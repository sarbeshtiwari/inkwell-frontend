import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Button, Drawer, DrawerHead, Spinner, fail, modal } from "../../ui/kit";

export function UpdateDrawer({ open, onClose }) {
  const [d, setD] = useState(null);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const check = async () => {
    setBusy(true); setD(null);
    try { const r = await api("/api/update"); setD(r); setJob(r.job); } catch (e) { fail(e); onClose(); }
    setBusy(false);
  };
  const poll = async () => {
    try {
      const r = await api("/api/update/progress");
      setJob(r.job);
      if (r.job.state === "running" || r.job.state === "restarting") timer.current = setTimeout(poll, 1500);
      if (r.job.state === "restarting") setTimeout(() => location.reload(), 6000);
    } catch { timer.current = setTimeout(poll, 2000); }  // the server is restarting
  };
  useEffect(() => { if (open) check(); return () => clearTimeout(timer.current); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async undo => {
    if (!await modal({ title: undo ? "Go back to the previous version?" : "Update Inkwell?", confirm: undo ? "Go back" : "Update",
      text: "Inkwell restarts when it's done; your contacts, applications and settings aren't touched." })) return;
    try { await api(undo ? "/api/update/undo" : "/api/update", { json: {} }); poll(); } catch (e) { fail(e); }
  };
  const running = job && ["running", "restarting"].includes(job.state);
  return (
    <Drawer open={open} onClose={onClose} label="Updates">
      <DrawerHead title="Updates" sub="Get the newest Inkwell from GitHub. Your data stays as it is." onClose={onClose} />
      <div className="dr-pad ai-drawer">
        {!d ? <div className="ai-eval-wait"><Spinner /><span>Checking GitHub…</span></div> : <>
          {d.repos.map(r => (
            <div key={r.name} className="ai-answer">
              <div className="ai-answer-head"><b>{r.name}</b><span className="help">version {r.version || "?"}{r.ok ? (r.behind ? ` · ${r.behind} update${r.behind === 1 ? "" : "s"} available` : " · up to date") : ""}</span></div>
              {!r.ok && <p className="help">{r.error}</p>}
              {r.new?.length > 0 && <ul className="ai-list">{r.new.map(c => <li key={c.sha}>{c.subject}</li>)}</ul>}
            </div>
          ))}
          {d.blockers.map(b => <Alert key={b} tone="warn">{b}</Alert>)}
          {job?.log?.length > 0 && <pre className="ai-kit-answer">{job.log.join("\n")}</pre>}
          {job?.error && <Alert tone="bad">{job.error}</Alert>}
          {job?.message && <Alert tone="ok">{job.message}</Alert>}
          <div className="form-actions">
            {d.can_undo && <Button variant="ghost" disabled={running} onClick={() => go(true)}>Undo last update</Button>}
            <Button variant="ghost" busy={busy} onClick={check}>Check again</Button>
            <Button variant="primary" busy={running} busyLabel="Updating…" disabled={!d.behind || d.blockers.length > 0} onClick={() => go(false)}>
              {d.behind ? "Update now" : "Up to date"}</Button>
          </div>
        </>}
      </div>
    </Drawer>
  );
}
