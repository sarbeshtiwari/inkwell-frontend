import { useMemo } from "react";
import { Button, Icon, Seg } from "../../ui/kit";

// Contact filters as plain conditions: "<column> <operator> <value>", matched all together or any one.
// Works on every column, including the ones an import brought in (location, skills, resume score…).

const HIRING = /^(careers?|jobs?|hiring|recruit\w*|talent\w*|hr|people|join\w*|apply|applications?|resumes?|cv)([._-]|$)/i;
const GENERAL = /^(hello|hi|info|contact|team|office|mail|enquir\w*|inquir\w*|general|support|sales|admin)([._-]|$)/i;

// What kind of inbox an address reaches: hiring (careers@, jobs@, hr@…), general (info@, contact@…) or a person.
export function addressKind(r) {
  if (!r.email) return "none";
  if (r.email_type === "careers") return "hiring";
  if (r.email_type === "general") return "general";
  if (r.email_type === "referral") return "person";
  const local = r.email.split("@")[0];
  return HIRING.test(local) ? "hiring" : GENERAL.test(local) ? "general" : "person";
}

const KINDS = { hiring: "Careers / HR inbox", general: "General inbox (info@…)", person: "A person's own email", none: "No email" };

export const OPS = {
  text: [["contains", "contains"], ["not_contains", "doesn't contain"], ["is", "is exactly"], ["is_not", "is not"],
    ["starts", "starts with"], ["empty", "is empty"], ["not_empty", "is not empty"]],
  number: [["gte", "is at least"], ["lte", "is at most"], ["gt", "is more than"], ["lt", "is less than"], ["eq", "equals"],
    ["between", "is between"], ["empty", "is empty"], ["not_empty", "is not empty"]],
  choice: [["any_of", "is any of"], ["none_of", "is none of"], ["empty", "is empty"], ["not_empty", "is not empty"]],
  date: [["last_days", "in the last … days"], ["older_days", "more than … days ago"], ["after", "is on or after"],
    ["before", "is before"], ["empty", "is not set"], ["not_empty", "is set"]],
};
const NO_VALUE = new Set(["empty", "not_empty"]);

const num = v => {
  const n = parseFloat(String(v ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const day = v => { const d = new Date(v); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const terms = v => String(v || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
const pretty = k => k.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());

// Every column you can filter on, with its type guessed from the data: numbers ("85", "100%"), a short set of
// repeated values (hire type, verdict, list…) or free text.
export function buildFields(rows, stages, extra) {
  const f = [
    { key: "name", label: "Name", group: "Contact", type: "text" },
    { key: "company", label: "Company", group: "Contact", type: "text" },
    { key: "email", label: "Email", group: "Contact", type: "text" },
    { key: "phone", label: "Phone", group: "Contact", type: "text" },
    { key: "email_kind", label: "Email type", group: "Contact", type: "choice", get: addressKind, options: Object.entries(KINDS) },
    { key: "list", label: "List", group: "Outreach", type: "choice" },
    { key: "stage", label: "Stage", group: "Outreach", type: "choice", get: r => r.stage || "new", options: Object.entries(stages) },
    { key: "added_at", label: "Date added", group: "Outreach", type: "date" },
    { key: "follow_up", label: "Follow-up date", group: "Outreach", type: "date" },
    { key: "email_last", label: "Last emailed", group: "Outreach", type: "date" },
    { key: "replied_at", label: "Replied on", group: "Outreach", type: "date" },
  ];
  for (const k of extra) {
    const vals = rows.map(r => r[k]).filter(v => v !== undefined && v !== null && String(v).trim() !== "");
    const distinct = new Set(vals.map(String));
    const type = vals.length && vals.filter(v => num(v) !== null && /^[\s\d.,%+-]+$/.test(String(v))).length / vals.length >= .8 ? "number"
      : distinct.size > 0 && distinct.size <= 30 && vals.every(v => String(v).length <= 60) ? "choice" : "text";
    f.push({ key: k, label: pretty(k), group: "Your columns", type });
  }
  for (const x of f) {
    x.get = x.get || (r => r[x.key]);
    if (x.type === "choice" && !x.options) {
      const c = {};
      rows.forEach(r => { const v = String(x.get(r) ?? "").trim(); if (v) c[v] = (c[v] || 0) + 1; });
      x.options = Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b)).map(v => [v, v]);
    }
    if (x.type === "choice") {
      const c = {};
      rows.forEach(r => { const v = String(x.get(r) ?? ""); c[v] = (c[v] || 0) + 1; });
      x.counts = c;
    }
  }
  return f;
}

function test(r, rule, field) {
  const raw = field.get(r);
  const s = String(raw ?? "").trim();
  const { op, value } = rule;
  if (op === "empty") return !s;
  if (op === "not_empty") return !!s;
  if (field.type === "choice") {
    const pick = Array.isArray(value) ? value : [];
    if (!pick.length) return true;
    return op === "none_of" ? !pick.includes(s) : pick.includes(s);
  }
  if (field.type === "number") {
    const [lo, hi] = Array.isArray(value) ? value : [value];
    const n = num(s), a = num(lo), b = num(hi);
    if (a === null && !(op === "between" && b !== null)) return true;  // no number typed yet: don't filter
    if (n === null) return false;
    return { eq: n === a, gt: n > a, gte: n >= a, lt: n < a, lte: n <= a,
      between: (a === null || n >= a) && (b === null || n <= b) }[op] ?? true;
  }
  if (field.type === "date") {
    if (op === "last_days" || op === "older_days") {
      const n = num(value); if (n === null) return true;
      const d = day(s); if (d === null) return false;
      const age = Math.round((day(new Date()) - d) / 86400000);
      return op === "last_days" ? age < n : age > n;
    }
    const v = day(value); if (v === null) return true;
    const d = day(s); if (d === null) return false;
    return op === "after" ? d >= v : d < v;
  }
  const low = s.toLowerCase();
  const t = terms(value);
  if (!t.length) return true;
  if (op === "contains") return t.some(x => low.includes(x));
  if (op === "not_contains") return !t.some(x => low.includes(x));
  if (op === "starts") return t.some(x => low.startsWith(x));
  if (op === "is") return t.includes(low);
  if (op === "is_not") return !t.includes(low);
  return true;
}

export function applyRules(rows, rules, match, fields) {
  const byKey = Object.fromEntries(fields.map(f => [f.key, f]));
  const live = rules.filter(r => byKey[r.field]);
  if (!live.length) return rows;
  return rows.filter(r => match === "any" ? live.some(x => test(r, x, byKey[x.field])) : live.every(x => test(r, x, byKey[x.field])));
}

// "Location contains Pune, Bengaluru" — the words on a removable pill.
export function ruleText(rule, fields) {
  const f = fields.find(x => x.key === rule.field);
  if (!f) return "";
  const op = (OPS[f.type].find(([k]) => k === rule.op) || [, ""])[1];
  if (NO_VALUE.has(rule.op)) return `${f.label} ${op}`;
  let v = rule.value;
  if (f.type === "choice") v = (v || []).map(x => (f.options.find(([k]) => k === x) || [, x || "(blank)"])[1]).join(", ");
  else if (rule.op === "between") v = `${v?.[0] || "…"} and ${v?.[1] || "…"}`;
  else if (rule.op === "last_days" || rule.op === "older_days") return `${f.label} ${op.replace("…", v || "…")}`;
  return `${f.label} ${op} ${v || "…"}`;
}

export const ruleReady = (rule, fields) => {
  const f = fields.find(x => x.key === rule.field);
  if (!f) return false;
  if (NO_VALUE.has(rule.op)) return true;
  const v = rule.value;
  return Array.isArray(v) ? v.some(x => String(x ?? "").trim()) : !!String(v ?? "").trim();
};

const fresh = f => ({ id: Math.random().toString(36).slice(2), field: f.key, op: OPS[f.type][0][0], value: f.type === "choice" ? [] : "" });

export function FilterBuilder({ fields, rules, setRules, match, setMatch, matching, total, onClose }) {
  const groups = useMemo(() => fields.reduce((g, f) => ({ ...g, [f.group]: [...(g[f.group] || []), f] }), {}), [fields]);
  const byKey = Object.fromEntries(fields.map(f => [f.key, f]));
  const put = (id, ch) => setRules(rs => rs.map(r => r.id === id ? { ...r, ...ch } : r));
  const add = () => setRules(rs => [...rs, fresh(byKey.location || fields.find(f => f.group === "Your columns") || byKey.company)]);
  return (
    <div className="card fb">
      <div className="fb-head">
        <b>Show contacts where</b>
        {rules.length > 1 && <Seg size="sm" value={match} onChange={setMatch} name="Match" options={[["all", "all conditions match"], ["any", "any condition matches"]]} />}
        <span className="grow" />
        <span className="help">{matching} of {total} match</span>
        <Button size="sm" variant="ghost" icon="x" onClick={onClose} aria-label="Close filters" />
      </div>
      {!rules.length && <p className="help fb-empty">No conditions yet. Add one, like <i>Location contains Bengaluru</i> or <i>Resume score is at least 80</i>.</p>}
      {rules.map((r, i) => {
        const f = byKey[r.field] || fields[0];
        return (
          <div className="fb-row" key={r.id}>
            <span className="fb-join">{i === 0 ? "Where" : match === "any" ? "or" : "and"}</span>
            <select className="select" value={f.key} aria-label="Column" onChange={e => { const nf = byKey[e.target.value]; put(r.id, { field: nf.key, op: OPS[nf.type][0][0], value: nf.type === "choice" ? [] : "" }); }}>
              {Object.entries(groups).map(([g, fs]) => <optgroup key={g} label={g}>{fs.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</optgroup>)}
            </select>
            <select className="select" value={r.op} aria-label="Condition" onChange={e => put(r.id, { op: e.target.value, value: f.type === "choice" ? r.value : e.target.value === "between" ? ["", ""] : "" })}>
              {OPS[f.type].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div className="fb-val"><Value f={f} r={r} set={value => put(r.id, { value })} /></div>
            <Button size="sm" variant="ghost" icon="trash" aria-label="Remove condition" onClick={() => setRules(rs => rs.filter(x => x.id !== r.id))} />
          </div>
        );
      })}
      <div className="fb-foot">
        <Button size="sm" icon="plus" onClick={add}>Add condition</Button>
        {rules.length > 0 && <button type="button" className="link-btn" onClick={() => setRules([])}>Remove all</button>}
      </div>
    </div>
  );
}

function Value({ f, r, set }) {
  if (NO_VALUE.has(r.op)) return null;
  if (f.type === "choice") {
    const on = new Set(r.value || []);
    if (!f.options.length) return <span className="help">No values yet</span>;
    return (
      <div className="fb-opts">
        {f.options.slice(0, 40).map(([k, l]) => (
          <button key={k} type="button" className={`fb-opt ${on.has(k) ? "on" : ""}`} aria-pressed={on.has(k)}
            onClick={() => set(on.has(k) ? [...on].filter(x => x !== k) : [...on, k])}>
            {on.has(k) && <Icon name="check" />}{l}<span className="n">{f.counts?.[k] || 0}</span></button>
        ))}
      </div>
    );
  }
  if (r.op === "between") {
    const [a = "", b = ""] = Array.isArray(r.value) ? r.value : [];
    return <div className="fb-pair"><input className="input" inputMode="decimal" placeholder="From" value={a} onChange={e => set([e.target.value, b])} />
      <span className="help">and</span><input className="input" inputMode="decimal" placeholder="To" value={b} onChange={e => set([a, e.target.value])} /></div>;
  }
  if (f.type === "number" || r.op === "last_days" || r.op === "older_days")
    return <input className="input" inputMode="numeric" placeholder={f.type === "date" ? "Days, e.g. 7" : "Number"} value={r.value || ""} onChange={e => set(e.target.value)} />;
  if (f.type === "date") return <input className="input" type="date" value={r.value || ""} onChange={e => set(e.target.value)} />;
  return <input className="input" placeholder={r.op === "contains" || r.op === "not_contains" ? "e.g. Pune, Bengaluru (any of)" : "Value"} value={r.value || ""} onChange={e => set(e.target.value)} />;
}
