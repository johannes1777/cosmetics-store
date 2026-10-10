// Turns plain text into headings, paragraphs and bullet lists.
// SAFETY: this never creates HTML from the text. It builds a fixed set of React elements
// (h2, p, ul, li) and puts the text inside them as plain text, so anything like <script>
// or <b> typed by an editor just appears as ordinary characters and does nothing.
//
// The only "formatting" is:  a line starting with "## " is a heading,
// lines starting with "- " are bullets, and a blank line starts a new paragraph.

type Block = { type: "h2"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };

export function applyTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (match, key: string) => tokens[key] ?? match);
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ type: "ul", items: list }); list = []; } };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith("## ")) { flushPara(); flushList(); blocks.push({ type: "h2", text: line.slice(3).trim() }); continue; }
    if (line.startsWith("- ")) { flushPara(); list.push(line.slice(2).trim()); continue; }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

export default function RichText({ text, tokens }: { text: string; tokens: Record<string, string> }) {
  const blocks = parseBlocks(applyTokens(text, tokens));
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "h2") return <h2 key={i}>{b.text}</h2>;
        if (b.type === "ul") return <ul key={i}>{b.items.map((item, j) => <li key={j}>{item}</li>)}</ul>;
        return <p key={i}>{b.text}</p>;
      })}
    </>
  );
}
