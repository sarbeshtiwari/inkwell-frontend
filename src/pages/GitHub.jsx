import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { SkBlock, fail } from "../ui/kit";
import { Connect } from "./github/Connect";
import { Repo } from "./github/Repo";
import { Repos } from "./github/Repos";

export default function GitHub({ route }) {
  const app = useApp();
  const [status, setStatus] = useState(null);
  const load = useCallback(() => api("/api/gh/status").then(s => { setStatus(s); app.setLinks(l => ({ ...l, github: s.connected })); }).catch(fail), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  if (!status) return <SkBlock h={320} />;
  if (!status.connected) return <Connect onDone={load} />;
  const [owner, name] = (route.param || "").split(":");
  return owner && name ? <Repo key={owner + "/" + name} owner={owner} name={name} /> : <Repos status={status} onDisconnect={load} />;
}
