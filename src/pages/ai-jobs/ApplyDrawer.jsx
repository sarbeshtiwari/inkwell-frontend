import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Button, Check, Drawer, DrawerHead, Field, fail, toast } from "../../ui/kit";

export function ApplyDrawer({ open, onClose, d, me, onSaved }) {
  const [v, setV] = useState({});
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setV(d?.details || {}); setOk(!!d?.consent); setErr({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async consent => {
    setBusy(true);
    try { const r = await api("/api/ai-jobs/details", { method: "PUT", json: { ...v, consent } }); onSaved(r); toast(consent ? "Auto-apply is on. Pick jobs and press Auto-apply." : "Saved"); onClose(); }
    catch (e) { e.field ? setErr({ [e.field]: e.message }) : fail(e); }
    setBusy(false);
  };
  const F = [["linkedin", "LinkedIn", "https://linkedin.com/in/…"], ["github", "GitHub", "https://github.com/…"], ["portfolio", "Portfolio", "https://…"],
    ["current_company", "Current company", ""], ["location", "Current city", "Bengaluru"], ["notice", "Notice period", "30 days"]];
  return (
    <Drawer open={open} onClose={onClose} label="Auto-apply">
      <DrawerHead title="Auto-apply" sub="Inkwell AI fills job applications with these details." onClose={onClose} />
      <div className="dr-pad ai-drawer">
        <p className="help">From your profile: <b>{me?.name || "add your name"}</b> · {me?.email || "your email"} · {me?.phone || <a className="link" href="/app/profile">add your phone</a>}</p>
        <div className="grid-2">
          {F.map(([k, label, ph]) => (
            <Field key={k} label={label} opt="(optional)" error={err[k]}>
              <input className="input" value={v[k] || ""} placeholder={ph} maxLength={200} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))} />
            </Field>
          ))}
        </div>
        <Field label="Cover letter" hint="Attached when a form has a cover letter field, or pasted where it asks for the letter as text. Forms without one never get it.">
          <select className="select" value={v.cover_letter || "auto"} onChange={e => setV(x => ({ ...x, cover_letter: e.target.value }))}>
            <option value="auto">{d?.cover_letter ? `Automatic: ${d.cover_letter}` : "Automatic (a file with “cover” in its name)"}</option>
            {(d?.documents || []).map(n => <option key={n} value={n}>{n}</option>)}
            <option value="none">Don't send a cover letter</option>
          </select>
        </Field>
        <Alert tone="warn" icon="shield">
          <b>How it works.</b> Only jobs you tick are applied to, at most {d?.apply_per_day || 20} a day, and only on public application forms
          (Greenhouse, Lever, Ashby). It never logs in to any site, never makes up answers, and stops at CAPTCHAs. Anything it can't
          finish is marked “Needs you” with a link. Each submitted application is added to your Applications page.
        </Alert>
        <Check checked={ok} onChange={setOk}>I allow Inkwell AI to submit applications on my behalf for the jobs I select.</Check>
        <div className="form-actions">
          {d?.consent && <Button variant="ghost" onClick={() => save(false)}>Turn off auto-apply</Button>}
          <span className="grow" />
          <Button variant="primary" icon="check" busy={busy} disabled={!ok} onClick={() => save(true)}>Save and turn on</Button>
        </div>
      </div>
    </Drawer>
  );
}
