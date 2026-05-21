import { NextResponse } from "next/server";

const DEFAULT_BASE = "https://api.muapi.ai";

function getProviderBase(request) {
  const override = request.headers.get("x-provider-base");
  if (override && override.startsWith("http")) {
    return override.replace(/\/$/, "");
  }
  return DEFAULT_BASE;
}

function buildTargetUrl(request, path, search) {
  const base = getProviderBase(request);
  const normalizedPath = path ? `/${path}` : "";

  // MuAPI's public base is the origin, and its API lives under /api/v1.
  if (base === DEFAULT_BASE || base.endsWith("api.muapi.ai")) {
    return `${base}/api/v1${normalizedPath}${search}`;
  }

  // OpenAI-compatible providers often already include /v1 in their base URL:
  // - https://dashscope.aliyuncs.com/compatible-mode/v1
  // - https://api.openai.com/v1
  // In that case do NOT append /api/v1 again.
  return `${base}${normalizedPath}${search}`;
}

async function readJsonOrText(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function getApiKey(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader) return authHeader;
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey;
  return request.cookies.get("muapi_key")?.value || null;
}

function cleanHeaders(request) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("cookie");
  headers.delete("x-provider-base");
  return headers;
}

function applyAuth(headers, request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    headers.set("authorization", authHeader);
    headers.delete("x-api-key");
  } else {
    const apiKey =
      request.headers.get("x-api-key") ||
      request.cookies.get("muapi_key")?.value;
    if (apiKey) headers.set("x-api-key", apiKey);
  }
}

async function proxyRequest(request, params, method, includeBody = false) {
  const slug = await params;
  const pathSegments = slug.path || [];
  const path = pathSegments.join("/");
  const { search } = new URL(request.url);
  const targetUrl = buildTargetUrl(request, path, search);

  const headers = cleanHeaders(request);
  applyAuth(headers, request);

  const apiKey = getApiKey(request);
  console.log(
    `[api proxy ${method}] ${targetUrl} | auth: ${apiKey ? apiKey.slice(0, 12) + "..." : "MISSING"}`,
  );

  try {
    const init = { method, headers };
    if (includeBody) init.body = await request.arrayBuffer();
    const response = await fetch(targetUrl, init);
    const data = await readJsonOrText(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Proxies /api/api/v1/* -> provider-specific upstream.
// MuAPI: /api/api/v1/models -> https://api.muapi.ai/api/v1/models
// OpenAI-compatible: /api/api/v1/models -> <base>/models
export async function GET(request, { params }) {
  return proxyRequest(request, params, "GET");
}

export async function POST(request, { params }) {
  return proxyRequest(request, params, "POST", true);
}

export async function DELETE(request, { params }) {
  return proxyRequest(request, params, "DELETE");
}

export async function PATCH(request, { params }) {
  return proxyRequest(request, params, "PATCH", true);
}

export async function PUT(request, { params }) {
  return proxyRequest(request, params, "PUT", true);
}
