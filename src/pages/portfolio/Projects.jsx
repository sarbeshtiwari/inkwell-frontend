import { Reorder, motion, useDragControls } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { ago, splitCsv, safeHref } from "../../lib/format";
import { Badge, Button, Check, Chips, Drawer, DrawerHead, Empty, Field, FormError, Icon, Pager, Seg, SkBlock, Switch, applyError, fail, modal, toast, useDebounced, usePager } from "../../ui/kit";
import { Settings } from "./Settings";
import { SitePreview } from "./SitePreview";

export function Projects() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState("manage");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api("/api/portfolio").then(setD).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (err) return <div className="card"><Empty icon="alert" title="Couldn't load your portfolio">{err}</Empty></div>;
  if (!d) return <SkBlock h={360} />;
  if (!d.github) return <div className="card"><Empty icon="github" title="Connect GitHub first" action={<a className="btn btn-primary" href="/app/github">Connect GitHub</a>}>Your portfolio is built from your GitHub repositories.</Empty></div>;

  const items = d.items;
  const shown = items.filter(i => !i.hidden);
  const setItems = next => setD(x => ({ ...x, items: next }));
  const saveOrder = async next => { try { await api("/api/portfolio/order", { method: "PUT", json: { order: next.map(i => i.repo) } }); } catch (e) { fail(e); } };
  const patch = async (repo, changes) => {
    try { const r = await api(`/api/portfolio/items/${repo}`, { method: "PUT", json: changes }); setItems(items.map(i => i.repo === repo ? r.item : i)); return r.item; }
    catch (e) { fail(e); throw e; }
  };
  const remove = async it => {
    if (!await modal({ title: `Remove ${it.title}?`, text: "It stays on GitHub; it just won't be listed on your website.", confirm: "Remove", danger: true })) return;
    try { const r = await api(`/api/portfolio/items/${it.repo}`, { method: "DELETE" }); setItems(r.items); toast("Removed from portfolio"); } catch (e) { fail(e); }
  };
  const publish = async () => {
    if (!d.target.owner || !d.target.repo) { setSettings(true); return toast("Choose the repository your website is built from first.", true); }
    if (!await modal({ title: "Publish to your website?", text: `Commits ${d.target.path} with ${shown.length} project${shown.length === 1 ? "" : "s"} to ${d.target.owner}/${d.target.repo}. Your host redeploys the site automatically.`, confirm: "Publish" })) return;
    setBusy("pub");
    try { const r = await api("/api/portfolio/publish", { json: {} }); setD(x => ({ ...x, published: r })); toast("Published. Your site is redeploying."); } catch (e) { fail(e); }
    setBusy("");
  };

  return (
    <div className="pf">
      <motion.div className="card pf-head" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="pf-stat"><b>{shown.length}</b><span>on your site</span></div>
        <div className="pf-stat"><b>{shown.filter(i => i.live_url).length}</b><span>with a live link</span></div>
        <div className="pf-stat"><b>{shown.filter(i => i.featured).length}</b><span>featured</span></div>
        <div className="grow pf-pub">
          {d.published ? <><Badge tone="ok">Published {ago(d.published.at)}</Badge><span className="help">{d.published.count} projects → {d.target.owner}/{d.target.repo}{d.published.url && <> · <a href={d.published.url} target="_blank" rel="noopener noreferrer">commit</a></>}</span></>
            : <span className="help">Not published yet</span>}
        </div>
        <Button icon="settings" onClick={() => setSettings(true)}>Git &amp; feed settings</Button>
        <Button variant="primary" icon="upload" busy={busy === "pub"} busyLabel="Publishing…" disabled={!shown.length} onClick={publish}>Publish to a Git site</Button>
      </motion.div>

      <div className="toolbar">
        <Seg value={view} onChange={setView} options={[["manage", "Manage", "columns"], ["preview", "Card preview", "eye"]]} />
        <span className="grow" />
        {d.public && d.slug && <a className="btn btn-sm btn-ghost" href={`/p/${d.slug}`} target="_blank" rel="noopener noreferrer"><Icon name="external" />Public page</a>}
        <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add projects</Button>
      </div>

      {!items.length ? (
        <div className="card"><Empty icon="star" title="No projects yet" action={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Pick projects from GitHub</Button>}>
          Choose which of your repositories to show on your website. Inkwell finds each one's live link and makes a preview.</Empty></div>
      ) : view === "manage" ? (
        <>
          <p className="help pf-tip"><Icon name="menu" /> Drag to set the order they appear on your site.</p>
          <Reorder.Group axis="y" values={items} onReorder={setItems} className="pf-list">
            {items.map(it => <Row key={it.repo} it={it} onDrop={() => saveOrder(items)} onEdit={() => setEditing(it.repo)} onRemove={() => remove(it)} onPatch={patch} />)}
          </Reorder.Group>
        </>
      ) : <SitePreview items={shown} headline={d.headline} about={d.about} />}

      <Drawer open={adding} onClose={() => setAdding(false)} wide label="Add projects">
        {adding && <AddProjects login={d.login} have={new Set(items.map(i => i.repo))} onDone={next => { setAdding(false); if (next) setItems(next); }} />}
      </Drawer>
      <Drawer open={!!editing} onClose={() => setEditing(null)} wide label="Edit project">
        {editing && <EditProject it={items.find(i => i.repo === editing)} onSaved={x => setItems(items.map(i => i.repo === x.repo ? x : i))} onClose={() => setEditing(null)} />}
      </Drawer>
      <Drawer open={settings} onClose={() => setSettings(false)} label="Website settings">
        {settings && <Settings d={d} onSaved={x => setD(y => ({ ...y, ...x }))} onClose={() => setSettings(false)} />}
      </Drawer>
    </div>
  );
}

export function Row({ it, onDrop, onEdit, onRemove, onPatch }) {
  const drag = useDragControls();
  return (
    <Reorder.Item value={it} dragListener={false} dragControls={drag} onDragEnd={onDrop} className={`card pf-row ${it.hidden ? "hidden" : ""}`}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} whileDrag={{ scale: 1.02, boxShadow: "0 18px 40px -20px rgba(23,25,28,.35)" }}>
      <button className="pf-grip" onPointerDown={e => drag.start(e)} aria-label="Drag to reorder"><Icon name="menu" /></button>
      <button className="pf-thumb" onClick={onEdit}><img src={it.image} alt="" loading="lazy" /></button>
      <div className="pf-info">
        <div className="pf-title"><b>{it.title}</b>{it.featured && <Badge tone="violet" dot={false}><Icon name="star" />Featured</Badge>}{it.private && <Badge dot={false}>Private repo</Badge>}{it.hidden && <Badge tone="warn" dot={false}>Hidden</Badge>}</div>
        <p className="help">{it.description || "No description. Add one so visitors know what it is."}</p>
        <div className="pf-meta">
          {it.live_url ? <a className="pf-live" href={safeHref(it.live_url)} target="_blank" rel="noopener noreferrer" title={it.live_source}><i />{it.live_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
            : <span className="pf-nolive"><Icon name="alert" />No live link</span>}
          {(it.tags || []).slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      </div>
      <div className="pf-acts">
        <Button size="sm" variant="ghost" icon="star" className={it.featured ? "on" : ""} title={it.featured ? "Unfeature" : "Feature (shown larger)"} aria-label="Feature" onClick={() => onPatch(it.repo, { featured: !it.featured })} />
        <Button size="sm" variant="ghost" icon={it.hidden ? "eye" : "x"} title={it.hidden ? "Show on site" : "Hide from site"} aria-label="Toggle visibility" onClick={() => onPatch(it.repo, { hidden: !it.hidden })} />
        <Button size="sm" icon="note" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" className="btn-danger" icon="trash" aria-label="Remove" onClick={onRemove} />
      </div>
    </Reorder.Item>
  );
}

export const OWN = [["mine", "Created by me", r => r.mine && !r.fork], ["forks", "Forked", r => r.mine && r.fork], ["other", "Contributed / org", r => !r.mine], ["all", "All", () => true]];

export function AddProjects({ login, have, onDone }) {
  const [repos, setRepos] = useState(null);
  const [own, setOwn] = useState("mine");
  const [q, setQ] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const dq = useDebounced(q);
  useEffect(() => { api("/api/gh/repos").then(r => setRepos(r.repos.map(x => ({ ...x, mine: x.owner.toLowerCase() === login.toLowerCase() })))).catch(fail); }, [login]);
  const rows = useMemo(() => (repos || []).filter(OWN.find(o => o[0] === own)[2]).filter(r => !r.archived && (!liveOnly || r.homepage || r.has_pages)
    && (!dq || [r.full_name, r.description, r.language].some(v => (v || "").toLowerCase().includes(dq.toLowerCase())))), [repos, own, liveOnly, dq]);
  const pg = usePager(rows, [own, liveOnly, dq].join("|"), 20);
  const toggle = full => setPicked(s => { const n = new Set(s); n.has(full) ? n.delete(full) : n.add(full); return n; });
  const add = async () => {
    setBusy(true);
    try { const r = await api("/api/portfolio/items", { json: { repos: [...picked] } }); toast(`Added ${r.added} project${r.added === 1 ? "" : "s"}. Live links were looked up on GitHub.`); onDone(r.items); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  return <>
    <DrawerHead logo={<span className="co-logo lg grad"><Icon name="github" /></span>} title="Add projects" sub="Tick the repositories to show on your website." onClose={() => onDone(null)} />
    <div className="dr-pad">
      <Chips value={own} onChange={setOwn} options={OWN.map(([k, l, fn]) => [k, l, repos ? repos.filter(fn).filter(r => !r.archived).length : undefined])} />
      <div className="gh-filter-row" style={{ marginTop: 12 }}>
        <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Search repositories…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <Check checked={liveOnly} onChange={setLiveOnly}>Only ones with a website</Check>
      </div>
      <div className="pick-list">
        {!repos && <SkBlock h={240} />}
        {pg.items.map(r => {
          const inPf = have.has(r.full_name), on = picked.has(r.full_name);
          return (
            <button key={r.full_name} className={`pick-row ${on ? "on" : ""}`} disabled={inPf} onClick={() => toggle(r.full_name)}>
              <span className={`check-box ${on || inPf ? "on" : ""}`}>{(on || inPf) && <Icon name="check" />}</span>
              <div className="grow"><b>{r.mine ? r.name : r.full_name}</b><span className="help">{r.description || "No description"}</span></div>
              {(r.homepage || r.has_pages) && <Badge tone="ok" dot={false}><Icon name="link" />Live</Badge>}
              {r.private && <Badge dot={false}>Private</Badge>}
              {inPf && <Badge tone="brand" dot={false}>Added</Badge>}
              <span className="help nowrap">{r.language}</span>
            </button>
          );
        })}
        {repos && !rows.length && <Empty icon="search" title="No repositories match" />}
      </div>
      <Pager p={pg} label="repositories" sizes={[20, 50]} />
      <div className="form-actions sticky-actions"><span className="help">{picked.size} selected</span><span className="grow" /><Button onClick={() => onDone(null)}>Cancel</Button>
        <Button variant="primary" icon="plus" disabled={!picked.size} busy={busy} busyLabel="Looking up live links…" onClick={add}>Add {picked.size || ""} to portfolio</Button></div>
    </div>
  </>;
}

export function LivePreview({ url: rawUrl }) {
  const url = safeHref(rawUrl);
  const [mode, setMode] = useState("site");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [url, mode]);
  if (!url) return <div className="lp empty"><Icon name="link" /><span>Add a live link to see a preview.</span></div>;
  const shot = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=800`;
  return (
    <div className="lp">
      <div className="lp-bar"><span className="dots"><i /><i /><i /></span><span className="lp-url">{url.replace(/^https?:\/\//, "")}</span>
        <Seg size="sm" value={mode} onChange={setMode} options={[["site", "Live"], ["shot", "Screenshot"]]} />
        <a className="btn btn-sm btn-ghost btn-icon" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open"><Icon name="external" /></a></div>
      <div className="lp-frame">
        {!loaded && <div className="lp-loading"><span className="spinner" /></div>}
        {mode === "site"
          ? <iframe key={url} src={url} title="Live preview" sandbox="allow-scripts allow-forms allow-popups" loading="lazy" onLoad={() => setLoaded(true)} />
          : <img key={url} src={shot} alt="Screenshot of the live site" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />}
      </div>
      {mode === "site" && <p className="help" style={{ padding: "8px 12px" }}>Some sites refuse to be shown inside another page. If it stays blank, switch to Screenshot.</p>}
    </div>
  );
}

export function EditProject({ it, onSaved, onClose }) {
  const [v, setV] = useState({ title: it.title, description: it.description, tags: (it.tags || []).join(", "), live_url: it.live_url, image: it.image, repo_url: it.repo_url, featured: it.featured, hidden: it.hidden });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");
  const [source, setSource] = useState(it.live_source);
  const set = k => e => { setV(x => ({ ...x, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: "" })); };
  const [owner, repo] = it.repo.split("/");
  const save = async e => {
    e.preventDefault(); setErrors({}); setFormError("");
    if (!v.title.trim()) return setErrors({ title: "Give it a title." });
    setBusy("save");
    try {
      const r = await api(`/api/portfolio/items/${it.repo}`, { method: "PUT", json: { ...v, tags: splitCsv(v.tags) } });
      onSaved(r.item); toast("Saved"); onClose();
    } catch (er) { applyError(er, setErrors, setFormError); }
    setBusy("");
  };
  const detect = async () => {
    setBusy("detect");
    try { const r = await api(`/api/portfolio/items/${it.repo}/detect`, { json: {} }); if (r.found) { setV(x => ({ ...x, live_url: r.item.live_url })); setSource(r.item.live_source); toast("Live link found"); } else toast("No live link found on GitHub for this repo.", true); }
    catch (er) { fail(er); }
    setBusy("");
  };
  return <>
    <DrawerHead logo={<span className="co-logo lg grad"><Icon name="star" /></span>} title={it.title} sub={it.repo} onClose={onClose} />
    <form className="dr-pad" onSubmit={save} noValidate>
      <LivePreview url={v.live_url} />
      <Field label="Live link" error={errors.live_url} style={{ marginTop: 16 }} hint={source ? `Found from: ${source}` : "Where the project runs, e.g. https://my-app.vercel.app"}>
        <input className="input" value={v.live_url} placeholder="https://…" onChange={e => { set("live_url")(e); setSource(""); }} />
      </Field>
      <div className="form-actions" style={{ marginTop: 8 }}><Button size="sm" icon="refresh" busy={busy === "detect"} busyLabel="Looking on GitHub…" onClick={detect}>Find on GitHub</Button></div>
      <div className="row-2" style={{ marginTop: 14 }}>
        <Field label="Title" error={errors.title}><input className="input" value={v.title} maxLength={80} onChange={set("title")} /></Field>
        <Field label="Tags" opt="(comma separated)"><input className="input" value={v.tags} placeholder="React, Node.js, MongoDB" onChange={set("tags")} /></Field>
      </div>
      <Field label="Description" style={{ marginTop: 12 }}><textarea className="textarea" rows={3} maxLength={500} value={v.description} placeholder="One or two lines: what it does and what you built." onChange={set("description")} /></Field>
      <Field label="Cover image" error={errors.image} style={{ marginTop: 12 }} hint="Defaults to the GitHub preview card for the repo.">
        <input className="input" value={v.image} onChange={set("image")} /></Field>
      <div className="img-picks">
        {[["GitHub card", `https://opengraph.githubassets.com/1/${owner}/${repo}`], ...(v.live_url ? [["Site screenshot", `https://api.microlink.io/?url=${encodeURIComponent(v.live_url)}&screenshot=true&meta=false&embed=screenshot.url`]] : [])].map(([l, u]) => (
          <button type="button" key={l} className={`img-pick ${v.image === u ? "on" : ""}`} onClick={() => setV(x => ({ ...x, image: u }))}><img src={u} alt="" loading="lazy" /><span>{l}</span></button>))}
      </div>
      <Field label="Code link" opt="(optional)" error={errors.repo_url} style={{ marginTop: 12 }} hint={it.private ? "The repo is private, so this is empty unless you add a link." : ""}><input className="input" value={v.repo_url} onChange={set("repo_url")} /></Field>
      <div className="stack-sm"><Switch checked={v.featured} onChange={x => setV(y => ({ ...y, featured: x }))}>Featured (shown larger at the top)</Switch>
        <Switch checked={!v.hidden} onChange={x => setV(y => ({ ...y, hidden: !x }))}>Show on my website</Switch></div>
      <FormError>{formError}</FormError>
      <div className="form-actions sticky-actions"><Button onClick={onClose}>Cancel</Button><span className="grow" /><Button type="submit" variant="primary" busy={busy === "save"} busyLabel="Saving…">Save</Button></div>
    </form>
  </>;
}
