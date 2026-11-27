import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { emailOk, fmtDate, phoneOk, today } from "../lib/format";
import { go } from "../lib/router";
import { useApp } from "../lib/store";
import { Badge, Button, Chips, Empty, Field, Icon, Spinner, fail, modal, toast, useDebounced, Pager, usePager } from "../ui/kit";
import { EmailBadge, SendBadge } from "../ui/shared";
import { extraCols } from "./Campaign";
import { AddPanel } from "./contacts/AddPanel";
import { ImportPanel } from "./contacts/ImportPanel";
import { SentPanel } from "./contacts/SentPanel";

const CORE = ["name", "company", "phone", "email"];

const STATUS = ["wa_status", "wa_last", "email_status", "email_last", "email_opened", "replied_at", "reply_intent", "reply_count", "added_at"];

const PH = { name: "Add name", company: "Add company", phone: "Add phone", email: "Add email" };

// Whole days since the contact was added (0 = today), or null for contacts saved before dates were recorded.
// What kind of inbox an address reaches: hiring (careers@, jobs@, hr@…) or a general one (info@, contact@…).
const HIRING = /^(careers?|jobs?|hiring|recruit\w*|talent\w*|hr|people|join\w*|apply|applications?|resumes?|cv)([._-]|$)/i;

const GENERAL = /^(hello|hi|info|contact|team|office|mail|enquir\w*|inquir\w*|general|support|sales|admin)([._-]|$)/i;

function addressKind(r) {
  if (!r.email) return "none";
  if (r.email_type === "careers") return "hiring";
  if (r.email_type === "general") return "general";
  if (r.email_type === "referral") return "person";
  const local = r.email.split("@")[0];
  return HIRING.test(local) ? "hiring" : GENERAL.test(local) ? "general" : "person";
}

const STATUS_TESTS = {
  pending: r => !r.wa_status && !r.email_status,
  sent: r => r.wa_status === "sent" || r.email_status === "sent",
  opened: r => !!r.email_opened,
  unopened: r => r.email_status === "sent" && !r.email_opened,
  replied: r => !!r.replied_at,
  failed: r => ["failed", "not_on_whatsapp"].includes(r.wa_status) || ["failed", "bounced", "invalid"].includes(r.email_status),
};

const STATUS_CHIPS = [["", "All"], ["pending", "Not contacted yet"], ["sent", "Messaged"], ["unopened", "Emailed, not opened"],
  ["opened", "Opened email"], ["replied", "Replied"], ["failed", "Failed / bounced"]];

const ADDED = { today: "Today", yesterday: "Yesterday", "7": "Last 7 days", "30": "Last 30 days", older: "Earlier" };

const KINDS = { hiring: "Careers / HR inbox (careers@, hr@…)", general: "General inbox (info@, contact@…)", person: "A person's own email", none: "No email" };

const REACH = { email: "Has email", phone: "Has phone", both: "Has email and phone", email_only: "Email only (no phone)", phone_only: "Phone only (no email)" };

const reachOk = (r, v) => ({ email: !!r.email, phone: !!r.phone, both: !!(r.email && r.phone),
  email_only: !!r.email && !r.phone, phone_only: !!r.phone && !r.email })[v];

function addedAge(r) {
  if (!r.added_at) return null;
  const d = new Date(r.added_at); if (isNaN(d)) return null;
  const start = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((start(new Date()) - start(d)) / 86400000);
}

export default function Contacts() {
  const app = useApp();
  const { data, me, selected, setSelected } = app;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [added, setAdded] = useState("");
  const [list, setList] = useState("");
  const [kind, setKind] = useState("");
  const [reach, setReach] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const lists = useMemo(() => [...new Set(data.recipients.map(r => r.list).filter(Boolean))].sort(), [data.recipients]);
  const addedCounts = useMemo(() => {
    const c = { today: 0, yesterday: 0, "7": 0, "30": 0, older: 0 };
    data.recipients.forEach(r => { const a = addedAge(r); if (a === null) c.older++; else { if (a === 0) c.today++; if (a === 1) c.yesterday++; if (a < 7) c["7"]++; if (a < 30) c["30"]++; } });
    return c;
  }, [data.recipients]);
  const [panel, setPanel] = useState(null);
  const [save, setSave] = useState({ text: "", tone: "" });
  const dq = useDebounced(q, 120);
  const cols = [...CORE, ...extraCols(data.recipients)];

  // Every filter except status, so the status chips can show how many each would give.
  const base = useMemo(() => data.recipients.filter(r => {
    const s = dq.trim().toLowerCase();
    if (s && !Object.entries(r).some(([k, v]) => k !== "id" && String(v).toLowerCase().includes(s))) return false;
    if (stage && (r.stage || "new") !== stage) return false;
    if (list && (r.list || "") !== (list === "(none)" ? "" : list)) return false;
    if (kind && addressKind(r) !== kind) return false;
    if (reach && !reachOk(r, reach)) return false;
    if (added) {
      const a = addedAge(r);
      if (added === "today" && a !== 0) return false;
      if (added === "yesterday" && a !== 1) return false;
      if ((added === "7" || added === "30") && (a === null || a >= +added)) return false;
      if (added === "older" && a !== null) return false;
    }
    return true;
  }), [data.recipients, dq, stage, added, list, kind, reach]);
  const rows = useMemo(() => status ? base.filter(STATUS_TESTS[status]) : base, [base, status]);
  const statusCounts = useMemo(() => Object.fromEntries(STATUS_CHIPS.map(([v]) => [v, v ? base.filter(STATUS_TESTS[v]).length : base.length])), [base]);
  const pg = usePager(rows, [dq, status, stage, added, list, kind, reach].join("|"), 50);
  // Filters other than search and status, shown as removable pills.
  const active = [
    stage && ["Stage", me.stages[stage] || stage, () => setStage("")],
    added && ["Added", ADDED[added], () => setAdded("")],
    list && ["List", list === "(none)" ? "No list" : list, () => setList("")],
    kind && ["Email type", KINDS[kind], () => setKind("")],
    reach && ["Contact info", REACH[reach], () => setReach("")],
  ].filter(Boolean);
  const filtered = !!(dq || status || active.length);
  const clearAll = () => { setQ(""); setStatus(""); setStage(""); setAdded(""); setList(""); setKind(""); setReach(""); };
  const exportRows = async () => {
    const pick = selected.size ? rows.filter(r => selected.has(r.id)) : rows;
    if (!pick.length) return toast("No contacts to export", true);
    setExporting(true);
    try {
      const r = await fetch("/api/recipients/export", { method: "POST", headers: { "X-Requested-With": "fetch", "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pick.map(x => x.id) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't export. Please try again.");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await r.blob()), download: `contacts-${today()}.xlsx` });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(`Exported ${pick.length} contact${pick.length === 1 ? "" : "s"}`);
    } catch (err) { fail(err); }
    setExporting(false);
  };
  const allOn = rows.length > 0 && rows.every(r => selected.has(r.id));
  const toggleSel = (id, on) => setSelected(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });

  const saveCell = async (r, k, el) => {
    const value = el.value.trim();
    if (value === (r[k] || (k === "stage" ? "new" : ""))) return;
    const bad = msg => { el.setAttribute("aria-invalid", "true"); el.title = msg; setSave({ text: msg, tone: "err" }); };
    if (k === "phone" && !phoneOk(value)) return bad("Enter a valid phone number: 8–15 digits.");
    if (k === "email" && !emailOk(value)) return bad("Enter a valid email address.");
    if ((k === "phone" || k === "email") && !value && !(k === "phone" ? r.email : r.phone)) return bad("A contact needs a phone number or an email.");
    el.removeAttribute("aria-invalid"); el.title = "";
    el.classList.add("saving"); setSave({ text: "Saving…", tone: "busy" });
    try {
      const row = await api("/api/recipients/" + r.id, { method: "PUT", json: { [k]: value } });
      app.patchRecipient(r.id, row);
      setSave({ text: "Saved", tone: "ok" }); setTimeout(() => setSave(s => s.tone === "ok" ? { text: "", tone: "" } : s), 2000);
    } catch (err) { el.value = r[k] || ""; bad(err.message); }
    el.classList.remove("saving");
  };

  const bulkDelete = async () => {
    const n = selected.size;
    if (!await modal({ title: `Delete ${n} contact${n === 1 ? "" : "s"}?`, text: "They'll be removed from your list. Activity history is kept.", confirm: "Delete", danger: true })) return;
    try { await api("/api/recipients/delete", { json: { ids: [...selected] } }); app.setData(d => ({ ...d, recipients: d.recipients.filter(r => !selected.has(r.id)) })); setSelected(new Set()); toast(`Deleted ${n} contact${n === 1 ? "" : "s"}`); }
    catch (err) { fail(err); }
  };
  const bulkReset = async () => {
    try {
      await api("/api/recipients/reset", { json: { ids: [...selected] } });
      app.setData(d => ({ ...d, recipients: d.recipients.map(r => selected.has(r.id) ? { ...r, ...Object.fromEntries(STATUS.map(k => [k, ""])) } : r) }));
      toast("Marked as not contacted");
    } catch (err) { fail(err); }
  };
  const addColumn = async () => {
    if (!data.recipients.length) return toast("Add a contact first", true);
    const raw = await modal({ title: "Add a column", text: "For example role or city. You can then use it in messages as {role}.", input: "", confirm: "Add column" });
    if (raw === null) return;
    const name = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(name)) return toast("Column names must start with a letter and be up to 40 characters.", true);
    if ([...cols, ...STATUS, "id"].includes(name)) return toast(`There's already a column called “${name}”.`, true);
    const r = data.recipients[0];
    try { await api("/api/recipients/" + r.id, { method: "PUT", json: { [name]: "" } }); app.patchRecipient(r.id, { [name]: "" }); toast(`Column added. Use {${name}} in messages`); }
    catch (err) { fail(err); }
  };
  const togglePanel = p => setPanel(x => x === p ? null : p);

  return (
    <div>
      <div className="toolbar">
        <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Search contacts…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search contacts" /></div>
        <Button icon="filter" className={showFilters || active.length ? "on" : ""} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>
          Filters{active.length > 0 && <span className="filter-n">{active.length}</span>}</Button>
        <span className="grow" />
        <Button icon="mail" className={panel === "sent" ? "on" : ""} onClick={() => togglePanel("sent")}>Import from Sent mail</Button>
        <Button icon="upload" className={panel === "import" ? "on" : ""} onClick={() => togglePanel("import")}>Import Excel</Button>
        <Button icon="download" busy={exporting} onClick={exportRows} title={selected.size ? "Download the selected contacts as Excel" : "Download the contacts shown below as Excel"}>
          Export {selected.size ? `selected (${selected.size})` : filtered ? `${rows.length} shown` : "all"}</Button>
        <Button variant="primary" icon="plus" onClick={() => togglePanel("add")}>Add contact</Button>
      </div>

      <div className="contact-status">
        <span className="help">Show</span>
        <Chips value={status} onChange={setStatus} options={STATUS_CHIPS.map(([v, l]) => [v, l, statusCounts[v]])} />
      </div>

      <AnimatePresence initial={false}>
        {showFilters && <motion.div className="card contact-filters" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
          <div className="contact-filters-grid">
            <Field label="Stage" hint="Where they are in your pipeline">
              <select className="select" value={stage} onChange={e => setStage(e.target.value)}>
                <option value="">Any stage</option>{Object.entries(me.stages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
            <Field label="Added" hint="When the contact was added">
              <select className="select" value={added} onChange={e => setAdded(e.target.value)}>
                <option value="">Any time</option>{Object.entries(ADDED).map(([k, v]) => <option key={k} value={k}>{v} ({addedCounts[k]})</option>)}</select>
            </Field>
            <Field label="List" hint="The import or group they came from">
              <select className="select" value={list} onChange={e => setList(e.target.value)}>
                <option value="">Any list</option>{lists.map(l => <option key={l} value={l}>{l}</option>)}<option value="(none)">Not in a list</option></select>
            </Field>
            <Field label="Contact info" hint="Which details you have for them">
              <select className="select" value={reach} onChange={e => setReach(e.target.value)}>
                <option value="">Anything</option>{Object.entries(REACH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
            <Field label="Email type" hint="Whose inbox the email reaches">
              <select className="select" value={kind} onChange={e => setKind(e.target.value)}>
                <option value="">Any email</option>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
          </div>
        </motion.div>}
      </AnimatePresence>

      {filtered && <div className="active-filters">
        <span className="help">{rows.length} of {data.recipients.length} contacts</span>
        {active.map(([k, v, clear]) => <button key={k} type="button" className="filter-pill" onClick={clear} title="Remove this filter"><span>{k}:</span> {v}<Icon name="x" /></button>)}
        <button type="button" className="link-btn" onClick={clearAll}>Clear all</button>
      </div>}

      <AnimatePresence mode="wait">
        {panel && <motion.div key={panel} initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
          {panel === "add" && <AddPanel onClose={() => setPanel(null)} />}
          {panel === "import" && <ImportPanel onClose={() => setPanel(null)} />}
          {panel === "sent" && <SentPanel onClose={() => setPanel(null)} />}
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div className="bulkbar" initial={{ opacity: 0, y: -10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
            <b>{selected.size} selected</b><span className="grow" />
            <Button size="sm" icon="send" onClick={() => { app.setCampaignPreset({ who: "selected" }); go("campaign"); }}>Send to selected</Button>
            <Button size="sm" icon="refresh" onClick={bulkReset}>Mark not contacted</Button>
            <Button size="sm" variant="danger" icon="trash" onClick={bulkDelete}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card table-card">
        <div className="table-wrap contacts-wrap">
          <table className="table">
            <thead><tr>
              <th className="cb"><input type="checkbox" checked={allOn} onChange={e => setSelected(s => { const n = new Set(s); rows.forEach(r => e.target.checked ? n.add(r.id) : n.delete(r.id)); return n; })} aria-label="Select all" /></th>
              {cols.map(c => <th key={c}>{c.replace(/_/g, " ")}</th>)}<th>Stage</th><th>Follow-up</th><th>WhatsApp</th><th>Email</th><th />
            </tr></thead>
            <tbody>
              {pg.items.map((r, i) => (
                <motion.tr key={r.id} className={selected.has(r.id) ? "sel" : ""} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * .012 }}>
                  <td className="cb"><input type="checkbox" checked={selected.has(r.id)} onChange={e => toggleSel(r.id, e.target.checked)} aria-label={`Select ${r.name || r.phone || r.email}`} /></td>
                  {cols.map(c => (
                    <td key={c} className="tight"><input className="cell" defaultValue={r[c] || ""} key={r.id + c + (r[c] || "")} placeholder={PH[c] || "Add"} maxLength={CORE.includes(c) ? 254 : 500} aria-label={c}
                      type={c === "email" ? "email" : "text"} inputMode={c === "phone" ? "tel" : undefined}
                      onBlur={e => saveCell(r, c, e.target)} onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.target.value = r[c] || ""; e.target.removeAttribute("aria-invalid"); e.target.blur(); } }} /></td>
                  ))}
                  <td className="tight"><select className={`cell stage-cell st-${r.stage || "new"}`} value={r.stage || "new"} onChange={e => saveCell(r, "stage", e.target)} aria-label="Stage">
                    {Object.entries(me.stages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  <td>{r.follow_up ? <span className={`due ${r.follow_up <= today() && !["won", "not_interested"].includes(r.stage) ? "late" : ""}`}>{fmtDate(r.follow_up)}</span> : <span className="help">—</span>}</td>
                  <td><SendBadge status={r.wa_status} ts={r.wa_last} /></td>
                  <td><div className="badges">{r.replied_at ? <Badge tone="brand"><Icon name="reply" />Replied</Badge> : <EmailBadge r={r} />}</div></td>
                  <td><a className="btn btn-sm btn-ghost btn-icon" href={`/app/contact/${r.id}`} aria-label="Open contact" title="Open contact"><Icon name="external" /></a></td>
                </motion.tr>
              ))}
              {!data.recipients.length && <tr><td colSpan={cols.length + 6}><Empty icon="users" title="No contacts yet" action={<Button size="sm" onClick={() => setPanel("import")}>Import a spreadsheet</Button>}>Import an Excel or CSV file. Columns like "Name", "Mobile No." or "Email ID" are recognised automatically.</Empty></td></tr>}
              {data.recipients.length > 0 && !rows.length && <tr><td colSpan={cols.length + 6}><Empty icon="search" title="No contacts match" action={<button className="link-btn" onClick={clearAll}>Clear the filters</button>} /></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager p={pg} label="contacts" sizes={[25, 50, 100, 250]} />
        <div className="table-foot">
          <span>{rows.length} of {data.recipients.length} contacts match</span>
          <AnimatePresence mode="wait">{save.text && <motion.span key={save.text} className={`save-state ${save.tone}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {save.tone === "busy" ? <Spinner size={12} /> : <Icon name={save.tone === "err" ? "alert" : "check"} />}{save.text}</motion.span>}</AnimatePresence>
          <span className="grow" />
          <Button size="sm" variant="ghost" icon="columns" onClick={addColumn}>Add column</Button>
        </div>
      </div>
    </div>
  );
}
