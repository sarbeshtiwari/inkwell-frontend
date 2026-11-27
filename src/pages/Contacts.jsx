import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { emailOk, fmtDate, phoneOk, today } from "../lib/format";
import { go } from "../lib/router";
import { useApp } from "../lib/store";
import { Badge, Button, Chips, Empty, Icon, Spinner, fail, modal, toast, useDebounced, Pager, usePager } from "../ui/kit";
import { EmailBadge, SendBadge } from "../ui/shared";
import { extraCols } from "./Campaign";
import { AddPanel } from "./contacts/AddPanel";
import { ImportPanel } from "./contacts/ImportPanel";
import { SentPanel } from "./contacts/SentPanel";
import { FilterBuilder, applyRules, buildFields, ruleReady, ruleText } from "./contacts/FilterBuilder";
import { IncomingShares, ShareDialog, SharedPanel } from "./contacts/Sharing";

const CORE = ["name", "company", "phone", "email"];

const STATUS = ["wa_status", "wa_last", "email_status", "email_last", "email_opened", "replied_at", "reply_intent", "reply_count", "added_at"];

const PH = { name: "Add name", company: "Add company", phone: "Add phone", email: "Add email" };

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

export default function Contacts() {
  const app = useApp();
  const { data, me, selected, setSelected } = app;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  // Filter conditions are remembered in this browser, so they survive a reload.
  const [rules, setRulesRaw] = useState(() => { try { return JSON.parse(localStorage.getItem("contacts.rules") || "[]"); } catch { return []; } });
  const [match, setMatchRaw] = useState(() => { try { return localStorage.getItem("contacts.match") || "all"; } catch { return "all"; } });
  const setRules = f => setRulesRaw(rs => { const n = typeof f === "function" ? f(rs) : f; try { localStorage.setItem("contacts.rules", JSON.stringify(n)); } catch { /* private mode */ } return n; });
  const setMatch = m => { setMatchRaw(m); try { localStorage.setItem("contacts.match", m); } catch { /* private mode */ } };
  const [showFilters, setShowFilters] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [panel, setPanel] = useState(null);
  const [save, setSave] = useState({ text: "", tone: "" });
  const dq = useDebounced(q, 120);
  const cols = [...CORE, ...extraCols(data.recipients)];

  const fields = useMemo(() => buildFields(data.recipients, me.stages, extraCols(data.recipients).filter(c => c !== "list")), [data.recipients, me.stages]);
  const ready = rules.filter(r => ruleReady(r, fields));
  // Search and conditions, but not status, so the status chips can show how many each would give.
  const base = useMemo(() => {
    const s = dq.trim().toLowerCase();
    const hit = s ? data.recipients.filter(r => Object.entries(r).some(([k, v]) => k !== "id" && String(v).toLowerCase().includes(s))) : data.recipients;
    return applyRules(hit, ready, match, fields);
  }, [data.recipients, dq, ready, match, fields]);
  const rows = useMemo(() => status ? base.filter(STATUS_TESTS[status]) : base, [base, status]);
  const statusCounts = useMemo(() => Object.fromEntries(STATUS_CHIPS.map(([v]) => [v, v ? base.filter(STATUS_TESTS[v]).length : base.length])), [base]);
  const ruleKey = JSON.stringify(ready) + match;
  const pg = usePager(rows, [dq, status, ruleKey].join("|"), 50);
  const filtered = !!(dq || status || ready.length);
  const clearAll = () => { setQ(""); setStatus(""); setRules([]); };
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
        <Button icon="filter" className={showFilters || ready.length ? "on" : ""} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>
          Filters{ready.length > 0 && <span className="filter-n">{ready.length}</span>}</Button>
        <span className="grow" />
        <Button icon="users" className={panel === "shared" ? "on" : ""} onClick={() => togglePanel("shared")}>Shared</Button>
        <Button icon="mail" className={panel === "sent" ? "on" : ""} onClick={() => togglePanel("sent")}>Import from Sent mail</Button>
        <Button icon="upload" className={panel === "import" ? "on" : ""} onClick={() => togglePanel("import")}>Import Excel</Button>
        <Button variant="primary" icon="plus" onClick={() => togglePanel("add")}>Add contact</Button>
      </div>

      <div className="contact-status">
        <span className="help">Show</span>
        <Chips value={status} onChange={setStatus} options={STATUS_CHIPS.map(([v, l]) => [v, l, statusCounts[v]])} />
        <span className="grow" />
        <Button size="sm" icon="download" busy={exporting} onClick={exportRows} title={selected.size ? "Download the selected contacts as Excel" : "Download the contacts shown below as Excel"}>
          Export {selected.size ? `selected (${selected.size})` : filtered ? `${rows.length} shown` : "all"}</Button>
      </div>

      <IncomingShares />

      <AnimatePresence initial={false}>
        {showFilters && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
          <FilterBuilder fields={fields} rules={rules} setRules={setRules} match={match} setMatch={setMatch}
            matching={rows.length} total={data.recipients.length} onClose={() => setShowFilters(false)} />
        </motion.div>}
      </AnimatePresence>

      {filtered && <div className="active-filters">
        <span className="help">{rows.length} of {data.recipients.length} contacts</span>
        {ready.map((r, i) => <button key={r.id} type="button" className="filter-pill" onClick={() => setRules(rs => rs.filter(x => x.id !== r.id))} title="Remove this condition">
          {i > 0 && <span>{match === "any" ? "or" : "and"}</span>}{ruleText(r, fields)}<Icon name="x" /></button>)}
        {!showFilters && ready.length > 0 && <button type="button" className="link-btn" onClick={() => setShowFilters(true)}>Edit</button>}
        <button type="button" className="link-btn" onClick={clearAll}>Clear all</button>
      </div>}

      <AnimatePresence mode="wait">
        {panel && <motion.div key={panel} initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
          {panel === "add" && <AddPanel onClose={() => setPanel(null)} />}
          {panel === "import" && <ImportPanel onClose={() => setPanel(null)} />}
          {panel === "sent" && <SentPanel onClose={() => setPanel(null)} />}
          {panel === "shared" && <SharedPanel onClose={() => setPanel(null)} />}
        </motion.div>}
      </AnimatePresence>

      <ShareDialog open={sharing} ids={[...selected]} onClose={() => setSharing(false)} onShared={() => setPanel("shared")} />

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div className="bulkbar" initial={{ opacity: 0, y: -10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
            <b>{selected.size} selected</b><span className="grow" />
            <Button size="sm" icon="send" onClick={() => { app.setCampaignPreset({ who: "selected" }); go("campaign"); }}>Send to selected</Button>
            <Button size="sm" icon="users" onClick={() => setSharing(true)}>Share with a friend</Button>
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
