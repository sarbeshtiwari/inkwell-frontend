import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon } from "../../ui/kit";
import { Robot, agentName } from "../agents/crew";

// The live panel while a match runs: each stage has its own animated scene and the agent doing it, a track that
// fills from step to step, a rotating line about what is happening, and the time so far.
const STAGES = [
  { label: "Reading your resume", agent: "orchestrator", scene: "read",
    lines: ["Reading your resume, page by page", "Picking out your skills and tools", "Working out your years of experience", "Planning where to look"] },
  { label: "Searching", agent: "job_scout", scene: "search",
    lines: ["Checking company career sites", "Going through 55+ job boards", "Keeping only jobs in the place you asked for", "Dropping closed postings"] },
  { label: "Ranking matches", agent: "job_analyst", scene: "rank",
    lines: ["Comparing every job with your resume", "Checking the years each job asks for", "Spotting skills you're missing", "Putting the best fits first"] },
];

export function MatchProgress({ stage, skills = [], started }) {
  const at = Math.max(0, STAGES.findIndex(s => s.label === stage));
  const s = STAGES[at];
  const [line, setLine] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setLine(0); const t = setInterval(() => setLine(n => n + 1), 2600); return () => clearInterval(t); }, [at]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = started ? Math.max(0, Math.round(now / 1000 - started)) : null;
  return (
    <motion.div className="card mp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      <div className="mp-stage">
        <AnimatePresence mode="wait">
          <motion.div key={s.scene} className={`mp-scene mp-${s.scene}`} initial={{ opacity: 0, scale: .92, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: .92, x: -24 }} transition={{ duration: .35 }}>
            <Scene kind={s.scene} />
            <span className="mp-bot"><Robot id={s.agent} size={68} working /></span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mp-body">
        <AnimatePresence mode="wait">
          <motion.h3 key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {agentName(s.agent)} is {s.label.toLowerCase()}<span className="mp-dots"><i>.</i><i>.</i><i>.</i></span>
          </motion.h3>
        </AnimatePresence>
        <div className="mp-line">
          <AnimatePresence mode="wait">
            <motion.span key={`${at}-${line % s.lines.length}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }}>{s.lines[line % s.lines.length]}</motion.span>
          </AnimatePresence>
        </div>
        <div className="mp-track">
          <div className="mp-rail"><motion.i animate={{ width: `${(at / (STAGES.length - 1)) * 100}%` }} transition={{ duration: .6, ease: "easeOut" }} /></div>
          {STAGES.map((x, i) => (
            <div key={x.label} className={`mp-step ${i < at ? "done" : i === at ? "now" : ""}`}>
              <motion.span className="mp-dot" animate={i === at ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={i === at ? { repeat: Infinity, duration: 1.4 } : {}}>
                {i < at ? <Icon name="check" /> : i + 1}
              </motion.span>
              <span>{x.label}</span>
            </div>
          ))}
        </div>
        <div className="mp-foot">
          {secs != null && <span>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} so far</span>}
          <span>Usually 1–3 minutes</span>
        </div>
        {skills.length > 0 && <div className="mp-skills">{skills.slice(0, 12).map((k, i) => (
          <motion.span key={k} initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .06 }}>{k}</motion.span>))}</div>}
      </div>
    </motion.div>
  );
}

function Scene({ kind }) {
  if (kind === "read") return (
    <div className="mp-doc">
      {[78, 92, 64, 88, 70, 84, 56].map((w, i) => <i key={i} style={{ width: `${w}%`, animationDelay: `${i * .18}s` }} />)}
      <b className="mp-scan" />
    </div>
  );
  if (kind === "search") return (
    <div className="mp-world">
      {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * .37) % 2.6}s` }} />)}
      <b className="mp-lens"><Icon name="search" /></b>
      <span className="mp-card c1" /><span className="mp-card c2" /><span className="mp-card c3" />
    </div>
  );
  return (
    <div className="mp-bars">
      {[0, 1, 2, 3].map(i => <i key={i} style={{ animationDelay: `${i * .25}s` }}><b /></i>)}
      <span className="mp-star"><Icon name="star" /></span>
    </div>
  );
}
