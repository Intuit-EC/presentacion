type SmokeCheck = {
  path: string;
  name: string;
  expectedStatus?: number;
  mustContain?: string[];
  maxRedirects?: number;
  maxBodyBytes?: number;
};

const DEFAULT_BASE_URL = "https://difiori.com.ec";
const BASE_URL = normalizeBaseUrl(process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL);
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const USER_AGENT = "DIFIORI-SmokeMonitor/1.0 (+health-check; no-analytics-bot)";

const checks: SmokeCheck[] = [
  {
    name: "Home",
    path: "/",
    mustContain: [
      "DIFIORI",
      "canonical",
      "application/ld+json",
      'href="/shop" class="site-nav-link',
      'href="/shop" class="home-discovery-card home-discovery-card-accent"',
    ],
  },
  {
    name: "Catálogo",
    path: "/shop",
    mustContain: ["Catálogo", "product-list", "canonical"],
    maxBodyBytes: 100_000,
  },
  {
    name: "Landing flores Guayaquil",
    path: "/flores-guayaquil",
    mustContain: ["Flores en Guayaquil", "application/ld+json", "canonical"],
  },
  {
    name: "Sitemap",
    path: "/sitemap.xml",
    mustContain: ["<urlset", "/shop"],
  },
  {
    name: "Robots",
    path: "/robots.txt",
    mustContain: ["User-agent", "Disallow: /checkout", "Sitemap:"],
  },
  {
    name: "Legacy producto.php (cualquier ID)",
    path: "/producto.php?id=521",
    mustContain: ["Catálogo", "canonical"],
  },
  {
    name: "Categoría antigua",
    path: "/navidad-2024",
    mustContain: ["Catálogo", "canonical"],
  },
  {
    name: "Checkout operativo",
    path: "/checkout",
    mustContain: ["Checkout | DIFIORI", "noindex, nofollow", "canonical", "/assets/index"],
  },
  {
    name: "PayPhone configurado",
    path: "/api/external/payphone/health",
    mustContain: [
      '"provider":"PayPhone"',
      '"tokenConfigured":true',
      '"storeIdConfigured":true',
      '"sdkVersion":"2.0"',
    ],
  },
];

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`SMOKE_BASE_URL inválida: ${value}`);
  }
  return trimmed;
}

function buildUrl(path: string) {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assertContains(body: string, fragments: string[], checkName: string) {
  for (const fragment of fragments) {
    if (!body.toLowerCase().includes(fragment.toLowerCase())) {
      throw new Error(`${checkName}: no encontré "${fragment}" en la respuesta`);
    }
  }
}

async function runCheck(check: SmokeCheck) {
  const url = buildUrl(check.path);
  const response = await fetchWithTimeout(url);
  const expectedStatus = check.expectedStatus || 200;

  if (response.status !== expectedStatus) {
    throw new Error(`${check.name}: status ${response.status}, esperado ${expectedStatus} (${url})`);
  }

  const body = await response.text();
  const bytes = Buffer.byteLength(body, "utf8");
  if (check.mustContain?.length) {
    assertContains(body, check.mustContain, check.name);
  }

  if (check.maxBodyBytes && bytes > check.maxBodyBytes) {
    throw new Error(`${check.name}: respuesta demasiado pesada (${bytes} bytes; máximo ${check.maxBodyBytes})`);
  }

  return {
    name: check.name,
    url,
    status: response.status,
    bytes,
  };
}

async function main() {
  console.log(`Smoke E2E DIFIORI`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User-Agent: ${USER_AGENT}`);

  const results = [];

  for (const check of checks) {
    const startedAt = Date.now();
    const result = await runCheck(check);
    results.push({ ...result, ms: Date.now() - startedAt });
    console.log(`✓ ${result.name} ${result.status} ${result.bytes} bytes`);
  }

  const totalMs = results.reduce((sum, result) => sum + result.ms, 0);
  console.log(`Smoke E2E OK: ${results.length} checks en ${totalMs}ms`);
}

main().catch((error) => {
  console.error("Smoke E2E FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
