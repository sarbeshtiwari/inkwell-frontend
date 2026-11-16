import { useState } from "react";
import { upload } from "../../lib/api";
import { useApp } from "../../lib/store";
import { Button, FormError, Icon, Spinner, Switch, modal, toast } from "../../ui/kit";
import { Dropzone } from "../../ui/shared";

export function ImportPanel({ onClose }) {
  const app = useApp();
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const onFiles = async files => {
    const file = files[0]; setErr("");
    if (!/\.(xlsx|xlsm|csv)$/i.test(file.name)) return setErr("Choose an Excel (.xlsx) or CSV file.");
    if (file.size > 5 * 1048576) return setErr("That file is larger than 5 MB. Split it into smaller files.");
    if (replace && !await modal({ title: "Replace all contacts?", text: "Your current list, including who has already been contacted, will be replaced by this file.", confirm: "Replace", danger: true })) return;
    const fd = new FormData(); fd.append("file", file); fd.append("replace", replace ? "1" : "0");
    setBusy(file.name);
    try {
      const d = await upload("/api/recipients/import", fd);
      const skipped = [d.duplicates && `${d.duplicates} duplicate${d.duplicates === 1 ? "" : "s"}`, d.invalid && `${d.invalid} without a valid phone or email`].filter(Boolean).join(", ");
      toast(`Added ${d.added} contact${d.added === 1 ? "" : "s"}` + (skipped ? ` · skipped ${skipped}` : ""));
      await app.reload(); onClose();
    } catch (e) { setErr(e.message); }
    setBusy("");
  };
  return (
    <div className="card card-pad panel">
      <Dropzone onFiles={onFiles} accept=".xlsx,.xlsm,.csv" busy={!!busy}>
        <div className="dz-ic"><Icon name="sheet" /></div>
        <b>{busy ? <><Spinner /> Importing {busy}…</> : "Drop your Excel or CSV file here, or click to choose"}</b>
        <span className="help">Name, company, phone and email columns are found automatically. Other columns become fields you can use in your message. Max 5 MB.</span>
      </Dropzone>
      <FormError>{err}</FormError>
      <div className="form-actions"><Switch checked={replace} onChange={setReplace}>Replace my whole list</Switch><span className="grow" />
        <a className="btn btn-sm btn-ghost" href="/api/recipients/sample"><Icon name="download" />Sample sheet</a><Button size="sm" onClick={onClose}>Done</Button></div>
    </div>
  );
}
