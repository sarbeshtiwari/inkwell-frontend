import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, Seg, toast } from "../../ui/kit";

export const DEVICES = { desktop: 1280, tablet: 820, mobile: 390 };

export function Preview({ draft, apiRef, url }) {
  const [device, setDevice] = useState("desktop");
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const wrap = useRef(), frame = useRef(), scrollY = useRef(0), timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/site/render", { method: "POST", headers: { "X-Requested-With": "fetch", "Content-Type": "application/json" }, body: JSON.stringify({ draft }) });
        if (r.ok) setSrc((await r.json()).url);
        else { const j = await r.json().catch(() => ({})); toast(j.error || "Preview failed", true); setLoading(false); }
      } catch { setLoading(false); }
    }, 380);
    return () => clearTimeout(timer.current);
  }, [draft]);

  useEffect(() => {
    const on = e => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "site-scroll") scrollY.current = e.data.y;
      if (e.data?.type === "site-ready") { frame.current.contentWindow.postMessage({ type: "restore", y: scrollY.current }, "*"); setLoading(false); }
    };
    addEventListener("message", on); return () => removeEventListener("message", on);
  }, []);
  useEffect(() => { apiRef.current.scrollTo = id => frame.current?.contentWindow?.postMessage({ type: "scrollTo", id }, "*"); }, [apiRef]);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(wrap.current); return () => ro.disconnect();
  }, []);
  const dw = DEVICES[device];
  const scale = Math.min(1, (box.w - (device === "desktop" ? 0 : 32)) / dw);

  return (
    <section className="card wb-preview">
      <div className="lp-bar">
        <span className="dots"><i /><i /><i /></span>
        <span className="lp-url">{url ? url.replace(/^https?:\/\//, "") : "Preview"}</span>
        {loading && <span className="spinner sm" />}
        <Seg size="sm" value={device} onChange={setDevice} options={[["desktop", "", "monitor"], ["tablet", "", "tablet"], ["mobile", "", "phone"]]} name="Device" />
        {url && <a className="btn btn-sm btn-ghost btn-icon" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open live site" title="Open live site"><Icon name="external" /></a>}
      </div>
      <div className={`wb-stage ${device}`} ref={wrap}>
        <div className="wb-device" style={{ width: dw * scale, height: device === "desktop" ? "100%" : Math.min(box.h - 32, 860 * scale) }}>
          <iframe ref={frame} title="Website preview" src={src || undefined} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            style={{ width: dw, height: `${100 / scale}%`, transform: `scale(${scale})` }} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- sections */
