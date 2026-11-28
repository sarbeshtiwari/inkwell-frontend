import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button, Icon } from "../../ui/kit";
import { Robot, agentName } from "./crew";

// The Email finder's live panel: Vikram opens each website, then picks the best address per company. Shares the
// match panel's styles (.mp-*); the scenes are its own.
const STAGES = [
  { label: "Opening websites", scene: "open",
    lines: ["Reading the careers page", "Checking the contact page", "Looking at the about page", "Skipping pages robots.txt asks us to"] },
  { label: "Picking the best address", scene: "pick",
    lines: ["Keeping only hiring addresses", "Preferring the company's own domain", "Choosing one per company"] },
];

export function FinderProgress({ d, found, onStop }) {
  const at = d.done >= d.total && d.total > 0 ? 1 : 0;
  const s = STAGES[at];
  const [line, setLine] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setLine(0); const t = setInterval(() => setLine(n => n + 1), 2400); return () => clearInterval(t); }, [at]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = d.started ? Math.max(0, Math.round(now / 1000 - d.started)) : null;
  const queue = d.queue || [];
  const doneNames = new Set((d.results || []).map(r => r.company || r.website));
  return (
    <motion.div className="card mp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      <div className="mp-stage">
        <AnimatePresence mode="wait">
          <motion.div key={s.scene} className="mp-scene" initial={{ opacity: 0, scale: .92, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: .92, x: -24 }} transition={{ duration: .35 }}>
            {s.scene === "open" ? <OpenScene /> : <PickScene />}
            <span className="mp-bot"><Robot id="email_finder" size={68} working /></span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mp-body">
        <div className="fp-head">
          <AnimatePresence mode="wait">
            <motion.h3 key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {agentName("email_finder")} is {s.label.toLowerCase()}<span className="mp-dots"><i>.</i><i>.</i><i>.</i></span>
            </motion.h3>
          </AnimatePresence>
          <Button size="sm" icon="stop" onClick={onStop}>Stop</Button>
        </div>
        <div className="mp-line">
          <AnimatePresence mode="wait">
            <motion.span key={`${at}-${line % s.lines.length}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }}>{s.lines[line % s.lines.length]}</motion.span>
          </AnimatePresence>
        </div>
        <div className="fp-count">
          <div><motion.b key={d.done} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>{d.done}</motion.b><span>of {d.total} websites</span></div>
          <div><motion.b key={found} initial={{ scale: 1.3, color: "var(--success, #16a34a)" }} animate={{ scale: 1, color: "var(--text)" }}>{found}</motion.b>
            <span>address{found === 1 ? "" : "es"} found</span></div>
          {secs != null && <div><b>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</b><span>so far</span></div>}
        </div>
        <div className="progress"><motion.div animate={{ width: `${Math.max(d.total ? (d.done / d.total) * 100 : 0, 3)}%` }} transition={{ duration: .5 }} /></div>
        {queue.length > 0 && <div className="fp-sites">{queue.slice(0, 24).map((n, i) => {
          const done = doneNames.has(n), now_ = !done && i === d.done;
          return <span key={`${n}-${i}`} className={done ? "done" : now_ ? "now" : ""}>
            {done ? <Icon name="check" /> : now_ ? <i className="fp-spin" /> : null}{n}</span>;
        })}{queue.length > 24 && <span>+{queue.length - 24} more</span>}</div>}
      </div>
    </motion.div>
  );
}

function OpenScene() {
  return (
    <div className="fp-browser">
      <div className="fp-bar"><i /><i /><i /><b /></div>
      <div className="fp-pages">{[0, 1, 2].map(i => <div key={i} className="fp-page" style={{ animationDelay: `${i * 1}s` }}>
        <i /><i /><i style={{ width: "50%" }} /></div>)}</div>
      {[0, 1, 2].map(i => <span key={i} className="fp-mail" style={{ animationDelay: `${i * 1}s` }}><Icon name="mail" /></span>)}
    </div>
  );
}

function PickScene() {
  return (
    <div className="fp-pick">
      {[0, 1, 2].map(i => <span key={i} className={`fp-env e${i}`}><Icon name="mail" /></span>)}
      <span className="fp-best"><Icon name="star" /></span>
    </div>
  );
}
