import { useEffect, useMemo, useState } from "react";
import { Field, Seg, Switch } from "../../ui/kit";

export const CHOICE_LABELS = {
  card: ["Card style", { flat: "Flat", border: "Outlined", raised: "Shadow", glass: "Glass" }],
  button: ["Buttons", { gradient: "Gradient", solid: "Solid", outline: "Outline", pill: "Pill" }],
  background: ["Background", { plain: "Plain", glow: "Glow", grid: "Grid", dots: "Dots" }],
  spacing: ["Spacing", { compact: "Compact", normal: "Normal", airy: "Airy" }],
  width: ["Page width", { narrow: "Narrow", normal: "Normal", wide: "Wide" }],
  nav: ["Menu bar", { sticky: "Sticky", static: "Scrolls away", hidden: "Hidden" }],
  align: ["Headings", { left: "Left", center: "Centred" }],
};

export const COLOR_LABELS = [["bg", "Background"], ["surface", "Cards"], ["text", "Text"], ["muted", "Soft text"], ["accent", "Accent"], ["accent2", "Accent 2"]];

export const HEX = /^#[0-9a-f]{6}$/i;

export function Design({ draft, meta, edit }) {
  const t = draft.theme;
  const set = (k, v) => edit(d => { d.theme[k] = v; });
  const applyPreset = key => edit(d => { const { label, ...p } = meta.presets[key]; void label; Object.assign(d.theme, p, { preset: key }); });
  return <>
    <h4 className="dr-sub" style={{ marginTop: 4 }}>Theme</h4>
    <div className="wb-presets">
      {Object.entries(meta.presets).map(([k, p]) => (
        <button key={k} type="button" className={`wb-preset ${t.preset === k ? "on" : ""}`} onClick={() => applyPreset(k)} style={{ background: p.bg, color: p.text }}>
          <span className="wb-preset-art"><i style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})` }} /><em style={{ background: p.surface }} /><em style={{ background: p.surface, width: "60%" }} /></span>
          <span className="wb-preset-name" style={{ fontFamily: `'${p.font_head}', sans-serif` }}>{p.label}</span>
        </button>))}
    </div>

    <h4 className="dr-sub">Colours</h4>
    <div className="wb-colors">{COLOR_LABELS.map(([k, l]) => <ColorInput key={k} label={l} value={t[k]} onChange={v => edit(d => { d.theme[k] = v; d.theme.preset = "custom"; })} />)}</div>

    <h4 className="dr-sub">Fonts</h4>
    <div className="row-2">
      {[["font_head", "Headings"], ["font_body", "Body text"]].map(([k, l]) => (
        <Field key={k} label={l}><select className="select" value={t[k]} onChange={e => set(k, e.target.value)} style={{ fontFamily: `'${t[k]}', sans-serif` }}>
          {meta.fonts.map(f => <option key={f} value={f}>{f}</option>)}</select></Field>))}
    </div>
    <FontSample head={t.font_head} body={t.font_body} />

    <h4 className="dr-sub">Style</h4>
    <Field label={`Corner roundness · ${t.radius}px`}>
      <input type="range" className="range" min={0} max={32} value={t.radius} onChange={e => set("radius", +e.target.value)} />
    </Field>
    {Object.entries(CHOICE_LABELS).map(([k, [label, opts]]) => (
      <Field key={k} label={label} style={{ marginTop: 12 }}><Seg size="sm" value={t[k]} onChange={v => set(k, v)} options={meta.choices[k].map(v => [v, opts[v] || v])} /></Field>))}
    <div className="wb-switch" style={{ marginTop: 14 }}><Switch checked={t.animate} onChange={v => set("animate", v)}>Animate sections as visitors scroll</Switch></div>
  </>;
}

export function ColorInput({ label, value, onChange }) {
  const [txt, setTxt] = useState(value);
  useEffect(() => setTxt(value), [value]);
  const bad = !HEX.test(txt);
  return (
    <label className={`wb-color ${bad ? "bad" : ""}`}>
      <span className="wb-swatch" style={{ background: value }}><input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={label} /></span>
      <span className="grow"><small>{label}</small>
        <input className="wb-hex" value={txt} maxLength={7} spellCheck={false} onChange={e => { const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value; setTxt(v); if (HEX.test(v)) onChange(v.toLowerCase()); }}
          onBlur={() => setTxt(value)} aria-invalid={bad} /></span>
    </label>
  );
}

export function FontSample({ head, body }) {
  const href = useMemo(() => `https://fonts.googleapis.com/css2?${[...new Set([head, body])].map(f => "family=" + f.replace(/ /g, "+") + ":wght@400;700").join("&")}&display=swap`, [head, body]);
  return <>
    <link rel="stylesheet" href={href} />
    <div className="wb-fontsample"><b style={{ fontFamily: `'${head}', sans-serif` }}>The quick brown fox</b><span style={{ fontFamily: `'${body}', sans-serif` }}>Jumps over the lazy dog. 0123456789</span></div>
  </>;
}

/* ---------------------------------------------------------------- details */
