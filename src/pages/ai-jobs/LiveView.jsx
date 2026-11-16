import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export function LiveView({ active }) {
  const [v, setV] = useState(null);
  useEffect(() => {
    let stop = false, t;
    const tick = async () => {
      try { const r = await api("/api/ai-jobs/live"); if (!stop) setV(r.active ? r : null); } catch { /* keep the last frame */ }
      if (!stop) t = setTimeout(tick, active ? 900 : 4000);
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [active]);
  if (!v?.active && !active) return null;
  if (!v?.job) return null;
  return (
    <div className="card ai-live">
      <div className="ai-live-head"><span className="ai-live-dot" />Live: {v.job}</div>
      <div className="ai-live-body">
        <div className="ai-live-screen">{v.frame ? <img src={v.frame} alt="What the application browser shows right now" /> : <div className="help">Starting the browser…</div>}</div>
        <ol className="ai-live-log">{v.log.map((l, i) => <li key={i} className={i === v.log.length - 1 ? "now" : ""}>{l}</li>)}</ol>
      </div>
    </div>
  );
}
