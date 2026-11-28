import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon } from "../../ui/kit";
import { Robot, agentName } from "../agents/crew";

// Auto-apply live panel: Dev fills an application form field by field, attaches the resume and sends it; each job's
// chip ticks off when its form is done. Uses the .mp-* / .fp-* styles.
const LINES = ["Opening the application page", "Filling in your name and contact details", "Attaching your resume",
  "Answering questions from My answers", "Checking every required field", "Sending the application"];

export function ApplyProgress({ ap }) {
  const [line, setLine] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setLine(0); const t = setInterval(() => setLine(n => Math.min(n + 1, LINES.length - 1)), 2600); return () => clearInterval(t); }, [ap.done]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = ap.began ? Math.max(0, Math.round(now / 1000 - ap.began)) : null;
  const queue = ap.queue || [];
  const current = ap.current || (queue[ap.done] || "").split(" · ")[0];
  return (
    <motion.div className="card mp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      <div className="mp-stage">
        <div className="mp-scene">
          <div className="apf" key={ap.done}>
            {[0, 1, 2].map(i => <div key={i} className="apf-field"><span /><i style={{ animationDelay: `${.3 + i * .55}s` }} /></div>)}
            <div className="apf-file" style={{ animationDelay: "1.9s" }}><Icon name="file" /><span /></div>
            <div className="apf-send"><Icon name="send" /></div>
          </div>
          <span className="mp-bot"><Robot id="applicant" size={68} working /></span>
        </div>
      </div>
      <div className="mp-body">
        <h3>{agentName("applicant")} is applying{ap.total > 1 ? ` to ${ap.total} jobs` : ""}<span className="mp-dots"><i>.</i><i>.</i><i>.</i></span></h3>
        <div className="mp-line">
          <motion.span key={`${ap.done}-${line}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
            {current ? <b>{current}: </b> : null}{LINES[line]}
          </motion.span>
        </div>
        <div className="fp-count">
          <div><motion.b key={ap.done} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>{ap.done}</motion.b><span>of {ap.total} applications</span></div>
          {secs != null && <div><b>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</b><span>so far</span></div>}
          {ap.visible && <div><span>Watch it in the browser window; it stops for anything only you can answer</span></div>}
          {ap.stopping && <div><span>Stopping after this form…</span></div>}
        </div>
        <div className="progress"><motion.div animate={{ width: `${Math.max(ap.total ? (ap.done / ap.total) * 100 : 0, 3)}%` }} transition={{ duration: .5 }} /></div>
        {queue.length > 0 && <div className="fp-sites">{queue.map((n, i) => (
          <span key={`${n}-${i}`} className={i < ap.done ? "done" : i === ap.done ? "now" : ""}>
            {i < ap.done ? <Icon name="check" /> : i === ap.done ? <i className="fp-spin" /> : null}{n}</span>))}</div>}
      </div>
    </motion.div>
  );
}
