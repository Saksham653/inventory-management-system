import { Fragment } from "react"

// WhatsApp formatting: *bold*, _italic_, and links.
export function WaText({ text }) {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(\*[^*\n]+\*|_[^_\n]+_|https?:\/\/\S+)/g).map((part, j) => {
        if (/^\*[^*]+\*$/.test(part)) return <b key={j}>{part.slice(1, -1)}</b>
        if (/^_[^_]+_$/.test(part)) return <i key={j}>{part.slice(1, -1)}</i>
        if (/^https?:\/\//.test(part)) return <a key={j} href={part} target="_blank" rel="noreferrer">{part.replace(/^https?:\/\//, "")}</a>
        return part
      })}
    </Fragment>
  ))
}
