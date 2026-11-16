import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ago, safeHref } from "../../lib/format";
import { Badge, Button, Drawer, DrawerHead, Empty, Field, Icon, Seg, Sk, applyError, fail, modal, toast } from "../../ui/kit";
import { FilesChanged } from "./Diff";

export function Pulls({ base, repo, branch }) {
  const [state, setState] = useState("open");
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { setList(null); api(`/api/gh/pulls/${base}?state=${state}`).then(r => setList(r.pulls)).catch(fail); }, [base, state]);
  useEffect(() => { load(); }, [load]);
  return <>
    <div className="toolbar"><Seg size="sm" value={state} onChange={setState} options={[["open", "Open"], ["closed", "Closed"]]} /><span className="grow" /><Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New pull request</Button></div>
    <div className="card">
      {!list && <div className="card-pad"><Sk w="60%" /><Sk w="40%" style={{ marginTop: 10 }} /></div>}
      {list?.map((p, i) => (
        <motion.button key={p.number} className="pr-row" onClick={() => setOpen(p.number)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: i * .03 } }}>
          <span className={`pr-ic ${p.state}`}><Icon name="pr" /></span><div className="t"><b>{p.title}</b><span className="help">#{p.number} · {p.head} → {p.base} · by {p.user} · {ago(p.updated_at)}</span></div>
          <Badge tone={p.state === "merged" ? "brand" : p.state === "open" ? "ok" : ""}>{p.state}</Badge></motion.button>))}
      {list && !list.length && <Empty icon="pr" title={state === "open" ? "No open pull requests" : "No closed pull requests"}>Create a branch, push your changes to it, then open a pull request to merge them.</Empty>}
    </div>
    <Drawer open={!!open} onClose={() => setOpen(null)} wide label="Pull request">{open && <PullDetail base={base} n={open} onChanged={load} onClose={() => setOpen(null)} />}</Drawer>
    <Drawer open={creating} onClose={() => setCreating(false)} label="New pull request">{creating && repo && <NewPull base={base} repo={repo} branch={branch} onDone={n => { setCreating(false); load(); if (n) setOpen(n); }} />}</Drawer>
  </>;
}

export function PullDetail({ base, n, onChanged, onClose }) {
  const [p, setP] = useState(null);
  const [method, setMethod] = useState("merge");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api(`/api/gh/pull/${base}/${n}`).then(setP).catch(fail), [base, n]);
  useEffect(() => { load(); }, [load]);
  if (!p) return <div className="dr-pad"><Sk w="60%" h={22} /><div className="card sk-block" style={{ marginTop: 20 }} /></div>;
  const act = async kind => {
    if (!await modal({ title: kind === "merge" ? `Merge #${p.number} into ${p.base}?` : `Close #${p.number} without merging?`, confirm: kind === "merge" ? "Merge" : "Close", danger: kind !== "merge" })) return;
    setBusy(kind);
    try { await api(`/api/gh/pull/${base}/${n}/${kind}`, { json: kind === "merge" ? { method } : {} }); toast(kind === "merge" ? "Merged" : "Closed"); load(); onChanged(); } catch (e) { fail(e); }
    setBusy("");
  };
  return <>
    <DrawerHead logo={<span className={`pr-ic lg ${p.state}`}><Icon name="pr" /></span>} title={p.title} sub={<>#{p.number} · {p.head} → {p.base} · by {p.user} · <span className="add">+{p.additions}</span> <span className="rem">−{p.deletions}</span></>} onClose={onClose} />
    <div className="dr-pad">
      {p.body && <div className="pr-body">{p.body}</div>}
      {p.state === "open" ? <div className="form-actions">{p.mergeable === false && <Badge tone="bad">Has conflicts: resolve on GitHub</Badge>}<span className="grow" />
        <Button variant="ghost" className="btn-danger" busy={busy === "close"} onClick={() => act("close")}>Close</Button>
        <select className="select auto" value={method} onChange={e => setMethod(e.target.value)}><option value="merge">Merge commit</option><option value="squash">Squash and merge</option><option value="rebase">Rebase and merge</option></select>
        <Button variant="primary" disabled={p.mergeable === false} busy={busy === "merge"} onClick={() => act("merge")}>Merge</Button></div>
        : <Badge tone={p.state === "merged" ? "brand" : ""}>{p.state}</Badge>}
      <a className="help" href={safeHref(p.url)} target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a>
      <h4 className="dr-sub">Files changed ({p.files.length})</h4>
      <FilesChanged files={p.files} />
    </div>
  </>;
}

export function NewPull({ base, repo, branch, onDone }) {
  const others = repo.branches.filter(b => b !== repo.default_branch);
  const [v, setV] = useState({ head: others.includes(branch) ? branch : (others[0] || branch), base: repo.default_branch, title: "", body: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErrors({});
    if (!v.title.trim()) return setErrors({ title: "Give it a title." });
    if (v.head === v.base) return setErrors({ head: "Pick two different branches." });
    setBusy(true);
    try { const p = await api(`/api/gh/pulls/${base}`, { json: v }); toast(`Pull request #${p.number} created`); onDone(p.number); } catch (er) { applyError(er, setErrors); }
    setBusy(false);
  };
  return <>
    <DrawerHead logo={<span className="pr-ic lg open"><Icon name="pr" /></span>} title="New pull request" onClose={() => onDone(null)} />
    <form className="dr-pad" onSubmit={submit} noValidate>
      <div className="row-2">
        <Field label="Merge changes from" error={errors.head}><select className="select" value={v.head} onChange={e => setV(x => ({ ...x, head: e.target.value }))}>{(others.length ? others : repo.branches).map(b => <option key={b}>{b}</option>)}</select></Field>
        <Field label="Into"><select className="select" value={v.base} onChange={e => setV(x => ({ ...x, base: e.target.value }))}>{repo.branches.map(b => <option key={b}>{b}</option>)}</select></Field>
      </div>
      <Field label="Title" error={errors.title} style={{ marginTop: 12 }}><input className="input" value={v.title} onChange={e => setV(x => ({ ...x, title: e.target.value }))} autoFocus /></Field>
      <Field label="Description" opt="(Markdown)" style={{ marginTop: 12 }}><textarea className="textarea" rows={6} value={v.body} onChange={e => setV(x => ({ ...x, body: e.target.value }))} /></Field>
      <div className="form-actions"><span className="grow" /><Button onClick={() => onDone(null)}>Cancel</Button><Button type="submit" variant="primary" busy={busy}>Create pull request</Button></div>
    </form>
  </>;
}
