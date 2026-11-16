import { Fragment } from "react";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/** Highlight JSON ringan (tema gelap) tanpa dependency. Aman: hanya menghasilkan teks React, bukan HTML mentah. */
export function JsonView({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(<Fragment key={`t${i++}`}>{text.slice(last, idx)}</Fragment>);
    const [full, str, colon, lit] = m;
    if (str) {
      out.push(
        <Fragment key={`s${i++}`}>
          <span className={colon ? "text-sky-300" : "text-emerald-300"}>{str}</span>
          {colon ? <span className="text-zinc-500">{colon}</span> : null}
        </Fragment>,
      );
    } else if (lit) out.push(<span key={`l${i++}`} className="text-violet-300">{full}</span>);
    else out.push(<span key={`n${i++}`} className="text-amber-300">{full}</span>);
    last = idx + full.length;
  }
  if (last < text.length) out.push(<Fragment key="end">{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
