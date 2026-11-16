
export function Spark({ series, total }) {
  const max = Math.max(1, ...series.map(p => p.views));
  const pts = series.map((p, i) => `${(i / (series.length - 1)) * 100},${30 - (p.views / max) * 26}`).join(" ");
  return (
    <div className="wb-spark" title="Visits in the last 30 days">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points={`0,32 ${pts} 100,32`} className="fill" /><polyline points={pts} className="line" /></svg>
      <div><b>{total}</b><span>visits · 30 days</span></div>
    </div>
  );
}

/* ---------------------------------------------------------------- live preview */
