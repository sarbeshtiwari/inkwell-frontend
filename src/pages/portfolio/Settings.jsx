import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Button, DrawerHead, Field, Icon, Switch, applyError, toast } from "../../ui/kit";

export function Settings({ d, onSaved, onClose }) {
  const [repos, setRepos] = useState(null);
  const [v, setV] = useState({ headline: d.headline, about: d.about, public: d.public, slug: d.slug, target: { ...d.target } });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/gh/repos").then(r => setRepos(r.repos.filter(x => x.owner.toLowerCase() === d.login.toLowerCase()))).catch(() => setRepos([])); }, [d.login]);
  const suggest = (repos || []).filter(r => /portfolio|\.github\.io|^[\w-]+$/.test(r.name) && (r.homepage || r.has_pages || /portfolio/i.test(r.name))).slice(0, 4);
  const save = async e => {
    e.preventDefault(); setErrors({});
    setBusy(true);
    try { const r = await api("/api/portfolio/settings", { method: "PUT", json: v }); onSaved(r); toast("Settings saved"); onClose(); }
    catch (er) { applyError(er, setErrors); }
    setBusy(false);
  };
  const t = v.target, setT = k => e => setV(x => ({ ...x, target: { ...x.target, [k]: e.target.value } }));
  const full = t.owner && t.repo ? `${t.owner}/${t.repo}` : "";
  return <>
    <DrawerHead logo={<span className="co-logo lg grad"><Icon name="settings" /></span>} title="Website settings" onClose={onClose} />
    <form className="dr-pad" onSubmit={save} noValidate>
      <h4 className="dr-sub" style={{ marginTop: 0 }}>Publish to your website repo</h4>
      <p className="help">Inkwell commits a <code>projects.json</code> file to the repo your site is built from. Vercel, Netlify or GitHub Pages then redeploys it.</p>
      <Field label="Website repository" error={errors.repo} style={{ marginTop: 12 }}>
        <select className="select" value={full} onChange={e => { const [o, r] = e.target.value.split("/"); setV(x => ({ ...x, target: { ...x.target, owner: o || "", repo: r || "" } })); }}>
          <option value="">Choose a repository…</option>
          {(repos || []).map(r => <option key={r.full_name} value={r.full_name}>{r.name}{r.homepage ? ` · ${r.homepage.replace(/^https?:\/\//, "")}` : ""}</option>)}
        </select></Field>
      {!full && suggest.length > 0 && <div className="chipset" style={{ marginTop: 8 }}><span className="help">Looks like your site:</span>{suggest.map(r => <button type="button" key={r.full_name} className="tpl-chip" onClick={() => setV(x => ({ ...x, target: { ...x.target, owner: r.owner, repo: r.name } }))}>{r.name}</button>)}</div>}
      <div className="row-2" style={{ marginTop: 12 }}>
        <Field label="File path" hint="e.g. public/projects.json or src/data/projects.json"><input className="input" value={t.path} onChange={setT("path")} /></Field>
        <Field label="Branch" opt="(blank = default)"><input className="input" value={t.branch} placeholder="main" onChange={setT("branch")} /></Field>
      </div>
      <details className="adv" style={{ marginTop: 12 }}><summary><Icon name="file" /><b>How your site reads it</b><Icon name="chevron-down" className="adv-caret" /></summary>
        <p className="help" style={{ marginTop: 10 }}>The file looks like <code>{"{ name, headline, projects: [{ title, description, tags, live_url, repo_url, image, featured }] }"}</code>. In a React/Next.js site, for example:</p>
        <pre className="pr-body" style={{ marginTop: 8 }}>{`import data from "../${t.path.replace(/^src\//, "")}";\n// or, if the file is in public/:\nconst data = await fetch("${t.path.replace(/^public/, "")}").then(r => r.json());\ndata.projects.map(p => <ProjectCard {...p} />)`}</pre>
      </details>

      <h4 className="dr-sub">Public page &amp; feed</h4>
      <Switch checked={v.public} onChange={x => setV(y => ({ ...y, public: x }))}>Make my portfolio public</Switch>
      <Field label="Address" error={errors.slug} style={{ marginTop: 12 }} hint={v.slug ? `Page: ${location.origin}/p/${v.slug} · JSON: ${location.origin}/p/${v.slug}.json` : ""}>
        <input className="input" value={v.slug} onChange={e => setV(x => ({ ...x, slug: e.target.value.toLowerCase() }))} /></Field>
      <Field label="Headline" style={{ marginTop: 12 }}><input className="input" value={v.headline} maxLength={120} placeholder="AI/ML & Full Stack Engineer" onChange={e => setV(x => ({ ...x, headline: e.target.value }))} /></Field>
      <Field label="About" opt="(optional)" style={{ marginTop: 12 }}><textarea className="textarea" rows={3} maxLength={1000} value={v.about} onChange={e => setV(x => ({ ...x, about: e.target.value }))} /></Field>
      {v.public && !location.origin.startsWith("https") && <Alert tone="warn" style={{ marginTop: 12 }}>This computer's address isn't reachable from the internet. The public page works once Inkwell is online; publishing to your repo works now.</Alert>}
      <div className="form-actions sticky-actions"><Button onClick={onClose}>Cancel</Button><span className="grow" /><Button type="submit" variant="primary" busy={busy} busyLabel="Saving…">Save settings</Button></div>
    </form>
  </>;
}
