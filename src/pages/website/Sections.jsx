import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import { useRef, useState } from "react";
import { upload } from "../../lib/api";
import { Button, Field, Icon, Seg, Switch, fail, toast } from "../../ui/kit";
import { clone } from "./shared";

export const VARIANT_LABELS = { split: "Photo beside", center: "Centred", minimal: "Minimal", text: "Text only", image: "With image", chips: "Chips", columns: "List", bars: "Bars",
  grid: "Grid", list: "Rows", timeline: "Timeline", cards: "Cards", row: "Row", quote: "Big quote", banner: "Banner", plain: "Plain", card: "Card" };

export const uid = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");

export function Sections({ draft, meta, edit, open, setOpen }) {
  const [adding, setAdding] = useState(false);
  const list = draft.sections;
  const add = type => {
    const t = meta.types[type];
    const data = {};
    t.fields.forEach(f => { data[f.k] = f.type === "list" ? [] : f.type === "switch" ? true : f.type === "select" ? f.options[0] : ""; });
    if (t.fields.some(f => f.k === "heading")) data.heading = t.label.split(" /")[0];
    const sec = { id: uid(), type, on: true, nav: t.nav, variant: t.variants[0], data };
    edit(d => { const at = d.sections.findIndex(x => x.type === "contact"); at >= 0 && type !== "contact" ? d.sections.splice(at, 0, sec) : d.sections.push(sec); });
    setAdding(false); setTimeout(() => setOpen(sec.id), 450);
  };
  return <>
    <p className="help wb-tip"><Icon name="menu" /> Drag to reorder. Click a section to edit it.</p>
    <Reorder.Group axis="y" values={list} onReorder={next => edit(d => { d.sections = next.map(n => d.sections.find(x => x.id === n.id)); })} className="wb-secs">
      {list.map(sec => <SectionRow key={sec.id} sec={sec} meta={meta} edit={edit} open={open === sec.id} toggle={() => setOpen(open === sec.id ? null : sec.id)} />)}
    </Reorder.Group>
    <AnimatePresence>
      {adding ? (
        <motion.div className="wb-lib" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <div className="wb-lib-head"><b>Add a section</b><Button size="sm" variant="ghost" icon="x" aria-label="Close" onClick={() => setAdding(false)} /></div>
          <div className="wb-lib-grid">
            {Object.entries(meta.types).map(([k, t]) => (
              <button key={k} type="button" onClick={() => add(k)} disabled={k === "hero" && list.some(x => x.type === "hero")}>
                <Icon name={t.icon} /><span>{t.label}</span></button>))}
          </div>
        </motion.div>
      ) : <Button className="wb-add" icon="plus" onClick={() => setAdding(true)}>Add section</Button>}
    </AnimatePresence>
  </>;
}

export function SectionRow({ sec, meta, edit, open, toggle }) {
  const drag = useDragControls();
  const t = meta.types[sec.type];
  const set = fn => edit(d => fn(d.sections.find(x => x.id === sec.id)));
  const title = sec.data.heading || sec.data.title || t.label;
  return (
    <Reorder.Item value={sec} dragListener={false} dragControls={drag} className={`wb-sec ${open ? "open" : ""} ${sec.on ? "" : "off"}`} layout="position">
      <div className="wb-sec-head">
        <button className="pf-grip" onPointerDown={e => drag.start(e)} aria-label="Drag to reorder"><Icon name="menu" /></button>
        <button className="wb-sec-title" onClick={toggle}>
          <span className="wb-sec-ic"><Icon name={t.icon} /></span>
          <span className="grow"><b>{title}</b><small>{t.label}{sec.nav ? ` · in menu as “${sec.nav}”` : ""}</small></span>
          <Icon name="chevron-down" className="wb-caret" />
        </button>
        <Switch checked={sec.on} onChange={on => set(x => { x.on = on; })} title={sec.on ? "Shown: click to hide" : "Hidden: click to show"} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="wb-sec-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22 }}>
            <div className="wb-sec-pad">
              {t.variants.length > 1 && <Field label="Layout"><Seg size="sm" value={sec.variant} onChange={v => set(x => { x.variant = v; })} options={t.variants.map(v => [v, VARIANT_LABELS[v] || v])} /></Field>}
              {sec.type !== "hero" && <Field label="Menu label" opt="(blank = not in menu)"><input className="input" value={sec.nav} maxLength={24} onChange={e => set(x => { x.nav = e.target.value; })} /></Field>}
              {t.fields.map(f => <FieldEditor key={f.k} f={f} value={sec.data[f.k]} onChange={v => set(x => { x.data[f.k] = v; })} />)}
              <div className="wb-sec-acts">
                <Button size="sm" variant="ghost" icon="copy" disabled={sec.type === "hero"} onClick={() => edit(d => { const i = d.sections.findIndex(x => x.id === sec.id); d.sections.splice(i + 1, 0, { ...clone(sec), id: uid() }); })}>Duplicate</Button>
                <span className="grow" />
                <Button size="sm" variant="ghost" className="btn-danger" icon="trash" onClick={() => { edit(d => { d.sections = d.sections.filter(x => x.id !== sec.id); }); toast("Section removed. Undo with ⌘Z."); }}>Remove</Button>
              </div>
            </div>
          </motion.div>)}
      </AnimatePresence>
    </Reorder.Item>
  );
}

export function FieldEditor({ f, value, onChange }) {
  if (f.type === "note") return <p className="help wb-note"><Icon name="info" />{f.text}</p>;
  if (f.type === "switch") return <div className="wb-switch"><Switch checked={!!value} onChange={onChange}>{f.label}</Switch></div>;
  if (f.type === "image") return <ImageField label={f.label} value={value || ""} onChange={onChange} />;
  if (f.type === "list") return <ListField f={f} value={value || []} onChange={onChange} />;
  return (
    <Field label={f.label} hint={f.hint}>
      {f.type === "textarea" ? <textarea className="textarea" rows={f.rows || 3} value={value || ""} placeholder={f.ph} onChange={e => onChange(e.target.value)} />
        : f.type === "select" ? <select className="select" value={value || f.options[0]} onChange={e => onChange(e.target.value)}>{f.options.map(o => <option key={o}>{o}</option>)}</select>
          : <input className="input" value={value || ""} placeholder={f.ph || (f.type === "link" ? "https://… or #contact" : "")} onChange={e => onChange(e.target.value)} />}
    </Field>
  );
}

export function ListField({ f, value, onChange }) {
  const [openI, setOpenI] = useState(value.length ? null : -1);
  const upd = (i, k, v) => onChange(value.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const move = (i, dir) => { const n = [...value]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; onChange(n); setOpenI(i + dir); };
  return (
    <div className="wb-list">
      <label className="label">{f.label}</label>
      {value.map((row, i) => {
        const title = row[f.fields[0].k] || row[f.fields[1]?.k] || `Item ${i + 1}`;
        return (
          <div key={i} className={`wb-li ${openI === i ? "open" : ""}`}>
            <div className="wb-li-head">
              <button type="button" className="grow" onClick={() => setOpenI(openI === i ? null : i)}><b>{title}</b></button>
              <Button size="sm" variant="ghost" icon="arrow-up" aria-label="Move up" disabled={!i} onClick={() => move(i, -1)} />
              <Button size="sm" variant="ghost" icon="arrow-down" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)} />
              <Button size="sm" variant="ghost" className="btn-danger" icon="trash" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))} />
            </div>
            {openI === i && <div className="wb-li-body">{f.fields.map(sf => <FieldEditor key={sf.k} f={sf} value={row[sf.k]} onChange={v => upd(i, sf.k, v)} />)}</div>}
          </div>
        );
      })}
      <Button size="sm" icon="plus" onClick={() => { onChange([...value, Object.fromEntries(f.fields.map(sf => [sf.k, ""]))]); setOpenI(value.length); }}>{f.add || "Add"}</Button>
    </div>
  );
}

export function ImageField({ label, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const input = useRef();
  const pick = async e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast("Images can be up to 3 MB.", true);
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    try { const r = await upload("/api/site/images", fd); onChange(r.url); toast("Image uploaded"); } catch (er) { fail(er); }
    setBusy(false);
  };
  return (
    <Field label={label}>
      <div className="wb-img">
        <div className="wb-img-thumb">{value ? <img src={value} alt="" /> : <Icon name="image" />}</div>
        <div className="grow stack-xs">
          <input className="input" value={value} placeholder="Paste an image link or upload" onChange={e => onChange(e.target.value)} />
          <div className="row-xs">
            <Button size="sm" icon="upload" busy={busy} busyLabel="Uploading…" onClick={() => input.current.click()}>Upload</Button>
            {value && <Button size="sm" variant="ghost" onClick={() => onChange("")}>Remove</Button>}
          </div>
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
      </div>
    </Field>
  );
}

/* ---------------------------------------------------------------- design */
