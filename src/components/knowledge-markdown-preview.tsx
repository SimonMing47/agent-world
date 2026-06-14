"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { ExternalImage } from "@/components/ui/external-image";
import { cn } from "@/lib/utils";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hashCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderInline(text: string) {
  const parts = text.split(/(!?\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);

  return parts.map((part, index) => {
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(part);
    if (image) {
      return (
        <ExternalImage
          key={index}
          src={image[2]}
          alt={image[1]}
          className="my-3 max-h-72 max-w-full rounded-2xl border border-[var(--line)] object-contain"
        />
      );
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-[var(--accent-strong)] underline-offset-4 hover:underline">
          {link[1]}
        </a>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded-md bg-[rgba(15,23,42,0.06)] px-1.5 py-0.5 font-mono text-[0.92em] text-[var(--ink)]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return (
        <strong key={index} className="font-semibold text-[var(--ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <del key={index} className="text-[var(--ink-subtle)]">
          {part.slice(2, -2)}
        </del>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={index} className="text-[var(--ink)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function parseTaskItem(value: string) {
  const match = /^\s*[-*]\s*\[(x|X|\s*)\]\s*(.*)$/.exec(value) ?? /^\s*[-*]\s*\[\]\s*(.*)$/.exec(value);
  if (!match) return null;
  if (match.length === 2) return { checked: false, text: match[1] };
  return { checked: match[1].toLowerCase() === "x", text: match[2] };
}

function replaceTaskMarker(line: string, checked: boolean) {
  const match = /^(\s*)([-*])\s*\[(?:x|X|\s*)\](\s*.*)$/.exec(line) ?? /^(\s*)([-*])\s*\[\](\s*.*)$/.exec(line);
  if (!match) return line;
  const tail = match[3].trimStart();
  return `${match[1]}${match[2]} ${checked ? "[x]" : "[ ]"}${tail ? ` ${tail}` : ""}`;
}

export function toggleTaskLine(content: string, lineIndex: number, checked: boolean) {
  const lines = content.split(/\r?\n/);
  if (!lines[lineIndex]) return content;
  lines[lineIndex] = replaceTaskMarker(lines[lineIndex], checked);
  return lines.join("\n");
}

function parseTable(lines: string[], start: number) {
  if (start + 1 >= lines.length) return null;
  const header = lines[start];
  const divider = lines[start + 1];
  if (!header.includes("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(divider)) return null;

  const split = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  const rows = [split(header)];
  let index = start + 2;
  while (index < lines.length && lines[index]?.includes("|") && lines[index]?.trim()) {
    rows.push(split(lines[index] ?? ""));
    index += 1;
  }
  return { rows, nextIndex: index };
}

const codeLanguageAliases: Record<string, string> = {
  bash: "Shell",
  cjs: "JavaScript",
  css: "CSS",
  diff: "Diff",
  go: "Go",
  html: "HTML",
  java: "Java",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  md: "Markdown",
  markdown: "Markdown",
  mjs: "JavaScript",
  patch: "Patch",
  py: "Python",
  python: "Python",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  ts: "TypeScript",
  tsx: "TSX",
  txt: "Text",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

const codeKeywords = new Set([
  "abstract",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "def",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "interface",
  "is",
  "let",
  "new",
  "null",
  "number",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "select",
  "static",
  "string",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "undefined",
  "update",
  "var",
  "void",
  "where",
  "while",
  "with",
]);

function parseCodeFenceInfo(info: string) {
  const trimmed = info.trim();
  const [rawLanguage = "", ...metaParts] = trimmed.split(/\s+/);
  const language = rawLanguage.replace(/^\./, "").toLowerCase();
  const metaText = metaParts.join(" ");
  const namedFile = /(?:title|file|filename)=["']?([^"'\s]+)["']?/.exec(metaText)?.[1];
  const looseFile = metaParts.find((part) => /[/.]/.test(part) && !part.includes("="));

  return {
    language,
    label: codeLanguageAliases[language] ?? (language ? language.toUpperCase() : "Code"),
    meta: namedFile ?? looseFile ?? "",
  };
}

function tokenClassName(token: string, language: string) {
  if (!token) return "";
  if (/^(['"`]).*\1$/.test(token)) return "text-[#a6e3a1]";
  if (/^(\/\/|#|\/\*|<!--)/.test(token)) return "text-[#7f8da3]";
  if (/^<\/?[A-Za-z]/.test(token)) return "text-[#89dceb]";
  if (/^\d/.test(token)) return "text-[#fab387]";
  if (/^(true|false|null|undefined|NaN|Infinity)$/i.test(token)) return "text-[#f5c2e7]";
  if (codeKeywords.has(token.toLowerCase())) return "text-[#89b4fa]";
  if (["json", "yaml", "yml"].includes(language) && /^[A-Za-z_$][\w$-]*$/.test(token)) return "text-[#cba6f7]";
  if (/^[{}()[\].,;:+\-*/%=<>!&|?]+$/.test(token)) return "text-[#9aa7bb]";
  return "text-[#d7e0ee]";
}

function renderHighlightedLine(line: string, language: string): ReactNode {
  if (!line) return "\u00A0";
  if (["diff", "patch"].includes(language)) return line;

  const commentPattern = ["bash", "sh", "shell", "python", "py", "yaml", "yml"].includes(language)
    ? "#.*"
    : "//.*|/\\*.*?\\*/|<!--.*?-->";
  const tokenPattern = new RegExp(
    [
      "(",
      commentPattern,
      "|\"(?:\\\\.|[^\"\\\\])*\"",
      "|'(?:\\\\.|[^'\\\\])*'",
      "|`(?:\\\\.|[^`\\\\])*`",
      "|<\\/?[A-Za-z][^>]*>",
      "|\\b\\d+(?:\\.\\d+)?\\b",
      "|\\b[A-Za-z_$][\\w$-]*\\b",
      "|[{}()[\\].,;:+\\-*/%=<>!&|?]+",
      ")",
    ].join(""),
    "g",
  );
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line))) {
    if (match.index > cursor) nodes.push(line.slice(cursor, match.index));
    const token = match[0];
    nodes.push(
      <span key={`${match.index}-${token}`} className={tokenClassName(token, language)}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }

  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes.length ? nodes : line;
}

function codeLineTone(language: string, line: string) {
  if (!["diff", "patch"].includes(language)) return "";
  if (line.startsWith("+") && !line.startsWith("+++")) return "bg-[#143821] text-[#b7f7c4]";
  if (line.startsWith("-") && !line.startsWith("---")) return "bg-[#3b1d25] text-[#ffc1cb]";
  if (line.startsWith("@@")) return "bg-[#18304a] text-[#9fd8ff]";
  return "";
}

function CodeBlock({ code, info }: { code: string; info: string }) {
  const [copied, setCopied] = useState(false);
  const text = useLanguageText();
  const { language, label, meta } = parseCodeFenceInfo(info);
  const lines = code.split("\n");
  const lineDigits = Math.max(2, String(lines.length).length);

  function copyWithSelectionFallback() {
    const textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.appendChild(textarea);
    const selection = document.getSelection();
    const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    textarea.focus();
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
    }
  }

  async function copyCode() {
    let didCopy = copyWithSelectionFallback();
    try {
      const permission =
        !didCopy && navigator.permissions
          ? await navigator.permissions.query({ name: "clipboard-write" as PermissionName }).catch(() => null)
          : null;
      if (
        !didCopy &&
        permission?.state !== "denied" &&
        window.isSecureContext &&
        document.hasFocus() &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(code);
        didCopy = true;
      }
      setCopied(didCopy);
      if (!didCopy) return;
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-[#232b38] bg-[#0f141d] shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-[#151b26] px-4 py-2.5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase text-[#d7e0ee]">{label}</div>
          {meta ? <div className="mt-0.5 truncate font-mono text-[11px] text-[#8d9aad]">{meta}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/6 px-2.5 text-xs font-medium text-[#d7e0ee] transition-colors hover:bg-white/10"
          aria-label={text("knowledge.notebook.code.copy")}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#a6e3a1]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? text("knowledge.notebook.code.copied") : text("knowledge.notebook.code.copy")}
        </button>
      </div>
      <div className="overflow-auto">
        <code className="block min-w-max py-3 font-mono text-[12px] leading-6">
          {lines.map((codeLine, lineIndex) => (
            <div
              key={lineIndex}
              className={cn("grid grid-cols-[auto_1fr] px-0", codeLineTone(language, codeLine))}
            >
              <span
                className="select-none border-r border-white/8 px-3 text-right text-[#5f6b7d]"
                style={{ minWidth: `${lineDigits + 3}ch` }}
              >
                {lineIndex + 1}
              </span>
              <span className="whitespace-pre px-4">{renderHighlightedLine(codeLine, language)}</span>
            </div>
          ))}
        </code>
      </div>
    </div>
  );
}

function MermaidDiagram({ chart }: { chart: string }) {
  const text = useLanguageText();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useMemo(() => `mermaid-${hashCode(chart)}`, [chart]);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    void import("mermaid")
      .then(async (module) => {
        const mermaid = module.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        });
        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "knowledge.markdown.mermaid.renderFailed");
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="my-4 rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">Mermaid</div>
        <pre className="mt-3 overflow-auto text-xs leading-6 text-[var(--ink-muted)]">{chart}</pre>
      </div>
    );
  }

  return (
    <div className="my-4 overflow-auto rounded-2xl border border-[var(--line)] bg-white px-4 py-4 shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
      {svg ? (
        <ExternalImage className="mx-auto max-w-full" src={svgDataUri(svg)} alt="Mermaid" />
      ) : (
        <div className="py-10 text-center text-sm text-[var(--ink-subtle)]">{text("knowledge.markdown.mermaid.rendering")}</div>
      )}
    </div>
  );
}

function plantUmlSequenceSvg(source: string) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@start") && !line.startsWith("@end") && !line.startsWith("'"));
  const participantNames = new Set<string>();
  const messages: Array<{ from: string; to: string; label: string; dashed: boolean }> = [];

  for (const line of lines) {
    const participant = /^(actor|participant|boundary|control|entity|database)\s+"?([^"]+)"?/.exec(line);
    if (participant) participantNames.add(participant[2].trim());
    const message = /^"?([^"-]+?)"?\s*(-{1,2}>|<-{1,2})\s*"?([^":]+?)"?\s*:?\s*(.*)$/.exec(line);
    if (message) {
      const left = message[1].trim();
      const right = message[3].trim();
      const reverse = message[2].startsWith("<");
      const from = reverse ? right : left;
      const to = reverse ? left : right;
      participantNames.add(from);
      participantNames.add(to);
      messages.push({ from, to, label: message[4].trim(), dashed: message[2].includes("--") });
    }
  }

  const participants = [...participantNames];
  if (!participants.length || !messages.length) return null;

  const width = Math.max(720, participants.length * 170 + 80);
  const height = Math.max(260, messages.length * 72 + 150);
  const xFor = (name: string) => 60 + participants.indexOf(name) * 170;
  const boxes = participants
    .map((name) => {
      const x = xFor(name);
      return `
        <rect x="${x}" y="28" width="130" height="42" rx="12" fill="#fff" stroke="#dfe5eb"/>
        <text x="${x + 65}" y="54" text-anchor="middle" font-size="13" font-weight="600" fill="#1f2937">${escapeHtml(name)}</text>
        <line x="${x + 65}" y="78" x2="${x + 65}" y2="${height - 32}" stroke="#d9e0e8" stroke-dasharray="5 7"/>
      `;
    })
    .join("");
  const arrows = messages
    .map((message, index) => {
      const y = 120 + index * 72;
      const fromX = xFor(message.from) + 65;
      const toX = xFor(message.to) + 65;
      const direction = fromX <= toX ? 1 : -1;
      const labelX = (fromX + toX) / 2;
      return `
        <line x1="${fromX}" y1="${y}" x2="${toX - direction * 9}" y2="${y}" stroke="#263241" stroke-width="1.6" ${message.dashed ? 'stroke-dasharray="6 6"' : ""}/>
        <path d="M ${toX - direction * 10} ${y - 5} L ${toX} ${y} L ${toX - direction * 10} ${y + 5}" fill="none" stroke="#263241" stroke-width="1.6"/>
        <rect x="${labelX - 78}" y="${y - 28}" width="156" height="22" rx="11" fill="#f7fafc"/>
        <text x="${labelX}" y="${y - 13}" text-anchor="middle" font-size="12" fill="#516173">${escapeHtml(message.label || "message")}</text>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
      <rect width="100%" height="100%" rx="18" fill="#fbfcfd"/>
      ${boxes}
      ${arrows}
    </svg>
  `;
}

function plantUmlClassSvg(source: string) {
  const classes = source
    .split(/\r?\n/)
    .map((line) => /^\s*(class|interface|enum)\s+"?([\w.\u4e00-\u9fa5-]+)"?/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ kind: match[1], name: match[2] }));
  if (!classes.length) return null;

  const columns = Math.min(3, classes.length);
  const width = Math.max(520, columns * 210 + 60);
  const rows = Math.ceil(classes.length / columns);
  const height = rows * 120 + 50;
  const nodes = classes
    .map((item, index) => {
      const x = 30 + (index % columns) * 210;
      const y = 30 + Math.floor(index / columns) * 120;
      return `
        <rect x="${x}" y="${y}" width="180" height="78" rx="14" fill="#fff" stroke="#dfe5eb"/>
        <rect x="${x}" y="${y}" width="180" height="28" rx="14" fill="#f5f8fb"/>
        <text x="${x + 90}" y="${y + 20}" text-anchor="middle" font-size="11" fill="#6b7684">${escapeHtml(item.kind)}</text>
        <text x="${x + 90}" y="${y + 54}" text-anchor="middle" font-size="13" font-weight="700" fill="#1f2937">${escapeHtml(item.name)}</text>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
      <rect width="100%" height="100%" rx="18" fill="#fbfcfd"/>
      ${nodes}
    </svg>
  `;
}

function PlantUmlDiagram({ source }: { source: string }) {
  const svg = plantUmlSequenceSvg(source) ?? plantUmlClassSvg(source);

  return (
    <div className="my-4 overflow-auto rounded-2xl border border-[var(--line)] bg-white px-4 py-4 shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
      {svg ? (
        <ExternalImage className="mx-auto max-w-full" src={svgDataUri(svg)} alt="PlantUML" />
      ) : (
        <>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-subtle)]">PlantUML</div>
          <pre className="mt-3 overflow-auto rounded-xl bg-[#10141d] p-4 text-xs leading-6 text-[#d7e0ee]">{source}</pre>
        </>
      )}
    </div>
  );
}

export function MarkdownPreview({
  content,
  onTaskToggle,
}: {
  content: string;
  onTaskToggle?: (lineIndex: number, checked: boolean) => void;
}) {
  const text = useLanguageText();
  const nodes = [];
  const lines = content.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const codeInfo = line.trim().slice(3).trim();
      const language = parseCodeFenceInfo(codeInfo).language;
      const codeLines = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      const code = codeLines.join("\n");
      if (language === "mermaid") {
        nodes.push(<MermaidDiagram key={`mermaid-${index}`} chart={code} />);
      } else if (["plantuml", "puml", "uml"].includes(language)) {
        nodes.push(<PlantUmlDiagram key={`plantuml-${index}`} source={code} />);
      } else {
        nodes.push(<CodeBlock key={`code-${index}`} code={code} info={codeInfo} />);
      }
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      const [header, ...body] = table.rows;
      nodes.push(
        <div key={`table-${index}`} className="my-4 overflow-auto rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-[rgba(15,23,42,0.03)]">
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex} className="border-b border-[var(--line)] px-4 py-3 text-left font-semibold text-[var(--ink)]">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[var(--line)] last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 text-[var(--ink-muted)]">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index = table.nextIndex;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const headingContent = renderInline(heading[2]);
      const className = cn(
        "mt-5 font-semibold tracking-normal text-[var(--ink)]",
        level === 1 && "text-2xl",
        level === 2 && "text-xl",
        level === 3 && "text-lg",
        level >= 4 && "text-base",
      );
      if (level === 1) nodes.push(<h1 key={`heading-${index}`} className={className}>{headingContent}</h1>);
      else if (level === 2) nodes.push(<h2 key={`heading-${index}`} className={className}>{headingContent}</h2>);
      else if (level === 3) nodes.push(<h3 key={`heading-${index}`} className={className}>{headingContent}</h3>);
      else nodes.push(<h4 key={`heading-${index}`} className={className}>{headingContent}</h4>);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(
        <blockquote key={`quote-${index}`} className="my-4 border-l-2 border-[var(--accent)]/60 pl-4 text-sm leading-7 text-[var(--ink-muted)]">
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}>{renderInline(quoteLine)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*[-*]\s*\[/.test(line)) {
      const listItems: Array<{ text: string; checked?: boolean; lineIndex?: number; indent: number }> = [];
      while (index < lines.length && (/^\s*[-*]\s+/.test(lines[index] ?? "") || /^\s*[-*]\s*\[/.test(lines[index] ?? ""))) {
        const current = lines[index] ?? "";
        const indent = Math.floor(((/^\s*/.exec(current)?.[0] ?? "").replace(/\t/g, "  ").length) / 2);
        const task = parseTaskItem(current);
        listItems.push(task ? { ...task, lineIndex: index, indent } : { text: current.replace(/^\s*[-*]\s+/, ""), indent });
        index += 1;
      }
      nodes.push(
        <ul key={`list-${index}`} className="my-4 space-y-2 text-sm leading-7 text-[var(--ink-muted)]">
          {listItems.map((item, itemIndex) => (
            <li key={itemIndex} className="flex items-start gap-2" style={{ paddingLeft: `${item.indent * 18}px` }}>
              {typeof item.checked === "boolean" ? (
                <button
                  type="button"
                  aria-label={text(item.checked ? "knowledge.markdown.task.markIncomplete" : "knowledge.markdown.task.markComplete")}
                  aria-pressed={item.checked}
                  onClick={() => {
                    if (typeof item.lineIndex === "number") onTaskToggle?.(item.lineIndex, !item.checked);
                  }}
                  className={cn(
                    "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    item.checked
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_0_3px_rgba(9,199,232,0.12)]"
                      : "border-[var(--line)] bg-white hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)]",
                  )}
                >
                  {item.checked ? <Check className="h-3 w-3" /> : null}
                </button>
              ) : (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink-subtle)]" />
              )}
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const listItems: Array<{ text: string; indent: number }> = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index] ?? "")) {
        const current = lines[index] ?? "";
        const indent = Math.floor(((/^\s*/.exec(current)?.[0] ?? "").replace(/\t/g, "  ").length) / 2);
        listItems.push({ text: current.replace(/^\s*\d+[.)]\s+/, ""), indent });
        index += 1;
      }
      nodes.push(
        <ol key={`ordered-${index}`} className="my-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-[var(--ink-muted)]">
          {listItems.map((item, itemIndex) => (
            <li key={itemIndex} style={{ marginLeft: `${item.indent * 18}px` }}>{renderInline(item.text)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) {
      nodes.push(<hr key={`rule-${index}`} className="my-5 border-[var(--line)]" />);
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !/^(#{1,6})\s+/.test(lines[index] ?? "") &&
      !/^>\s?/.test(lines[index] ?? "") &&
      !/^\s*[-*]\s+/.test(lines[index] ?? "") &&
      !/^\s*[-*]\s*\[/.test(lines[index] ?? "") &&
      !/^\s*\d+[.)]\s+/.test(lines[index] ?? "") &&
      !(lines[index] ?? "").trim().startsWith("```") &&
      !parseTable(lines, index)
    ) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }

    nodes.push(
      <p key={`paragraph-${index}`} className="my-3 text-sm leading-8 text-[var(--ink-muted)]">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  if (!nodes.length) {
    return (
      <div className="flex h-full min-h-[460px] items-center justify-center text-sm text-[var(--ink-subtle)]">
        knowledge.markdown.preview.empty
      </div>
    );
  }

  return <div className="px-7 py-6">{nodes}</div>;
}
