import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ago } from "../../lib/format";
import { Alert, Empty, Icon, Pager, Sk, fail, usePager } from "../../ui/kit";
import { FilesChanged } from "./Diff";

export function History({ base, branch }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState({});
  const pg = usePager(list || [], branch, 20);
  useEffect(() => { api(`/api/gh/commits/${base}?ref=${encodeURIComponent(branch)}`).then(r => setList(r.commits)).catch(fail); }, [base, branch]);
  const toggle = async sha => {
    if (open[sha]) return setOpen(o => { const x = { ...o }; delete x[sha]; return x; });
    setOpen(o => ({ ...o, [sha]: "loading" }));
    try { const d = await api(`/api/gh/commit/${base}/${sha}`); setOpen(o => ({ ...o, [sha]: d })); } catch (e) { fail(e); setOpen(o => { const x = { ...o }; delete x[sha]; return x; }); }
  };
  return (
    <div className="card">
      {!list && <div className="card-pad"><Sk w="60%" /><Sk w="40%" style={{ marginTop: 10 }} /></div>}
      {pg.items.map((c, i) => <div key={c.sha}>
        <motion.button className="pr-row" onClick={() => toggle(c.sha)} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: Math.min(i, 15) * .02 } }}>
          {c.avatar ? <img className="av-img" src={c.avatar} alt="" /> : <span className="pr-ic"><Icon name="commit" /></span>}
          <div className="t"><b>{c.message.split("\n")[0]}</b><span className="help">{c.author} · {ago(c.date)} · <code>{c.sha.slice(0, 7)}</code></span></div>
          <motion.span animate={{ rotate: open[c.sha] ? 90 : 0 }}><Icon name="chevron" /></motion.span>
        </motion.button>
        <AnimatePresence>{open[c.sha] && <motion.div className="commit-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
          <div className="card-pad">{open[c.sha] === "loading" ? <Sk w="50%" /> : <>{open[c.sha].message.includes("\n") && <pre className="pr-body">{open[c.sha].message}</pre>}<FilesChanged files={open[c.sha].files} /></>}</div>
        </motion.div>}</AnimatePresence>
      </div>)}
      {list && !list.length && <Empty icon="commit" title="No commits yet" />}
      <Pager p={pg} label="commits" sizes={[20, 50]} />
    </div>
  );
}

export { Alert };
