export const TEXT_ATTACHMENT_ACCEPT =
  ".txt,.md,.markdown,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.env,.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.java,.c,.h,.cpp,.hpp,.cs,.go,.rs,.rb,.php,.html,.htm,.css,.scss,.sql,.sh,.ps1";

const SUPPORTED_EXTENSIONS = new Set(
  TEXT_ATTACHMENT_ACCEPT.split(",").map((extension) => extension.slice(1)),
);

export interface TextAttachmentInput {
  name: string;
  text: string;
}

export interface FormattedTextAttachments {
  text: string;
  count: number;
  truncated: boolean;
}

function extensionOf(name: string): string {
  const clean = name.trim().toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1) : "";
}

export function isSupportedTextAttachment(name: string, mimeType = ""): boolean {
  if (mimeType.startsWith("text/")) return true;
  if (mimeType === "application/json" || mimeType === "application/xml") return true;
  return SUPPORTED_EXTENSIONS.has(extensionOf(name));
}

export function formatTextAttachments(
  files: TextAttachmentInput[],
  maxTotalChars = 24_000,
  maxFileChars = 12_000,
): FormattedTextAttachments {
  let remaining = Math.max(0, maxTotalChars);
  let truncated = false;
  const blocks: string[] = [];

  for (const file of files.slice(0, 3)) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const name = file.name.replace(/[\r\n\t]/g, " ").trim().slice(0, 160) || "Datei";
    const normalized = file.text
      .replace(/\r\n?/g, "\n")
      .split(String.fromCharCode(0))
      .join("");
    const limit = Math.min(maxFileChars, remaining);
    const excerpt = normalized.slice(0, limit);
    if (excerpt.length < normalized.length) truncated = true;
    remaining -= excerpt.length;
    blocks.push(
      "[Datei: " +
        name +
        "]\n" +
        excerpt +
        (excerpt.length < normalized.length ? "\n[… gekürzt …]" : "") +
        "\n[/Datei]",
    );
  }

  if (files.length > 3) truncated = true;
  return {
    text: blocks.join("\n\n"),
    count: blocks.length,
    truncated,
  };
}
