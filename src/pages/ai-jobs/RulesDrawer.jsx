import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Button, Check, Drawer, DrawerHead, Field, fail, toast } from "../../ui/kit";

const list = v => (Array.isArray(v) ? v.join(", ") : v || "");

export function RulesDrawer({ open, onClose, rules, onSaved }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && rules) setF({ ...rules, blacklist: list(rules.blacklist), targets: list(rules.targets), avoid_words: list(rules.avoid_words) }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = k => e => setF(x => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const save = async () => {
    setBusy(true);
    try { const r = await api("/api/ai-jobs/rules", { method: "PUT", json: f }); onSaved(r.rules); toast("Rules saved. They apply to new searches and evaluations."); onClose(); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <Drawer open={open} onClose={onClose} label="My rules">
      <DrawerHead title="My rules" sub="Your own hard limits. A job that breaks one is marked Skip and never auto-applied to, unless you say so." onClose={onClose} />
      {f && <div className="dr-pad ai-drawer">
        <Field label="Roles I target" hint="Comma separated, e.g. Full stack, AI engineer. Fit is scored against these.">
          <input className="input" value={f.targets} onChange={set("targets")} maxLength={600} placeholder="Full stack, Backend, AI engineer" />
        </Field>
        <Field label="Never apply to" hint="Companies or website domains (example.com also blocks jobs.example.com).">
          <textarea className="textarea" rows={3} value={f.blacklist} onChange={set("blacklist")} maxLength={4000} placeholder="Acme, badcorp.com" />
        </Field>
        <div className="ai-rule-pay">
          <Field label="Lowest pay I'll take" opt="(optional)" hint="Only checked when the posting states pay in the same currency.">
            <input className="input" type="number" min="0" value={f.min_salary || ""} onChange={set("min_salary")} placeholder="1200000" />
          </Field>
          <Field label="Currency">
            <select className="select" value={f.currency} onChange={set("currency")}>
              {["", "INR", "USD", "EUR", "GBP", "CAD", "AUD"].map(c => <option key={c} value={c}>{c || "Any"}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Most years of experience a job may ask" opt="(0 = no limit)">
          <input className="input" type="number" min="0" max="40" value={f.max_years || ""} onChange={set("max_years")} placeholder="0" />
        </Field>
        <Field label="Skip jobs mentioning" hint="Words in the title or description, comma separated." opt="(optional)">
          <input className="input" value={f.avoid_words} onChange={set("avoid_words")} maxLength={600} placeholder="unpaid, commission only" />
        </Field>
        <div className="ai-rule-checks">
          <Check checked={f.remote_only} onChange={set("remote_only")}>Remote jobs only</Check>
          <Check checked={f.no_contract} onChange={set("no_contract")}>No contract or freelance roles</Check>
          <Check checked={f.need_sponsorship} onChange={set("need_sponsorship")}>I need visa sponsorship (skip “no sponsorship” jobs)</Check>
        </div>
        <Field label="Only auto-apply to jobs scoring at least" hint="career-ops' advice: below 4.0 out of 5, apply only with a specific reason.">
          <select className="select" value={f.min_score_to_apply} onChange={e => setF(x => ({ ...x, min_score_to_apply: +e.target.value }))}>
            {[[0, "No minimum"], [3.5, "3.5 / 5"], [4, "4.0 / 5 (recommended)"], [4.5, "4.5 / 5"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <div className="ai-rule-checks">
          <Check checked={f.followups} onChange={set("followups")}>Remind me to follow up on applications</Check>
          {f.followups && <Field label="First follow-up after (days)"><input className="input" type="number" min="3" max="30" value={f.followup_days} onChange={set("followup_days")} /></Field>}
        </div>
        <Alert tone="info">A missing fact never breaks a rule: a job with no pay shown isn't skipped for pay, and one with no years stated isn't skipped for experience.</Alert>
        <div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={save}>Save rules</Button></div>
      </div>}
    </Drawer>
  );
}
