import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { ago } from "../../lib/format";
import { go } from "../../lib/router";
import { Avatar, Badge, Button, Check, Chips, Drawer, DrawerHead, Empty, Field, Icon, Pager, applyError, fail, modal, toast, useDebounced, usePager } from "../../ui/kit";

export const OWN = [
  ["mine", "Created by me", r => r.mine && !r.fork],
  ["forks", "Forked", r => r.mine && r.fork],
  ["contrib", "Contributed", r => !r.mine && !r.org],
  ["org", "Organisations", r => !r.mine && r.org],
  ["all", "All", () => true],
];

export function Repos({ status, onDisconnect }) {
  const [repos, setRepos] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [own, setOwn] = useState("mine");
  const [vis, setVis] = useState("");
  const [lang, setLang] = useState("");
  const [sort, setSort] = useState("updated");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);
  const top = useRef(null);
  useEffect(() => { api("/api/gh/repos").then(r => setRepos(r.repos.map(x => ({ ...x, mine: x.owner.toLowerCase() === status.login.toLowerCase(), org: x.owner_type === "Organization" })))).catch(e => setErr(e.message)); }, [status.login]);
  const all = repos || [];
  const langs = useMemo(() => [...new Set(all.map(r => r.language).filter(Boolean))].sort(), [all]);
  const base = all.filter(r => (archived || !r.archived) && (!vis || (vis === "private" ? r.private : !r.private)) && (!lang || r.language === lang)
    && (!dq || [r.full_name, r.description, r.language].some(v => (v || "").toLowerCase().includes(dq.toLowerCase()))));
  const rows = useMemo(() => {
    const fn = OWN.find(o => o[0] === own)[2];
    const by = { updated: (a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""), name: (a, b) => a.name.localeCompare(b.name),
      stars: (a, b) => b.stargazers_count - a.stargazers_count, size: (a, b) => (b.size || 0) - (a.size || 0) }[sort];
    return base.filter(fn).sort(by);
  }, [base, own, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const pg = usePager(rows, [own, vis, lang, sort, archived, dq].join("|"), 24);
  const disconnect = async () => { if (!await modal({ title: "Disconnect GitHub?", text: "Inkwell will forget your token. Your repositories aren't affected.", confirm: "Disconnect", danger: true })) return; await api("/api/gh/disconnect", { json: {} }).catch(fail); onDisconnect(); };
  const filtered = vis || lang || archived || dq;
  return (
    <div ref={top}>
      <div className="toolbar">
        <div className="gh-user">{status.avatar ? <img src={status.avatar} alt="" /> : <Avatar name={status.login} />}<div><b>{status.name || status.login}</b><span className="help">@{status.login} · <button className="link-btn" onClick={disconnect}>Disconnect</button></span></div></div>
        <span className="grow" />
        <Button icon="plus" variant="primary" onClick={() => setCreating(true)}>New repository</Button>
      </div>
      <div className="card gh-filters">
        <Chips value={own} onChange={setOwn} options={OWN.map(([k, l, fn]) => [k, l, repos ? base.filter(fn).length : undefined])} />
        <div className="gh-filter-row">
          <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Find a repository…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select className="select auto" value={vis} onChange={e => setVis(e.target.value)} aria-label="Visibility"><option value="">Public &amp; private</option><option value="public">Public only</option><option value="private">Private only</option></select>
          <select className="select auto" value={lang} onChange={e => setLang(e.target.value)} aria-label="Language"><option value="">All languages</option>{langs.map(l => <option key={l}>{l}</option>)}</select>
          <select className="select auto" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="stars">Most stars</option><option value="size">Largest</option></select>
          <Check checked={archived} onChange={setArchived}>Show archived</Check>
          {filtered && <button className="link-btn" onClick={() => { setQ(""); setVis(""); setLang(""); setArchived(false); }}>Clear filters</button>}
        </div>
      </div>
      {err && <div className="card"><Empty icon="alert" title="Couldn't load repositories">{err}</Empty></div>}
      <div className="gh-repo-grid">
        {!repos && !err && Array.from({ length: 6 }, (_, i) => <div key={i} className="card sk-card" style={{ height: 130 }} />)}
        <AnimatePresence mode="popLayout" initial={false}>
          {pg.items.map((r, i) => (
            <motion.button layout key={r.full_name} className="card gh-repo hover" onClick={() => go(`github/${r.owner}:${r.name}`)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * .025 } }} exit={{ opacity: 0, scale: .96 }}>
              <div className="gh-repo-top"><Icon name={r.fork ? "branch" : "folder"} /><b>{r.mine ? r.name : r.full_name}</b>
                <Badge dot={false}>{r.private ? "Private" : "Public"}</Badge>{r.fork && <Badge tone="violet" dot={false}>Fork</Badge>}{!r.mine && <Badge tone="brand" dot={false}>{r.org ? "Org" : "Collaborator"}</Badge>}{r.archived && <Badge tone="warn" dot={false}>Archived</Badge>}</div>
              <p>{r.description || "No description"}</p>
              <div className="gh-repo-meta">{r.language && <span><i className="lang-dot" />{r.language}</span>}<span><Icon name="star" />{r.stargazers_count}</span><span><Icon name="branch" />{r.forks_count}</span><span>Updated {ago(r.updated_at)}</span></div>
            </motion.button>))}
        </AnimatePresence>
        {repos && !rows.length && <div style={{ gridColumn: "1/-1" }} className="card"><Empty icon="folder" title={repos.length ? "No repositories match" : "No repositories yet"}>{repos.length ? "Try another filter." : "Create your first one with New repository."}</Empty></div>}
      </div>
      {rows.length > 0 && <div className="card" style={{ marginTop: 14 }}><Pager p={pg} label="repositories" sizes={[12, 24, 48, 96]} scrollTo={top} /></div>}
      <Drawer open={creating} onClose={() => setCreating(false)} label="New repository">{creating && <NewRepo onClose={() => setCreating(false)} />}</Drawer>
    </div>
  );
}

export function NewRepo({ onClose }) {
  const [v, setV] = useState({ name: "", description: "", private: true, readme: true });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErrors({});
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(v.name.trim())) return setErrors({ name: "Use letters, numbers, - _ and . only." });
    setBusy(true);
    try { const r = await api("/api/gh/repos", { json: { ...v, name: v.name.trim() } }); toast("Repository created"); onClose(); go(`github/${r.owner}:${r.name}`); } catch (er) { applyError(er, setErrors); }
    setBusy(false);
  };
  return <>
    <DrawerHead logo={<span className="co-logo lg grad"><Icon name="github" /></span>} title="New repository" onClose={onClose} />
    <form className="dr-pad" onSubmit={submit} noValidate>
      <Field label="Name" error={errors.name}><input className="input" placeholder="my-project" value={v.name} onChange={e => setV(x => ({ ...x, name: e.target.value }))} autoFocus /></Field>
      <Field label="Description" opt="(optional)" style={{ marginTop: 12 }}><input className="input" value={v.description} onChange={e => setV(x => ({ ...x, description: e.target.value }))} /></Field>
      <div className="stack-sm" style={{ marginTop: 14 }}><Check checked={v.private} onChange={x => setV(y => ({ ...y, private: x }))}>Private</Check><Check checked={v.readme} onChange={x => setV(y => ({ ...y, readme: x }))}>Add a README</Check></div>
      <div className="form-actions"><span className="grow" /><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" busy={busy} busyLabel="Creating…">Create repository</Button></div>
    </form>
  </>;
}

/* ---------------------------------------------------------------- repository view */
