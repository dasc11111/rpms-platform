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
      out += decodePdfString(m[1]);
    } else if (m[2] !== undefined) {
      const arr = m[2];
      const strRe = /\(((?:\\.|[^\\()])*)\)/g;
      let sm: RegExpExecArray | null;
      while ((sm = strRe.exec(arr))) {
        out += decodePdfString(sm[1]);
      }
    } else if (m[3] || m[4] || m[5]) {
      out += "\n";
    }
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = Number(searchParams.get("docId") || "1");

  const { rows } = await sql`SELECT blob_url FROM dosimetry_documents WHERE id = ${docId}`;
  const blobUrl = rows[0]?.blob_url as string | undefined;
  if (!blobUrl) return NextResponse.json({ error: "no_document" }, { status: 404 });

  const resp = await fetch(blobUrl);
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
  while ((m = streamRe.exec(binStr))) {
    streamCount++;
    const rawStreamStr = m[1] || "";
    const rawBuf = Buffer.from(rawStreamStr, "latin1");
    try {
      const inflated = zlib.inflateSync(rawBuf);
      const contentStr = inflated.toString("latin1");
      if (/\bTj\b|\bTJ\b/.test(contentStr)) {
        allText += extractTextFromContentStream(contentStr) + "\n----STREAM-BREAK----\n";
        inflateOk++;
      }
    } catch (e) {
      inflateFail++;
    }
  }

  return NextResponse.json({
    byteLength: buf.byteLength,
    streamCount,
    inflateOk,
    inflateFail,
    textLength: allText.length,
    textSample: allText.slice(0, 8000),
  });
}
