import { motion } from "framer-motion";
import { useState } from "react";
import { api } from "../../lib/api";
import { emit } from "../../lib/bus";
import { fmtDate } from "../../lib/format";
import { useApp } from "../../lib/store";
import { Badge, Button, Check, Empty, FormError, Switch, toast } from "../../ui/kit";

export function SentPanel({ onClose }) {
  const app = useApp();
  const [days, setDays] = useState("0");
  const [items, setItems] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [filter, setFilter] = useState("");
  const [mark, setMark] = useState(false);
  const [err, setErr] = useState(app.data.profile.has_password ? "" : "Set up email on the Profile page first. Reachout uses the same app password to read your Sent folder.");
  const [busy, setBusy] = useState("");
  const vis = (items || []).filter(x => !filter || [x.email, x.name, x.company, x.last_subject].some(v => (v || "").toLowerCase().includes(filter.toLowerCase())));
  const pickable = vis.filter(x => !x.imported);
  const scan = async () => {
    setBusy("scan"); setErr("");
    try { const d = await api("/api/sentmail/scan", { json: { days: +days } }); setItems(d.items); setPicked(new Set(d.items.filter(x => !x.imported).map(x => x.email))); if (!d.items.length) toast("No sent emails found in that period."); }
    catch (e) { setErr(e.message); }
    setBusy("");
  };
  const doImport = async () => {
    setBusy("import");
    try {
      const sel = items.filter(x => picked.has(x.email)).map(({ email, name, company, sends }) => ({ email, name, company, sends }));
      const d = await api("/api/sentmail/import", { json: { items: sel, mark_contacted: mark } });
      toast(mark ? `Imported ${d.added} new, updated ${d.updated}, added ${d.history} past emails to Activity` : `Imported ${d.added} new contact${d.added === 1 ? "" : "s"} (${d.updated} already existed).`);
      setItems(list => list.map(x => picked.has(x.email) ? { ...x, imported: true, contact: true } : x)); setPicked(new Set());
      await app.reload(); emit("history-changed");
    } catch (e) { setErr(e.message); }
    setBusy("");
  };
  return (
    <div className="card card-pad panel">
      <h3 className="sec-h" style={{ marginBottom: 4 }}>Import people you've already emailed</h3>
      <p className="help">Reachout looks at your mailbox's <b>Sent</b> folder and reads only who you wrote to, when, and the subject line. Personal addresses (gmail.com, yahoo.com…) are skipped.</p>
      <div className="form-actions" style={{ marginTop: 12 }}>
        <select className="select auto" value={days} onChange={e => setDays(e.target.value)} aria-label="Look back"><option value="0">All time</option><option value="30">Last 30 days</option><option value="90">Last 3 months</option><option value="180">Last 6 months</option><option value="365">Last 12 months</option></select>
        <Button variant="primary" icon="search" busy={busy === "scan"} busyLabel="Scanning…" onClick={scan} disabled={!app.data.profile.has_password}>Scan Sent folder</Button>
        <span className="grow" /><Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <FormError>{err}</FormError>
      {items && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="sent-bar">
          <Check checked={pickable.length > 0 && pickable.every(x => picked.has(x.email))} onChange={on => setPicked(s => { const n = new Set(s); pickable.forEach(x => on ? n.add(x.email) : n.delete(x.email)); return n; })}>{picked.size} selected of {items.filter(x => !x.imported).length}</Check>
          <span className="grow" /><input className="input" type="search" placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 220 }} />
        </div>
        <div className="table-wrap sent-wrap"><table className="table">
          <thead><tr><th className="cb" /><th>Person</th><th>Company</th><th>Emails</th><th>Last sent</th><th>Last subject</th><th /></tr></thead>
          <tbody>{vis.map(x => (
            <tr key={x.email} className={picked.has(x.email) ? "sel" : ""}>
              <td className="cb"><input type="checkbox" checked={picked.has(x.email)} disabled={x.imported} onChange={e => setPicked(s => { const n = new Set(s); e.target.checked ? n.add(x.email) : n.delete(x.email); return n; })} /></td>
              <td><b>{x.name || x.email.split("@")[0]}</b><div className="help">{x.email}</div></td>
              <td className="tight"><input className="cell" defaultValue={x.company} placeholder="Add company" onChange={e => { x.company = e.target.value.trim(); }} /></td>
              <td className="num">{x.count}</td><td className="nowrap">{fmtDate(x.last)}</td>
              <td><div className="clip help" title={x.last_subject}>{x.last_subject || "(no subject)"}</div></td>
              <td>{x.imported ? <Badge tone="ok">Imported</Badge> : x.contact ? <Badge tone="brand">In contacts</Badge> : null}</td>
            </tr>))}
            {!vis.length && <tr><td colSpan={7}><Empty icon="mail" title="Nobody to show">{items.length ? "Nobody matches your filter." : "No new work addresses in your Sent folder for this period."}</Empty></td></tr>}
          </tbody></table></div>
        <div className="form-actions"><Switch checked={mark} onChange={setMark}>Mark as already contacted <span className="help">(campaigns will skip them)</span></Switch><span className="grow" />
          <Button variant="primary" icon="download" disabled={!picked.size} busy={busy === "import"} busyLabel="Importing…" onClick={doImport}>Import selected</Button></div>
      </motion.div>}
    </div>
  );
}
