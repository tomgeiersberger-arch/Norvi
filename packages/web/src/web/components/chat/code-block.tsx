import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { BundledLanguage, Highlighter } from "shiki";

const LANGS = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "bash",
  "python",
  "html",
  "css",
  "sql",
  "go",
  "rust",
  "java",
  "yaml",
  "markdown",
] as const satisfies readonly BundledLanguage[];

const ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  rs: "rust",
  golang: "go",
};

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then((shiki) =>
      shiki.createHighlighter({ themes: ["vesper"], langs: [...LANGS] }),
    );
  }
  return highlighterPromise;
}

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resolved = lang ? (ALIASES[lang.toLowerCase()] ?? lang.toLowerCase()) : "text";
  const supported = (LANGS as readonly string[]).includes(resolved) ? resolved : "text";

  useEffect(() => {
    let active = true;
    getHighlighter()
      .then((highlighter) => {
        if (!active) return;
        setHtml(
          highlighter.codeToHtml(code, {
            lang: supported,
            theme: "vesper",
          }),
        );
      })
      .catch(() => {
        if (active) setHtml(null);
      });
    return () => {
      active = false;
    };
  }, [code, supported]);

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="group/code relative overflow-hidden rounded-xl border border-border bg-[#0d0d10]">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
          {supported === "text" ? "code" : supported}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          aria-label="Code kopieren"
        >
          {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
          {copied ? "Kopiert" : "Kopieren"}
        </button>
      </div>
      {html ? (
        // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
        <div className="[&_pre]:!bg-transparent" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="text-foreground/90">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
