import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import zlib from "zlib";

export const dynamic = "force-dynamic";

function decodePdfString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\") {
      const n = raw[i + 1];
      if (n === "n") { out += "\n"; i++; }
      else if (n === "r") { out += "\r"; i++; }
      else if (n === "t") { out += "\t"; i++; }
      else if (n === "(") { out += "("; i++; }
      else if (n === ")") { out += ")"; i++; }
      else if (n === "\\") { out += "\\"; i++; }
      else if (n && n >= "0" && n <= "7") {
        let oct = n;
        let j = i + 2;
        for (let k = 0; k < 2 && raw[j] && raw[j]! >= "0" && raw[j]! <= "7"; k++, j++) oct += raw[j];
        out += String.fromCharCode(parseInt(oct, 8));
        i = j - 1;
      } else { out += n || ""; i++; }
    } else {
      out += c;
    }
  }
  return out;
}

function extractTextFromContentStream(content: string): string {
  const re = /\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:\\.|[^\\\[\]])*)\]\s*TJ|(T\*)|(\bTd\b)|(\bTD\b)/g;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m[1] !== undefined) {
      out += decodePdfString(m[1] || "");
    } else if (m[2] !== undefined) {
      const arr = m[2] || "";
      const strRe = /\(((?:\\.|[^\\()])*)\)/g;
      let sm: RegExpExecArray | null;
      while ((sm = strRe.exec(arr))) {
        out += decodePdfString(sm[1] || "");
      }
    } else if (m[3] || m[4] || m[5]) {
      out += "\n";
    }
  }
  return out;
}

function parseToUnicodeMap(cmapText: string): Map<number, string> {
  const map = new Map<number, string>();
  const bfcharBlocks = cmapText.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
  for (const block of bfcharBlocks) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(block))) {
      const src = parseInt(pm[1] as string, 16);
      const dstHex = pm[2] as string;
      let dstStr = "";
      for (let i = 0; i < dstHex.length; i += 4) dstStr += String.fromCharCode(parseInt(dstHex.slice(i, i + 4), 16));
      map.set(src, dstStr);
    }
  }
  const bfrangeBlocks = cmapText.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const block of bfrangeBlocks) {
    const arrRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    let am: RegExpExecArray | null;
    while ((am = arrRe.exec(block))) {
      const start = parseInt(am[1] as string, 16);
      const items = (am[3] as string).match(/<([0-9A-Fa-f]+)>/g) || [];
      items.forEach((it, idx) => {
        const hex = it.replace(/[<>]/g, "");
        let s = "";
        for (let i = 0; i < hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
        map.set(start + idx, s);
      });
    }
    const simpleRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let sm2: RegExpExecArray | null;
    while ((sm2 = simpleRe.exec(block))) {
      const start = parseInt(sm2[1] as string, 16);
      const end = parseInt(sm2[2] as string, 16);
      const dstStart = parseInt(sm2[3] as string, 16);
      for (let c = start; c <= end; c++) map.set(c, String.fromCharCode(dstStart + (c - start)));
    }
  }
  return map;
}

function applyToUnicode(text: string, map: Map<number, string>): string {
  if (map.size === 0) return text;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out += map.has(code) ? map.get(code) : text[i];
  }
  return out;
}

async function fetchBlob(blobUrl: string): Promise<Response> {
  let resp = await fetch(blobUrl);
  if (!resp.ok) {
    const token = process.env.BLOB_READ_WRITE_TOKEN || "";
    resp = await fetch(blobUrl, { headers: { Authorization: `Bearer ${token}` } });
  }
  return resp;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = Number(searchParams.get("docId") || "1");

  const { rows } = await sql`SELECT blob_url FROM dosimetry_documents WHERE id = ${docId}`;
  const blobUrl = rows[0]?.blob_url as string | undefined;
  if (!blobUrl) return NextResponse.json({ error: "no_document" }, { status: 404 });

  const resp = await fetchBlob(blobUrl);
  if (!resp.ok) return NextResponse.json({ error: "fetch_failed", status: resp.status }, { status: 502 });
  const arrBuf = await resp.arrayBuffer();
  const buf = Buffer.from(arrBuf);
  const binStr = buf.toString("latin1");

  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  let allText = "";
  let streamCount = 0;
  let inflateOk = 0;
  let inflateFail = 0;
  let cmapText = "";
  const contentStreams: string[] = [];
  while ((m = streamRe.exec(binStr))) {
    streamCount++;
    const rawStreamStr = m[1] || "";
    const rawBuf = Buffer.from(rawStreamStr, "latin1");
    let contentStr: string | null = null;
    try {
      contentStr = zlib.inflateSync(rawBuf).toString("latin1");
      inflateOk++;
    } catch (e) {
      contentStr = rawStreamStr;
      inflateFail++;
    }
    if (contentStr.includes("beginbfchar") || contentStr.includes("beginbfrange")) {
      cmapText += contentStr;
    } else if (/\bTj\b|\bTJ\b/.test(contentStr)) {
      contentStreams.push(contentStr);
    }
  }

  const unicodeMap = parseToUnicodeMap(cmapText);
  for (const cs of contentStreams) {
    const raw = extractTextFromContentStream(cs);
    allText += applyToUnicode(raw, unicodeMap) + "\n----STREAM-BREAK----\n";
  }

  return NextResponse.json({
    byteLength: buf.byteLength,
    streamCount,
    inflateOk,
    inflateFail,
    cmapEntries: unicodeMap.size,
    textLength: allText.length,
    textSample: allText.slice(0, 10000),
  });
}
