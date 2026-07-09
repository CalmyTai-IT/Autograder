import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Markdown renderer tối giản, không cần thư viện ngoài.
 * Hỗ trợ: heading, đậm/nghiêng, `code`, ```code block```, danh sách (-, *, 1.),
 * blockquote, đường kẻ ngang, link và xuống dòng.
 */

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  let i = 0;

  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-i${i++}`;

    if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="data rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      nodes.push(<strong key={key} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const cut = tok.indexOf("](");
      const label = tok.slice(1, cut);
      const href = tok.slice(cut + 2, -1);
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
          {label}
        </a>
      );
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = (content ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  const flushList = (ordered: boolean, items: string[], key: string) => {
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={key} className={cn("my-2 space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}>
        {items.map((it, n) => (
          <li key={n} className="leading-relaxed">{renderInline(it, `${key}-${n}`)}</li>
        ))}
      </Tag>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++; // bỏ ``` đóng
      blocks.push(
        <pre key={`c${i}`} className="data my-2 overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs leading-relaxed">
          <code>{buf.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Đường kẻ ngang
    if (/^\s*([-*_])\s*\1\s*\1[\s*_-]*$/.test(line)) {
      blocks.push(<hr key={`h${i}`} className="my-3 border-border" />);
      i++;
      continue;
    }

    // Heading
    const h = /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const size = lvl <= 2 ? "text-base" : "text-sm";
      blocks.push(
        <p key={`t${i}`} className={cn("mb-1 mt-3 font-semibold first:mt-0", size)}>
          {renderInline(h[2], `t${i}`)}
        </p>
      );
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={`q${i}`} className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
          {renderInline(buf.join(" "), `q${i}`)}
        </blockquote>
      );
      continue;
    }

    // Danh sách
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
      flushList(false, items, `ul${i}`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      flushList(true, items, `ol${i}`);
      continue;
    }

    // Dòng trống
    if (!line.trim()) {
      i++;
      continue;
    }

    // Đoạn văn
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(```|>|#{1,6}\s|[-*+]\s|\d+[.)]\s)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    blocks.push(
      <p key={`p${i}`} className="my-2 leading-relaxed first:mt-0 last:mb-0">
        {buf.map((b, n) => (
          <Fragment key={n}>
            {n > 0 && <br />}
            {renderInline(b, `p${i}-${n}`)}
          </Fragment>
        ))}
      </p>
    );
  }

  if (blocks.length === 0) return null;
  return <div className={cn("text-sm text-foreground/90", className)}>{blocks}</div>;
}
