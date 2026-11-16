import { useState } from "react";
import { api } from "../../lib/api";
import { emailOk, phoneOk } from "../../lib/format";
import { useApp } from "../../lib/store";
import { Button, Field, applyError, toast } from "../../ui/kit";

export function AddPanel({ onClose }) {
  const app = useApp();
  const empty = { name: "", company: "", phone: "", email: "" };
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErrors({});
    const d = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]));
    if (!d.phone && !d.email) return setErrors({ phone: "Add a phone number or an email address." });
    if (!phoneOk(d.phone)) return setErrors({ phone: "Enter a valid phone number: 8–15 digits, optionally starting with +." });
    if (!emailOk(d.email)) return setErrors({ email: "Enter a valid email address, like name@example.com." });
    setBusy(true);
    try { const row = await api("/api/recipients", { json: d }); app.setData(x => ({ ...x, recipients: [...x.recipients, row] })); setV(empty); toast(`${row.name || row.phone || row.email} added`); }
    catch (err) { applyError(err, setErrors); }
    setBusy(false);
  };
  const set = k => e => { setV(x => ({ ...x, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: "" })); };
  return (
    <form className="card card-pad panel" onSubmit={submit} noValidate>
      <h3 className="sec-h">New contact</h3>
      <div className="row-4">
        <Field label="Name" error={errors.name}><input className="input" value={v.name} onChange={set("name")} maxLength={120} autoFocus /></Field>
        <Field label="Company" error={errors.company}><input className="input" value={v.company} onChange={set("company")} maxLength={120} /></Field>
        <Field label="Phone" error={errors.phone}><input className="input" value={v.phone} onChange={set("phone")} inputMode="tel" placeholder="+91 98765 43210" /></Field>
        <Field label="Email" error={errors.email}><input className="input" type="email" value={v.email} onChange={set("email")} placeholder="name@company.com" /></Field>
      </div>
      <div className="form-actions"><span className="help">Add a phone number, an email address, or both.</span><span className="grow" /><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" busy={busy} busyLabel="Saving…">Save contact</Button></div>
    </form>
  );
}
