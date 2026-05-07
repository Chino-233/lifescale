import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJsonStore } from "./jsonStore.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT ?? 3001);
const store = createJsonStore(rootDir);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      name: "lifescale",
      storage: await store.getStorageInfo(),
    });
    return true;
  }

  if (url.pathname === "/api/storage-info") {
    sendJson(response, 200, await store.getStorageInfo());
    return true;
  }

  if (url.pathname !== "/api/life-data") {
    return false;
  }

  try {
    if (request.method === "GET") {
      sendJson(response, 200, await store.loadData());
      return true;
    }

    if (request.method === "PUT") {
      const body = store.normalizeData(await readJsonBody(request));
      sendJson(response, 200, await store.saveData(body));
      return true;
    }

    if (request.method === "DELETE") {
      sendJson(response, 200, await store.saveData(store.emptyData));
      return true;
    }

    sendJson(response, 405, { error: "Method not allowed" });
    return true;
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Bad request",
    });
    return true;
  }
}

async function serveStatic(response, requestedPath) {
  const safePath = requestedPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(distDir, safePath));

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  let target = filePath;

  try {
    const fileStat = await stat(target);
    if (fileStat.isDirectory()) {
      target = path.join(target, "index.html");
    }
  } catch {
    target = path.join(distDir, "index.html");
  }

  try {
    const extension = path.extname(target);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extension) ?? "application/octet-stream",
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (await handleApi(request, response, url)) {
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  await serveStatic(response, url.pathname);
});

server.listen(port, () => {
  console.log(`LifeScale server listening on http://localhost:${port}`);
  console.log(`Data file: ${store.dataFile}`);
  console.log(`Backup file: ${store.backupFile}`);
});
