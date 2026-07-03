import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function getDistPath() {
  return path.resolve(__dirname, "public");
}

export async function getProdTemplate() {
  // Keep the generated stylesheet as a render-blocking stylesheet. Converting it
  // to an asynchronous preload made the SSR markup paint before its CSS arrived,
  // producing a large, unstyled logo/navigation flash on every cold visit.
  return fs.promises.readFile(path.resolve(getDistPath(), "index.html"), "utf-8");
}

export function serveStatic(app: Express) {
  const distPath = getDistPath();
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }

        if (/favicon|apple-touch-icon/i.test(path.basename(filePath))) {
          res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
          return;
        }

        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
}
