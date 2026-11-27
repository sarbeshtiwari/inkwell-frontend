import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { emailOk, fmtDate } from "../../lib/format";
import { useApp } from "../../lib/store";
import { Badge, Button, Drawer, DrawerHead, Field, Icon, Spinner, applyError, fail, modal, toast } from "../../ui/kit";

// Sharing contacts with a friend who already has a Reachout account. They get a copy only if they accept;
// your stage, notes and send history with those contacts stay yours.

const when = s => fmtDate(new Date(s * 1000).toISOString().slice(0, 10));
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function ShareDialog({ open, ids, onClose, onShared }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErrors({});
    const to = email.trim();
    if (!emailOk(to) || !to) return setErrors({ email: "Enter your friend's email, the one they use for Reachout." });
    setBusy(true);
    try {
      const r = await api("/api/shares", { json: { email: to, ids, note: note.trim() } });
      toast(`Shared ${plural(r.count, "contact")} with ${r.to}. They'll get them once they accept.`);
      setEmail(""); setNote(""); onClose(); onShared?.();
    } catch (err) { applyError(err, setErrors, m => setErrors({ email: m })); }
    setBusy(false);
  };
  return (
    <Drawer open={open} onClose={onClose} label="Share contacts">
      <DrawerHead title="Share with a friend" sub={`${plural(ids.length, "selected contact")}`} onClose={onClose} />
      <form className="dr-pad share-form" onSubmit={submit} noValidate>
        <Field label="Friend's email" hint="They need a Reachout account with this email." error={errors.email}>
          <input className="input" type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors({}); }} placeholder="friend@example.com" autoFocus />
        </Field>
        <Field label="Message" opt hint="Shown to them with the share.">
          <textarea className="input" rows={3} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Here are the HR contacts I found for backend roles." />
        </Field>
        <div className="share-what">
          <b>What they get</b>
          <span><Icon name="check" />Name, company, email, phone and your extra columns (location, skills…)</span>
          <span><Icon name="x" />Not your stage, notes, or who you've messaged and their replies</span>
          <span className="help">Nothing is shared until they accept. You can cancel it before then.</span>
        </div>
        <div className="form-actions"><span className="grow" /><Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon="send" busy={busy} busyLabel="Sharing…">Share {plural(ids.length, "contact")}</Button></div>
      </form>
    </Drawer>
  );
}

// Offers from friends, shown above your contacts until you answer them.
export function IncomingShares() {
  const app = useApp();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api("/api/shares").then(r => setItems(r.incoming)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const answer = async (s, yes) => {
    if (!yes && !await modal({ title: `Decline ${s.from}'s contacts?`, text: "They won't be added to your list.", confirm: "Decline" })) return;
    setBusy(s.id);
    try {
      const r = await api(`/api/shares/${s.id}/${yes ? "accept" : "decline"}`, { method: "POST" });
      if (yes) {
        await app.reload();
        toast(`Added ${plural(r.added, "contact")} to “${r.list}”` + (r.duplicates ? ` · ${r.duplicates} you already had` : ""));
      } else toast("Declined");
      setItems(x => x.filter(i => i.id !== s.id));
    } catch (err) { fail(err); load(); }
    setBusy("");
  };
  return (
    <AnimatePresence initial={false}>
      {items.map(s => (
        <motion.div key={s.id} className="card share-offer" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <span className="share-ic"><Icon name="users" /></span>
          <div className="grow">
            <b>{s.from} wants to share {plural(s.count, "contact")} with you</b>
            <div className="help">{s.from_email} · {when(s.created)}{s.preview?.length ? ` · ${s.preview.filter(Boolean).join(", ")}${s.count > s.preview.length ? "…" : ""}` : ""}</div>
            {s.note && <p className="share-note">“{s.note}”</p>}
          </div>
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => answer(s, false)}>Decline</Button>
          <Button size="sm" variant="primary" icon="check" busy={busy === s.id} busyLabel="Adding…" disabled={!!busy} onClick={() => answer(s, true)}>Accept</Button>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

const TONE = { pending: ["warn", "Waiting"], accepted: ["ok", "Accepted"], declined: ["bad", "Declined"] };

// What you've shared and whether your friends took it.
export function SharedPanel({ onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => { api("/api/shares").then(r => setItems(r.outgoing)).catch(err => { fail(err); setItems([]); }); }, []);
  const remove = async s => {
    if (s.status === "pending" && !await modal({ title: "Cancel this share?", text: `${s.to} won't be able to accept it any more.`, confirm: "Cancel share", danger: true })) return;
    try { await api(`/api/shares/${s.id}`, { method: "DELETE" }); setItems(x => x.filter(i => i.id !== s.id)); }
    catch (err) { fail(err); }
  };
  return (
    <div className="card card-pad panel">
      <div className="fb-head"><h3 className="sec-h">Contacts you've shared</h3><span className="grow" /><Button size="sm" variant="ghost" icon="x" onClick={onClose} aria-label="Close" /></div>
      {items === null ? <Spinner /> : !items.length
        ? <p className="help">Nothing shared yet. Tick contacts in the table, then choose <b>Share with a friend</b>.</p>
        : <div className="share-list">{items.map(s => (
          <div key={s.id} className="share-row">
            <div className="grow"><b>{s.to}</b> <span className="help">{s.to_email}</span>
              <div className="help">{plural(s.count, "contact")} · {when(s.created)}{s.note ? ` · “${s.note}”` : ""}</div></div>
            <Badge tone={TONE[s.status]?.[0]}>{TONE[s.status]?.[1] || s.status}</Badge>
            <Button size="sm" variant="ghost" onClick={() => remove(s)}>{s.status === "pending" ? "Cancel" : "Remove"}</Button>
          </div>))}</div>}
    </div>
  );
}
