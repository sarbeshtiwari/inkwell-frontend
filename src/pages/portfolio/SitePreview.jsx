import { motion } from "framer-motion";
import { safeHref } from "../../lib/format";
import { Empty } from "../../ui/kit";

export function SitePreview({ items, headline, about }) {
  return (
    <motion.div className="site-pv" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="site-pv-head"><h2>Projects</h2>{headline && <p>{headline}</p>}{about && <p className="help">{about}</p>}</div>
      <div className="site-grid">
        {items.map((it, i) => (
          <motion.article key={it.repo} className={`site-card ${it.featured ? "feat" : ""}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: i * .04 } }} whileHover={{ y: -4 }}>
            <div className="site-img"><img src={it.image} alt="" loading="lazy" /></div>
            <div className="site-b"><h3>{it.title}</h3><p>{it.description}</p>
              <div className="site-tags">{(it.tags || []).map(t => <span key={t}>{t}</span>)}</div>
              <div className="site-links">{it.live_url && <a className="live" href={safeHref(it.live_url)} target="_blank" rel="noopener noreferrer">Live site ↗</a>}{it.repo_url && <a href={safeHref(it.repo_url)} target="_blank" rel="noopener noreferrer">Code</a>}</div></div>
          </motion.article>))}
      </div>
      {!items.length && <Empty icon="eye" title="Nothing to show">All projects are hidden.</Empty>}
    </motion.div>
  );
}
