import { getStore } from "@netlify/blobs";
const TTL_MS = 15 * 60 * 1000;
const MAX_BYTES = 8 * 1024 * 1024;
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store" };
export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const store = getStore("escala-kalunga-temporary-pdfs");
  if (request.method === "POST") {
    if (!(request.headers.get("content-type") || "").includes("application/pdf")) return Response.json({ error: "Envie um arquivo PDF." }, { status: 415, headers });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return Response.json({ error: "PDF vazio ou maior que 8 MB." }, { status: 413, headers });
    const id = crypto.randomUUID().replaceAll("-", ""), expiresAt = Date.now() + TTL_MS;
    await store.set(id, JSON.stringify({ base64: Buffer.from(bytes).toString("base64"), expiresAt }));
    return Response.json({ url: `${new URL(request.url).origin}/.netlify/functions/pdf-share?id=${id}`, expiresAt }, { headers });
  }
  if (request.method === "GET") {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!/^[a-f0-9]{32}$/.test(id)) return new Response("Link inválido.", { status: 400, headers });
    const raw = await store.get(id);
    if (!raw) return new Response("PDF não encontrado ou link expirado.", { status: 404, headers });
    const entry = JSON.parse(raw);
    if (!entry.expiresAt || Date.now() > entry.expiresAt) { await store.delete(id); return new Response("Este link expirou. Gere um novo QR Code no site.", { status: 410, headers }); }
    return new Response(Buffer.from(entry.base64, "base64"), { status: 200, headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="relatorio-escala.pdf"' } });
  }
  return new Response("Método não permitido.", { status: 405, headers });
};
