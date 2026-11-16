
export const Patch = ({ p }) => p ? <pre className="patch">{p.split("\n").map((l, i) => <span key={i} className={l.startsWith("+") ? "add" : l.startsWith("-") ? "rem" : l.startsWith("@@") ? "hunk" : ""}>{l}{"\n"}</span>)}</pre> : <p className="help">No text diff (binary or large file).</p>;

export const FilesChanged = ({ files }) => files.map(f => (
  <details key={f.filename} className="gh-file-diff"><summary><i className={`st ${f.status === "removed" ? "del" : f.status === "added" ? "new" : "mod"}`}>{f.status[0].toUpperCase()}</i><b>{f.filename}</b><span className="grow" /><span className="add">+{f.additions}</span> <span className="rem">−{f.deletions}</span></summary><Patch p={f.patch} /></details>));
