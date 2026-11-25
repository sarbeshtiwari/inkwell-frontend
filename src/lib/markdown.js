// A small Markdown-to-HTML renderer for Inkwell's own course text: everything is escaped first, then only
// headings, lists, code, bold/italic and https links are turned into tags. Diagrams (mermaid) show as code.
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function md(text) {
  const out = [];
  // Inline code fences ("Try this: ```python def f(): ...```") become their own block.
  const src = String(text || "").replace(/\r/g, "").replace(/```(\w*) ([^`]+?) ```/g, (_, lang, code) => `\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
  const lines = src.split("\n");
  let list = null, para = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      flush();
      const code = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      out.push(`<pre class="md-code${fence[1] === "mermaid" ? " md-diagram" : ""}"><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) { flush(); const n = Math.min(6, h[1].length + 2); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    const li = line.match(/^\s*(?:([-*])|(\d+)[.)])\s+(.*)/);
    if (li) {
      if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
      const kind = li[1] ? "ul" : "ol";
      if (list !== kind) { if (list) out.push(`</${list}>`); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(li[3])}</li>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) { flush(); out.push(`<pre class="md-code"><code>${esc(line)}</code></pre>`); continue; }
    if (!line.trim()) { flush(); continue; }
    if (list) { out.push(`</${list}>`); list = null; }
    para.push(line.trim());
  }
  flush();
  return out.join("");
}
