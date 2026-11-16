import { lazy, Suspense, useEffect, useState } from "react";
import { replacePath } from "../lib/router";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
import { Icon, Seg, SkBlock } from "../ui/kit";
import { Projects } from "./portfolio/Projects";

const Website = lazy(() => import("./Website"));

export default function Portfolio({ route }) {
  const tab = ["website", "projects"].includes(route?.param) ? route.param : "website";
  const [slug, setSlug] = useState(null);
  const app = useApp();
  useEffect(() => { api("/api/portfolio").then(r => setSlug(r.slug || "")).catch(() => setSlug("")); }, []);
  const [cur, setCur] = useState(tab);
  useEffect(() => setCur(tab), [tab]);
  const pick = t => { setCur(t); replacePath("portfolio/" + t); };
  return (
    <div className="pf-shell">
      <div className="pf-tabs">
        <Seg value={cur} onChange={pick} name="Portfolio" options={[["website", "My website", "globe"], ["projects", "Projects", "star"]]} />
        <a className="btn btn-sm btn-ghost" href="/app/leads"><Icon name="inbox" />Enquiries from your site{app.counts.leads ? <span className="count new">{app.counts.leads}</span> : null}</a>
      </div>
      <Suspense fallback={<SkBlock h={520} />}>
        {cur === "website" && slug !== null && <Website slug={slug} onSlug={setSlug} />}
        {cur === "projects" && <Projects />}
      </Suspense>
    </div>
  );
}
