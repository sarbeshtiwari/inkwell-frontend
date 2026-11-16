import Editor, { DiffEditor } from "@monaco-editor/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { ago, safeHref } from "../../lib/format";
import { go } from "../../lib/router";
import { Button, Empty, Field, FileIcon, FormError, Icon, Seg, Sk, fail, modal, toast } from "../../ui/kit";
import { History } from "./History";
import { Pulls } from "./Pulls";

export const LANG = { js: "javascript", jsx: "javascript", mjs: "javascript", ts: "typescript", tsx: "typescript", py: "python", md: "markdown", markdown: "markdown", json: "json",
  html: "html", htm: "html", css: "css", scss: "scss", less: "less", yml: "yaml", yaml: "yaml", sh: "shell", bash: "shell", java: "java", kt: "kotlin", go: "go", rs: "rust",
  rb: "ruby", php: "php", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp", swift: "swift", dart: "dart", sql: "sql", xml: "xml", toml: "ini", ini: "ini", dockerfile: "dockerfile" };

export const langOf = p => LANG[(p.split("/").pop().toLowerCase() === "dockerfile" ? "dockerfile" : p.split(".").pop().toLowerCase())] || "plaintext";

export const useDark = () => { const [d, setD] = useState(document.documentElement.dataset.theme === "dark"); useEffect(() => { const f = () => setD(document.documentElement.dataset.theme === "dark"); addEventListener("themechange", f); return () => removeEventListener("themechange", f); }, []); return d; };

export function Repo({ owner, name }) {
  const dark = useDark();
  const [repo, setRepo] = useState(null);
  const [err, setErr] = useState("");
  const [branch, setBranch] = useState("");
  const [tree, setTree] = useState(null);
  const [files, setFiles] = useState({}); // path -> { kind, orig, value, sha, isNew, deleted, data, html_url }
  const [active, setActive] = useState("");
  const [openOrder, setOpenOrder] = useState([]);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [view, setView] = useState("edit");
  const [tab, setTab] = useState("code");
  const [md, setMd] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [formError, setFormError] = useState("");
  const base = `${owner}/${name}`;

  const loadTree = useCallback(async br => {
    const d = await api(`/api/gh/tree/${base}?ref=${encodeURIComponent(br)}`);
    setTree(d);
    if (d.truncated) toast("This repository is very large; some files aren't listed.", true);
    return d;
  }, [base]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/api/gh/repo/${base}`);
        setRepo(r); setBranch(r.default_branch);
        const t = await loadTree(r.default_branch);
        const readme = t.items.find(n => /^readme(\.md|\.markdown)?$/i.test(n.path));
        if (readme) openFile(readme.path, r.default_branch, t);
      } catch (e) { setErr(e.message); }
    })();
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => Object.entries(files).filter(([, f]) => f.deleted || f.isNew || (f.kind === "text" && f.value !== f.orig)), [files]);
  useEffect(() => { const w = e => { if (dirty.length) { e.preventDefault(); e.returnValue = ""; } }; addEventListener("beforeunload", w); return () => removeEventListener("beforeunload", w); }, [dirty.length]);

  async function openFile(path, br = branch, t = tree) {
    setActive(path); setView("edit"); setMd("");
    setOpenOrder(o => o.includes(path) ? o : [...o, path]);
    if (files[path]) return;
    const node = t?.items.find(n => n.path === path);
    setFiles(f => ({ ...f, [path]: { loading: true, sha: node?.sha } }));
    try {
      const d = await api(`/api/gh/file/${base}?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(br)}`);
      setFiles(f => ({ ...f, [path]: { ...d, orig: d.content ?? "", value: d.content ?? "", loading: false } }));
    } catch (e) { fail(e); setFiles(f => { const x = { ...f }; delete x[path]; return x; }); setOpenOrder(o => o.filter(p => p !== path)); }
  }
  const closeTab = async path => {
    const f = files[path];
    if (f && (f.isNew || f.deleted || f.value !== f.orig) && !await modal({ title: "Discard changes to this file?", text: path, confirm: "Discard", danger: true })) return;
    setFiles(x => { const y = { ...x }; delete y[path]; return y; });
    setOpenOrder(o => { const n = o.filter(p => p !== path); if (active === path) setActive(n.at(-1) || ""); return n; });
  };
  const newFile = async () => {
    const path = (await modal({ title: "New file", text: "Path inside the repository, e.g. src/utils.js or docs/setup.md.", input: "", confirm: "Create" }) || "").trim().replace(/^\/+/, "");
    if (!path) return;
    if (path.split("/").some(s => !s || s === "." || s === "..")) return toast("That isn't a valid file path.", true);
    if (tree.items.some(n => n.path === path) || files[path]) return toast("A file with that path already exists.", true);
    setFiles(f => ({ ...f, [path]: { kind: "text", orig: "", value: "", isNew: true, mode: "100644" } }));
    setOpenOrder(o => [...o, path]); setActive(path);
  };
  const toggleDelete = async () => {
    const f = files[active];
    if (f.isNew) return closeTab(active);
    if (!f.deleted && !await modal({ title: `Delete ${active}?`, text: "It's removed from the repository when you commit & push.", confirm: "Delete", danger: true })) return;
    setFiles(x => ({ ...x, [active]: { ...x[active], deleted: !x[active].deleted } }));
  };
  const preview = async () => {
    if (md) return setMd("");
    setBusy("md");
    try {
      const { html } = await api("/api/gh/markdown", { json: { text: files[active].value, context: base } });
      const dir = active.includes("/") ? active.slice(0, active.lastIndexOf("/") + 1) : "";
      setMd(`<!doctype html><html><head><base href="https://github.com/${base}/raw/${encodeURIComponent(branch)}/${dir}" target="_blank"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown-${dark ? "dark" : "light"}.min.css"><style>body{margin:0;padding:24px 32px;background:${dark ? "#0d1117" : "#fff"}}.markdown-body{max-width:900px;margin:0 auto}</style></head><body><article class="markdown-body">${html}</article></body></html>`);
    } catch (e) { fail(e); }
    setBusy("");
  };
  const commit = async e => {
    e.preventDefault(); setFormError("");
    if (!dirty.length) return;
    if (!msg.trim()) return setFormError("Describe your change, e.g. “Update README with setup steps”.");
    setBusy("commit");
    try {
      const changes = dirty.map(([path, f]) => f.deleted ? { path, delete: true, mode: f.mode || "100644" } : { path, content: f.value, mode: f.mode || "100644" });
      const r = await api(`/api/gh/commit/${base}`, { json: { branch, message: msg.trim(), changes, base_head: tree.head } });
      setFiles(x => { const y = { ...x }; dirty.forEach(([p, f]) => { if (f.deleted) delete y[p]; else y[p] = { ...y[p], orig: y[p].value, isNew: false }; }); return y; });
      setOpenOrder(o => o.filter(p => !dirty.some(([dp, f]) => dp === p && f.deleted)));
      setMsg(""); await loadTree(branch);
      toast(`Pushed ${r.files} file${r.files === 1 ? "" : "s"} to ${branch}`);
    } catch (er) { setFormError(er.message); if (er.field === "conflict") toast("Pull first, then commit again. Your edits are still here.", true); }
    setBusy("");
  };
  const discardAll = async () => {
    if (!await modal({ title: "Discard all changes?", text: "Every unpushed edit, new file and deletion is lost.", confirm: "Discard all", danger: true })) return;
    setFiles(x => { const y = {}; Object.entries(x).forEach(([p, f]) => { if (!f.isNew) y[p] = { ...f, value: f.orig, deleted: false }; }); return y; });
    setOpenOrder(o => o.filter(p => !files[p]?.isNew));
  };
  const pull = async () => {
    setBusy("pull");
    try {
      const before = tree.head; const t = await loadTree(branch);
      let updated = 0, kept = 0;
      for (const [p, f] of Object.entries(files)) {
        const node = t.items.find(n => n.path === p);
        if (!node || f.kind !== "text" || node.sha === f.sha) continue;
        const d = await api(`/api/gh/file/${base}?path=${encodeURIComponent(p)}&ref=${encodeURIComponent(branch)}`);
        setFiles(x => ({ ...x, [p]: { ...x[p], sha: d.sha, orig: d.content, value: x[p].value === x[p].orig ? d.content : x[p].value } }));
        f.value === f.orig ? updated++ : kept++;
      }
      toast(before === t.head ? "Already up to date." : `Pulled the latest commits${updated ? `, ${updated} open file${updated === 1 ? "" : "s"} refreshed` : ""}${kept ? `. ${kept} file${kept === 1 ? " has" : "s have"} your edits on top` : ""}.`);
    } catch (e) { fail(e); }
    setBusy("");
  };
  const switchBranch = async br => {
    if (dirty.length && !await modal({ title: "Switch branch and discard changes?", text: `You have ${dirty.length} unpushed change(s) on ${branch}.`, confirm: "Switch", danger: true })) return;
    setFiles({}); setOpenOrder([]); setActive(""); setBranch(br); setTree(null);
    try { await loadTree(br); } catch (e) { fail(e); }
  };
  const newBranch = async () => {
    const b = (await modal({ title: "New branch", text: `Created from ${branch}. Your unpushed changes come with you.`, input: "", confirm: "Create branch" }) || "").trim();
    if (!b) return;
    try { await api(`/api/gh/branch/${base}`, { json: { name: b, from: branch } }); setRepo(r => ({ ...r, branches: [...r.branches, b] })); setBranch(b); await loadTree(b); toast(`Switched to new branch ${b}`); } catch (e) { fail(e); }
  };

  if (err) return <div className="card"><Empty icon="alert" title="Couldn't open this repository" action={<Button onClick={() => go("github")}>Back to repositories</Button>}>{err}</Empty></div>;
  const f = files[active];
  return (
    <div className="gh">
      <div className="gh-bar">
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={async () => { if (!dirty.length || await modal({ title: "Discard unpushed changes?", text: `You have ${dirty.length} changed file(s).`, confirm: "Discard", danger: true })) go("github"); }}>Repositories</Button>
        <b className="gh-name">{base}</b>
        {repo && <select className="select sm" value={branch} onChange={e => switchBranch(e.target.value)} aria-label="Branch">{(repo.branches.length ? repo.branches : [branch]).map(b => <option key={b}>{b}</option>)}</select>}
        <Button size="sm" icon="branch" onClick={newBranch}>New branch</Button>
        <Button size="sm" icon="download" busy={busy === "pull"} onClick={pull} title="Get the latest version from GitHub">Pull</Button>
        <span className="grow" />
        <Seg size="sm" value={tab} onChange={setTab} options={[["code", "Code", "file"], ["pulls", "Pull requests", "pr"], ["history", "History", "commit"]]} />
        {repo && <a className="btn btn-sm btn-ghost" target="_blank" rel="noopener noreferrer" href={safeHref(repo.html_url)}><Icon name="external" />Open on GitHub</a>}
      </div>
      <AnimatePresence mode="wait">
        {tab === "code" ? (
          <motion.div key="code" className="gh-code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <aside className="card gh-tree">
              <div className="gh-tree-head">{tree ? <span className="help clip"><Icon name="commit" />{tree.empty ? "Empty repository" : `${(tree.message || "").slice(0, 40)} · ${ago(tree.date)}`}</span> : <Sk w="70%" />}<span className="grow" /><Button variant="ghost" size="sm" icon="plus" aria-label="New file" title="New file" onClick={newFile} /></div>
              <div className="gh-tree-list">{tree ? <Tree items={tree.items} files={files} active={active} collapsed={collapsed} setCollapsed={setCollapsed} onOpen={p => openFile(p)} /> : Array.from({ length: 8 }, (_, i) => <div key={i} style={{ padding: "6px 12px" }}><Sk w={`${50 + (i * 13) % 40}%`} /></div>)}</div>
            </aside>
            <div className="card gh-editor">
              {openOrder.length > 0 && <div className="gh-tabs-row">
                {openOrder.map(p => { const x = files[p]; const mod = x && (x.isNew || x.deleted || x.value !== x.orig);
                  return <div key={p} className={`gh-tab ${p === active ? "on" : ""} ${x?.deleted ? "del" : ""}`} onClick={() => { setActive(p); setMd(""); }} title={p}>
                    {p === active && <motion.span className="gh-tab-bar" layoutId="ghtab" />}<FileIcon name={p} /><span>{p.split("/").pop()}</span>{mod && <i className="dot" />}
                    <button className="x" aria-label={`Close ${p}`} onClick={e => { e.stopPropagation(); closeTab(p); }}><Icon name="x" /></button></div>; })}
              </div>}
              {f && !f.loading && <div className="gh-edit-tools">
                <span className="help mono clip">{active}</span><span className="grow" />
                {/\.(md|markdown|mdx)$/i.test(active) && f.kind === "text" && <Button size="sm" icon="eye" className={md ? "on" : ""} busy={busy === "md"} onClick={preview}>Preview</Button>}
                {f.kind === "text" && !f.isNew && <Button size="sm" icon="columns" className={view === "diff" ? "on" : ""} onClick={() => { setView(v => v === "diff" ? "edit" : "diff"); setMd(""); }}>Changes</Button>}
                <Button size="sm" variant="ghost" className="btn-danger" icon="trash" onClick={toggleDelete}>{f.deleted ? "Restore file" : "Delete file"}</Button>
              </div>}
              <div className="gh-monaco">
                {!f ? <Empty icon="file" title="Open a file">Pick a file on the left to view or edit it. Changes stay here until you commit &amp; push.</Empty>
                  : f.loading ? <div className="center"><span className="spinner" /></div>
                  : md ? <iframe className="gh-md" title="Markdown preview" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={md} />
                  : f.kind === "image" ? <div className="center"><img className="gh-img" src={f.data} alt={active} /></div>
                  : f.kind !== "text" ? <Empty icon="file" title={f.kind === "large" ? "This file is too large to edit here" : "This is a binary file"} action={f.html_url && <a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href={f.html_url}>Open on GitHub</a>} />
                  : view === "diff" ? <DiffEditor key={"d" + active} original={f.orig} modified={f.value} language={langOf(active)} theme={dark ? "vs-dark" : "vs"} options={{ readOnly: true, renderSideBySide: innerWidth > 900, automaticLayout: true, minimap: { enabled: false } }} />
                  : <Editor key={active} path={active} defaultLanguage={langOf(active)} value={f.value} theme={dark ? "vs-dark" : "vs"}
                      onChange={val => setFiles(x => ({ ...x, [active]: { ...x[active], value: val ?? "" } }))}
                      options={{ readOnly: !!f.deleted, fontSize: 13.5, minimap: { enabled: innerWidth > 1200 }, scrollBeyondLastLine: false, tabSize: 2, wordWrap: "on", automaticLayout: true, smoothScrolling: true, cursorSmoothCaretAnimation: "on" }} />}
              </div>
            </div>
            <aside className="card gh-commit">
              <h3 className="sec-h"><Icon name="upload" />Commit &amp; push</h3>
              <div className="gh-changes">
                <AnimatePresence initial={false}>{dirty.length ? dirty.map(([p, x]) => (
                  <motion.button key={p} layout className="gh-ch" onClick={() => setActive(p)} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    <i className={`st ${x.deleted ? "del" : x.isNew ? "new" : "mod"}`}>{x.deleted ? "D" : x.isNew ? "A" : "M"}</i><span>{p}</span></motion.button>))
                  : <p className="help">No changes yet. Edit a file and it appears here.</p>}</AnimatePresence>
              </div>
              <form onSubmit={commit} noValidate>
                <Field label="Commit message"><textarea className="textarea" rows={3} style={{ minHeight: 70 }} placeholder="Describe what you changed" value={msg} onChange={e => setMsg(e.target.value)} /></Field>
                <FormError>{formError}</FormError>
                <Button type="submit" variant="primary" icon="upload" disabled={!dirty.length} busy={busy === "commit"} busyLabel="Pushing…" style={{ width: "100%", marginTop: 10 }}>Commit &amp; push</Button>
                {dirty.length > 0 && <Button variant="ghost" size="sm" style={{ width: "100%", marginTop: 6 }} onClick={discardAll}>Discard all changes</Button>}
              </form>
            </aside>
          </motion.div>
        ) : tab === "pulls" ? <motion.div key="pulls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Pulls base={base} repo={repo} branch={branch} /></motion.div>
          : <motion.div key="hist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><History base={base} branch={branch} /></motion.div>}
      </AnimatePresence>
    </div>
  );
}

export function Tree({ items, files, active, collapsed, setCollapsed, onOpen }) {
  const nodes = {};
  items.forEach(n => { nodes[n.path] = n; });
  Object.entries(files).forEach(([p, f]) => { if (f.isNew && !nodes[p]) nodes[p] = { path: p, type: "file" }; });
  const kids = {};
  Object.values(nodes).forEach(n => {
    let parent = n.path.includes("/") ? n.path.slice(0, n.path.lastIndexOf("/")) : "";
    (kids[parent] ||= []).push(n);
    while (parent && !nodes[parent]) { nodes[parent] = { path: parent, type: "dir" }; const pp = parent.includes("/") ? parent.slice(0, parent.lastIndexOf("/")) : ""; (kids[pp] ||= []).push(nodes[parent]); parent = pp; }
  });
  const sort = a => a.sort((x, y) => x.type === y.type ? x.path.localeCompare(y.path) : x.type === "dir" ? -1 : 1);
  const render = (dir, depth) => sort(kids[dir] || []).flatMap(n => {
    const name = n.path.split("/").pop(), f = files[n.path];
    if (n.type === "dir") {
      const open = depth === 0 ? !collapsed.has(n.path) : collapsed.has("+" + n.path);
      const toggle = () => setCollapsed(s => { const x = new Set(s); depth === 0 ? (x.has(n.path) ? x.delete(n.path) : x.add(n.path)) : (x.has("+" + n.path) ? x.delete("+" + n.path) : x.add("+" + n.path)); return x; });
      return [<button key={n.path} className="gh-node dir" style={{ "--d": depth }} onClick={toggle}><Icon name="folder" /><span>{name}</span><motion.i className="caret" animate={{ rotate: open ? 90 : 0 }} /></button>, ...(open ? render(n.path, depth + 1) : [])];
    }
    const state = f?.deleted ? "del" : f?.isNew ? "new" : f && f.kind === "text" && f.value !== f.orig ? "mod" : "";
    return [<button key={n.path} className={`gh-node file ${active === n.path ? "on" : ""} ${state}`} style={{ "--d": depth }} onClick={() => onOpen(n.path)}>
      <FileIcon name={name} /><span>{name}</span>{state && <i className="st">{{ mod: "M", new: "A", del: "D" }[state]}</i>}</button>];
  });
  const out = render("", 0);
  return out.length ? out : <div className="help" style={{ padding: 12 }}>No files yet. Add one with +.</div>;
}
