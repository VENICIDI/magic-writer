import iconv from "iconv-lite";

const ENCODINGS = ["utf8", "utf-8", "gb18030", "gbk"] as const;

export function decodeBuffer(buffer: Buffer): string | null {
  // UTF-8 BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf-8");
  }

  for (const enc of ENCODINGS) {
    try {
      const text = iconv.decode(buffer, enc);
      if (!text.includes("\uFFFD")) return text;
    } catch {
      // try next
    }
  }

  // fallback
  try {
    return iconv.decode(buffer, "gb18030");
  } catch {
    return null;
  }
}
