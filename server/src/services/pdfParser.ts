import pdfParse from "pdf-parse";

export function normalizeExtractedText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractPdfTextFallback(buffer: Buffer): string {
  const ascii = buffer.toString("latin1");
  const chunks: string[] = [];
  const re = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*T[Jj]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(ascii)) !== null) {
    chunks.push(match[1].replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\"));
  }
  if (chunks.length) return chunks.join(" ");
  return (ascii.match(/stream[\s\S]*?endstream/g) || []).join("\n").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    if (data?.text?.trim()) return normalizeExtractedText(data.text);
  } catch { /* use fallback */ }
  return normalizeExtractedText(extractPdfTextFallback(buffer));
}
