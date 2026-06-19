import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function getDistPath() {
  return path.resolve(__dirname, "public");
}

export async function getProdTemplate() {
  const template = await fs.promises.readFile(path.resolve(getDistPath(), "index.html"), "utf-8");

  return template.replace(
    /<link rel="stylesheet"([^>]*?)href="([^"]+\.css)"([^>]*)>/g,
    (_match, beforeHref = "", href = "", afterHref = "") => {
      const attrs = `${beforeHref}${afterHref}`.trim();
      const normalizedAttrs = attrs ? ` ${attrs}` : "";

      return [
        `<link rel="preload" as="style" href="${href}"${normalizedAttrs} onload="this.onload=null;this.rel='stylesheet'">`,
        `<noscript><link rel="stylesheet" href="${href}"${normalizedAttrs}></noscript>`,
      ].join("");
    },
  );
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
