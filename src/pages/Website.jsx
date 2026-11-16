import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Button, Empty, Seg, SkBlock, fail, modal, toast } from "../ui/kit";
import { Design } from "./website/Design";
import { Details } from "./website/Details";
import { Preview } from "./website/Preview";
import { Sections } from "./website/Sections";
import { Spark } from "./website/Spark";
import { clone } from "./website/shared";


export default function Website({ slug, onSlug }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [draft, setDraftRaw] = useState(null);
  const [tab, setTab] = useState("sections");
  const [open, setOpen] = useState(null);
  const [save, setSave] = useState("saved");
  const [busy, setBusy] = useState("");
  const hist = useRef({ past: [], future: [] });
  const saveTimer = useRef();
  const frameApi = useRef({});

  useEffect(() => { api("/api/site").then(r => { setS(r); setDraftRaw(r.draft); }).catch(e => setErr(e.message)); }, []);

  const persist = useCallback(next => {
    setSave("pending");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSave("saving");
      try { const r = await api("/api/site", { method: "PUT", json: { draft: next } }); setS(x => ({ ...x, dirty: r.dirty })); setSave("saved"); }
      catch (e) { setSave("error"); toast(e.message, true); }
    }, 700);
  }, []);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Every edit goes through here: keeps undo history and autosaves.
  const edit = useCallback(fn => setDraftRaw(cur => {
    const next = clone(cur); fn(next);
    hist.current.past = [...hist.current.past.slice(-60), cur]; hist.current.future = [];
    persist(next);
    return next;
  }), [persist]);
  const undo = () => { const h = hist.current; if (!h.past.length) return; const prev = h.past.pop(); h.future.push(draft); setDraftRaw(prev); persist(prev); };
  const redo = () => { const h = hist.current; if (!h.future.length) return; const nx = h.future.pop(); h.past.push(draft); setDraftRaw(nx); persist(nx); };
  useEffect(() => {
    const k = e => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      e.preventDefault(); e.shiftKey ? redo() : undo();
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  if (err) return <div className="card"><Empty icon="alert" title="Couldn't load your website">{err}</Empty></div>;
  if (!s || !draft) return <div className="wb"><SkBlock h={620} /><SkBlock h={620} /></div>;
  const meta = s.meta;

  const publish = async () => {
    setBusy("pub");
    try {
      if (save !== "saved") { clearTimeout(saveTimer.current); await api("/api/site", { method: "PUT", json: { draft } }); setSave("saved"); }
      const r = await api("/api/site/publish", { json: {} }); setS(x => ({ ...x, ...r })); if (r.slug && r.slug !== slug) onSlug(r.slug); toast("Your website is live 🎉");
    } catch (e) { if (e.field === "slug") setTab("details"); fail(e); }
    setBusy("");
  };
  const unpublish = async () => {
    if (!await modal({ title: "Unpublish your website?", text: "Visitors will see a “not found” page and the contact form stops taking messages. Your design and content stay here, so you can publish again any time.", confirm: "Unpublish", danger: true })) return;
    setBusy("unpub");
    try { const r = await api("/api/site/unpublish", { json: {} }); setS(x => ({ ...x, ...r })); toast("Your website is unpublished"); } catch (e) { fail(e); }
    setBusy("");
  };
  const resetAll = async () => {
    if (!await modal({ title: "Start over?", text: "Your draft is replaced with a fresh starter site. Your live site doesn't change until you publish.", confirm: "Start over", danger: true })) return;
    try { const r = await api("/api/site/reset", { json: {} }); hist.current.past.push(draft); setDraftRaw(r.draft); setS(x => ({ ...x, ...r })); toast("Fresh starter site loaded. Undo with ⌘Z."); } catch (e) { fail(e); }
  };
  const url = slug ? `${location.origin}/p/${slug}` : "";

  return (
    <div className="wb-page">
      <motion.div className="card wb-status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="wb-state">
          <span className={`wb-dot ${s.online ? "live" : ""}`} />
          <div>
            <b>{s.online ? "Live" : "Not published"}</b>
            {url ? <a className="wb-url" href={s.online ? url : undefined} target="_blank" rel="noopener noreferrer">{url.replace(/^https?:\/\//, "")}</a> : <span className="help">Pick an address in Details</span>}
          </div>
          {url && <Button size="sm" variant="ghost" icon="copy" aria-label="Copy link" title="Copy link" onClick={() => navigator.clipboard.writeText(url).then(() => toast("Link copied"))} />}
        </div>
        <Spark series={s.views.series} total={s.views.month} />
        <span className="grow" />
        <span className={`wb-save ${save}`}>{{ saved: s.dirty ? (s.published_at ? "Saved · not published" : "Saved as draft") : "All changes live", pending: "Editing…", saving: "Saving…", error: "Couldn't save" }[save]}</span>
        <Button size="sm" variant="ghost" icon="undo" aria-label="Undo" title="Undo (⌘Z)" disabled={!hist.current.past.length} onClick={undo} />
        <Button size="sm" variant="ghost" icon="redo" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!hist.current.future.length} onClick={redo} />
        {s.online && <Button variant="ghost" className="btn-danger" busy={busy === "unpub"} busyLabel="Unpublishing…" onClick={unpublish}>Unpublish</Button>}
        <Button variant="primary" icon="globe" busy={busy === "pub"} busyLabel="Publishing…" disabled={s.online && !s.dirty && save === "saved"} onClick={publish}>
          {s.published_at ? (s.dirty || save !== "saved" ? "Publish changes" : "Published") : "Publish website"}</Button>
      </motion.div>

      <div className="wb">
        <aside className="card wb-side">
          <Seg value={tab} onChange={setTab} className="wb-tabs" options={[["sections", "Sections", "layers"], ["design", "Design", "palette"], ["details", "Details", "settings"]]} />
          <div className="wb-scroll">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: .16 }}>
                {tab === "sections" && <Sections draft={draft} meta={meta} edit={edit} open={open} setOpen={id => { setOpen(id); id && frameApi.current.scrollTo?.(id); }} />}
                {tab === "design" && <Design draft={draft} meta={meta} edit={edit} />}
                {tab === "details" && <Details draft={draft} edit={edit} slug={slug} onSlug={onSlug} s={s} unpublish={unpublish} resetAll={resetAll} langs={meta.langs} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
        <Preview draft={draft} apiRef={frameApi} url={s.online ? url : ""} />
      </div>
    </div>
  );
}
