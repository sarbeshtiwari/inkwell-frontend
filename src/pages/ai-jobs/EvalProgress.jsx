import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon } from "../../ui/kit";
import { Robot, agentName } from "../agents/crew";

// "Evaluate top 10" live panel: Priya writes a report per job; a report card fills in its five scores, the lines
// say which check is running, and each job's chip ticks off as its report is saved. Uses the .mp-* / .fp-* styles.
const LINES = ["Reading the job description", "Matching each requirement to your resume", "Checking the posting is real and still open",
  "Looking at pay and seniority", "Scoring the five dimensions", "Writing interview prep"];

export function EvalProgress({ ev }) {
  const [line, setLine] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setLine(0); const t = setInterval(() => setLine(n => n + 1), 2200); return () => clearInterval(t); }, [ev.done]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = ev.began ? Math.max(0, Math.round(now / 1000 - ev.began)) : null;
  const queue = ev.queue || [];
  const current = ev.current || queue[ev.done] || "";
  return (
    <motion.div className="card mp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      <div className="mp-stage">
        <div className="mp-scene">
          <div className="ev-report" key={ev.done}>
            <div className="ev-title"><i /><b><Icon name="star" /></b></div>
            {[86, 62, 74, 48, 90].map((w, i) => <div key={i} className="ev-row"><span /><i style={{ "--w": `${w}%`, animationDelay: `${i * .35}s` }} /></div>)}
          </div>
          <span className="mp-bot"><Robot id="job_analyst" size={68} working /></span>
        </div>
      </div>
      <div className="mp-body">
        <h3>{agentName("job_analyst")} is evaluating {queue.length > 1 ? "your top jobs" : "a job"}<span className="mp-dots"><i>.</i><i>.</i><i>.</i></span></h3>
        <div className="mp-line">
          <motion.span key={`${ev.done}-${line}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
            {current ? <b>{current.split(" · ")[0]}: </b> : null}{LINES[line % LINES.length]}
          </motion.span>
        </div>
        <div className="fp-count">
          <div><motion.b key={ev.done} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>{ev.done}</motion.b><span>of {ev.total} reports</span></div>
          {secs != null && <div><b>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</b><span>so far</span></div>}
          {ev.stopping && <div><span>Stopping after this job…</span></div>}
        </div>
        <div className="progress"><motion.div animate={{ width: `${Math.max(ev.total ? (ev.done / ev.total) * 100 : 0, 3)}%` }} transition={{ duration: .5 }} /></div>
        {queue.length > 0 && <div className="fp-sites">{queue.map((n, i) => (
          <span key={`${n}-${i}`} className={i < ev.done ? "done" : i === ev.done ? "now" : ""}>
            {i < ev.done ? <Icon name="check" /> : i === ev.done ? <i className="fp-spin" /> : null}{n}</span>))}</div>}
      </div>
    </motion.div>
  );
}
