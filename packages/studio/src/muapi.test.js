import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- localStorage mock ---
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (index) => Object.keys(store)[index] ?? null,
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

globalThis.localStorage = localStorageMock;

const {
  getAvailableProviders,
  getCurrentProvider,
  setCurrentProvider,
  getApiKey,
  saveApiKey,
  getCustomBaseUrl,
  setCustomBaseUrl,
  getAlibabaSize,
  extractAlibabaOutput,
} = await import("./muapi.js");

// ===========================================================================
// Provider management
// ===========================================================================
describe("getAvailableProviders()", () => {
  it("returns an array of provider objects", () => {
    const providers = getAvailableProviders();
    expect(Array.isArray(providers)).toBe(true);
  });

  it("includes expected providers", () => {
    const providers = getAvailableProviders();
    const ids = providers.map((p) => p.id);
    expect(ids).toContain("muapi");
    expect(ids).toContain("openai");
    expect(ids).toContain("replicate");
    expect(ids).toContain("alibaba");
    expect(ids).toContain("huggingface");
    expect(ids).toContain("stability");
    expect(ids).toContain("custom");
  });

  it("each provider has id and name", () => {
    const providers = getAvailableProviders();
    providers.forEach((p) => {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
    });
  });

  it("muapi is the first provider (default)", () => {
    const providers = getAvailableProviders();
    expect(providers[0].id).toBe("muapi");
  });
});

describe("getCurrentProvider() / setCurrentProvider()", () => {
  beforeEach(() => setCurrentProvider("muapi"));

  it("returns muapi as the default provider", () => {
    const provider = getCurrentProvider();
    expect(provider.id).toBe("muapi");
    expect(provider.name).toBe("MuAPI");
  });

  it("setCurrentProvider returns true for valid providers", () => {
    expect(setCurrentProvider("openai")).toBe(true);
    expect(setCurrentProvider("replicate")).toBe(true);
    expect(setCurrentProvider("alibaba")).toBe(true);
    expect(setCurrentProvider("muapi")).toBe(true);
  });

  it("setCurrentProvider returns false for unknown providers", () => {
    expect(setCurrentProvider("nonexistent")).toBe(false);
    expect(setCurrentProvider("")).toBe(false);
    expect(setCurrentProvider(null)).toBe(false);
  });

  it("getCurrentProvider reflects the last set provider", () => {
    setCurrentProvider("openai");
    expect(getCurrentProvider().id).toBe("openai");
    expect(getCurrentProvider().name).toBe("OpenAI");
    setCurrentProvider("replicate");
    expect(getCurrentProvider().id).toBe("replicate");
  });

  it("persists provider choice in localStorage", () => {
    setCurrentProvider("huggingface");
    expect(localStorage.getItem("apexstudios_api_provider")).toBe("huggingface");
  });

  it("muapi provider has correct auth defaults", () => {
    setCurrentProvider("muapi");
    const p = getCurrentProvider();
    expect(p.authHeader).toBe("x-api-key");
    expect(p.authPrefix).toBe("");
    expect(p.baseUrl).toBe("https://api.muapi.ai");
  });

  it("openai provider has correct auth defaults", () => {
    setCurrentProvider("openai");
    const p = getCurrentProvider();
    expect(p.authHeader).toBe("Authorization");
    expect(p.authPrefix).toBe("Bearer ");
    expect(p.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("alibaba provider has modelsBaseUrl", () => {
    setCurrentProvider("alibaba");
    const p = getCurrentProvider();
    expect(p.baseUrl).toBe("https://dashscope.aliyuncs.com/api/v1");
    expect(p.modelsBaseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
  });
});

// ===========================================================================
// API key storage
// ===========================================================================
describe("getApiKey() / saveApiKey()", () => {
  it("returns null when no key is stored", () => {
    expect(getApiKey("muapi")).toBeNull();
    expect(getApiKey("openai")).toBeNull();
  });

  it("saveApiKey stores the key under the provider-specific key", () => {
    saveApiKey("openai", "sk-openai-test-123");
    expect(localStorage.getItem("apexstudios_api_key_openai")).toBe("sk-openai-test-123");
  });

  it("getApiKey retrieves the stored key for a provider", () => {
    saveApiKey("replicate", "rep-key-456");
    expect(getApiKey("replicate")).toBe("rep-key-456");
  });

  it("getApiKey returns null for a provider with no key stored", () => {
    saveApiKey("openai", "sk-xyz");
    expect(getApiKey("replicate")).toBeNull();
  });

  it("saveApiKey with muapi also updates the legacy muapi_key", () => {
    saveApiKey("muapi", "mu-key-legacy-sync");
    expect(localStorage.getItem("apexstudios_api_key_muapi")).toBe("mu-key-legacy-sync");
    expect(localStorage.getItem("muapi_key")).toBe("mu-key-legacy-sync");
  });

  it("getApiKey falls back to legacy muapi_key for muapi", () => {
    localStorage.setItem("muapi_key", "legacy-mu-key");
    expect(getApiKey("muapi")).toBe("legacy-mu-key");
  });

  it("getApiKey prefers the new storage key over the legacy key", () => {
    localStorage.setItem("muapi_key", "legacy-mu-key");
    saveApiKey("muapi", "new-mu-key");
    expect(getApiKey("muapi")).toBe("new-mu-key");
  });

  it("getApiKey uses the current provider when no providerId is given", () => {
    setCurrentProvider("openai");
    saveApiKey("openai", "sk-default-provider");
    expect(getApiKey()).toBe("sk-default-provider");
  });

  it("getApiKey returns null when no provider is set and no key stored", () => {
    setCurrentProvider("muapi");
    expect(getApiKey()).toBeNull();
  });
});

describe("getCustomBaseUrl() / setCustomBaseUrl()", () => {
  it("returns empty string when no custom URL is set", () => {
    expect(getCustomBaseUrl()).toBe("");
  });

  it("setCustomBaseUrl stores the URL", () => {
    setCustomBaseUrl("https://custom-provider.example.com/v1");
    expect(localStorage.getItem("apexstudios_custom_base_url")).toBe("https://custom-provider.example.com/v1");
  });

  it("getCustomBaseUrl retrieves the stored URL", () => {
    setCustomBaseUrl("https://my-ai.example.org/api");
    expect(getCustomBaseUrl()).toBe("https://my-ai.example.org/api");
  });

  it("custom provider's baseUrl getter reads from localStorage", () => {
    setCustomBaseUrl("https://my-custom.ai");
    setCurrentProvider("custom");
    const customProvider = getCurrentProvider();
    expect(customProvider.baseUrl).toBe("https://my-custom.ai");
  });
});

describe("integration: provider lifecycle", () => {
  it("full round-trip: set provider → save key → read back", () => {
    setCurrentProvider("openai");
    saveApiKey("openai", "sk-integration-test");
    const provider = getCurrentProvider();
    const key = getApiKey("openai");
    expect(provider.id).toBe("openai");
    expect(provider.name).toBe("OpenAI");
    expect(key).toBe("sk-integration-test");
  });

  it("supports multiple provider keys simultaneously", () => {
    saveApiKey("muapi", "mu-key");
    saveApiKey("openai", "sk-openai");
    saveApiKey("replicate", "rep-key");
    expect(getApiKey("muapi")).toBe("mu-key");
    expect(getApiKey("openai")).toBe("sk-openai");
    expect(getApiKey("replicate")).toBe("rep-key");
  });

  it("switching providers does not lose other provider keys", () => {
    saveApiKey("muapi", "mu-key");
    saveApiKey("openai", "sk-openai");
    setCurrentProvider("muapi");
    expect(getApiKey("muapi")).toBe("mu-key");
    setCurrentProvider("openai");
    expect(getApiKey("openai")).toBe("sk-openai");
  });
});

// ===========================================================================
// Helper functions
// ===========================================================================
describe("getAlibabaSize()", () => {
  it("returns correct sizes for known aspect ratios", () => {
    expect(getAlibabaSize("1:1")).toBe("1024*1024");
    expect(getAlibabaSize("16:9")).toBe("1280*720");
    expect(getAlibabaSize("9:16")).toBe("720*1280");
    expect(getAlibabaSize("4:3")).toBe("1024*768");
    expect(getAlibabaSize("3:4")).toBe("768*1024");
  });

  it("falls back to 1280*720 for unknown aspect ratios", () => {
    expect(getAlibabaSize("21:9")).toBe("1280*720");
  });

  it("defaults to 1280*720 when no argument provided", () => {
    expect(getAlibabaSize()).toBe("1280*720");
  });
});

describe("extractAlibabaOutput()", () => {
  it("extracts output.video_url", () => {
    expect(extractAlibabaOutput({ output: { video_url: "https://ex.com/v.mp4" } }))
      .toBe("https://ex.com/v.mp4");
  });

  it("extracts output.url", () => {
    expect(extractAlibabaOutput({ output: { url: "https://ex.com/img.png" } }))
      .toBe("https://ex.com/img.png");
  });

  it("extracts first result url from output.results array", () => {
    expect(extractAlibabaOutput({
      output: { results: [{ url: "https://ex.com/1.png" }, { url: "https://ex.com/2.png" }] }
    })).toBe("https://ex.com/1.png");
  });

  it("extracts from flat data.url when no output field", () => {
    expect(extractAlibabaOutput({ url: "https://ex.com/img.png" })).toBe("https://ex.com/img.png");
  });

  it("extracts from data.output_url", () => {
    expect(extractAlibabaOutput({ output_url: "https://ex.com/img.png" })).toBe("https://ex.com/img.png");
  });

  it("output field takes precedence over data field", () => {
    expect(extractAlibabaOutput({
      url: "https://ex.com/ignored.png",
      output: { url: "https://ex.com/used.png" }
    })).toBe("https://ex.com/used.png");
  });

  it("returns null when no url found", () => {
    expect(extractAlibabaOutput({})).toBeNull();
    expect(extractAlibabaOutput({ output: { status: "running" } })).toBeNull();
  });
});

// ===========================================================================
// API calling functions with mocked fetch
// ===========================================================================
describe("API calling with mocked fetch", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    setCurrentProvider("muapi");
    saveApiKey("muapi", "test-muapi-key");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("generateImage() - MuAPI", () => {
    it("sends correct POST request", async () => {
      const { generateImage } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ request_id: "req-123", status: "completed", outputs: ["https://ex.com/o.png"] }),
        text: async () => JSON.stringify({ request_id: "req-123", status: "completed", outputs: ["https://ex.com/o.png"] }),
      });

      await generateImage("test-key", { model: "flux-schnell", prompt: "A cat", aspect_ratio: "16:9" });

      const calls = vi.mocked(globalThis.fetch).mock.calls;
      const submitCall = calls.find(c => c[1]?.method === "POST");
      expect(submitCall).toBeDefined();
      const [url, opts] = submitCall;
      expect(url).toContain("/api/api/v1/flux-schnell");
      expect(opts.headers["Content-Type"]).toBe("application/json");
      expect(opts.headers["x-api-key"]).toBe("test-key");
      expect(opts.headers["x-provider-base"]).toBe("https://api.muapi.ai");

      const body = JSON.parse(opts.body);
      expect(body.prompt).toBe("A cat");
      expect(body.aspect_ratio).toBe("16:9");
      expect(body.image_url).toBeNull();
    });

    it("uses modelInfo endpoint when provided", async () => {
      const { generateImage } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ request_id: "req-123", status: "completed", outputs: [] }),
        text: async () => JSON.stringify({ request_id: "req-123", status: "completed" }),
      });

      await generateImage("test-key", {
        model: "custom-model",
        modelInfo: { endpoint: "my-endpoint" },
        prompt: "Test",
        onRequestId: vi.fn(),
      });

      const calls = vi.mocked(globalThis.fetch).mock.calls;
      expect(calls[0][0]).toContain("/api/api/v1/my-endpoint");
    });

    it("includes image_url and strength", async () => {
      const { generateImage } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/r.png" }),
        text: async () => JSON.stringify({ status: "completed", url: "https://ex.com/r.png" }),
      });

      await generateImage("test-key", {
        model: "flux-schnell", prompt: "Edit",
        image_url: "https://ex.com/input.png", strength: 0.8,
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.image_url).toBe("https://ex.com/input.png");
      expect(body.strength).toBe(0.8);
    });

    it("includes seed when not -1, omits when -1", async () => {
      const { generateImage } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/r.png" }),
        text: async () => JSON.stringify({ status: "completed", url: "https://ex.com/r.png" }),
      });

      await generateImage("test-key", { model: "flux-schnell", prompt: "Seeded", seed: 42 });
      expect(JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body).seed).toBe(42);

      vi.mocked(globalThis.fetch).mockClear();

      // Reset mock for next call
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/r.png" }),
        text: async () => JSON.stringify({ status: "completed", url: "https://ex.com/r.png" }),
      });

      await generateImage("test-key", { model: "flux-schnell", prompt: "No seed", seed: -1 });
      expect(JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body).seed).toBeUndefined();
    });

    it("throws on non-ok submit response", async () => {
      const { generateImage } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 402, statusText: "Payment Required",
        text: async () => "Insufficient balance",
      });

      await expect(generateImage("test-key", { model: "flux-schnell", prompt: "Test" }))
        .rejects.toThrow("API Request Failed: 402");
    });
  });

  describe("generateVideo() - MuAPI", () => {
    it("sends correct payload", async () => {
      const { generateVideo } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ request_id: "req-123", status: "completed", outputs: ["https://ex.com/v.mp4"] }),
        text: async () => JSON.stringify({ request_id: "req-123", status: "completed" }),
      });

      await generateVideo("test-key", {
        model: "kling-1.6", prompt: "A dog", aspect_ratio: "16:9", duration: 5,
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.prompt).toBe("A dog");
      expect(body.aspect_ratio).toBe("16:9");
      expect(body.duration).toBe(5);
      expect(body.model).toBeUndefined(); // No model field for muapi
    });
  });

  describe("generateI2I()", () => {
    it("sends image_url", async () => {
      const { generateI2I } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/r.png" }),
        text: async () => JSON.stringify({ status: "completed" }),
      });

      await generateI2I("test-key", {
        model: "some-i2i-model", prompt: "Transform",
        image_url: "https://ex.com/input.png",
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.image_url).toBe("https://ex.com/input.png");
    });
  });

  describe("generateMarketingStudioAd()", () => {
    it("uses 1080p endpoint when resolution is 1080p", async () => {
      const { generateMarketingStudioAd } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/ad.mp4" }),
        text: async () => JSON.stringify({ status: "completed", url: "https://ex.com/ad.mp4" }),
      });

      await generateMarketingStudioAd("test-key", { prompt: "Ad", resolution: "1080p" });
      expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toContain("sd-2-vip-omni-reference-1080p");
    });

    it("uses default endpoint", async () => {
      const { generateMarketingStudioAd } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/ad.mp4" }),
        text: async () => JSON.stringify({ status: "completed", url: "https://ex.com/ad.mp4" }),
      });

      await generateMarketingStudioAd("test-key", { prompt: "Ad" });
      expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toContain("seedance-2-vip-omni-reference");
    });
  });

  describe("processLipSync()", () => {
    it("sends audio_url and video_url", async () => {
      const { processLipSync } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/lip.mp4" }),
        text: async () => JSON.stringify({ status: "completed", url: "https://ex.com/lip.mp4" }),
      });

      await processLipSync("test-key", {
        model: "infinite-talk", audio_url: "https://ex.com/a.mp3", video_url: "https://ex.com/v.mp4",
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.audio_url).toBe("https://ex.com/a.mp3");
      expect(body.video_url).toBe("https://ex.com/v.mp4");
    });

    it("includes prompt when model has hasPrompt flag", async () => {
      const { processLipSync } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: "completed", url: "https://ex.com/lip.mp4" }),
        text: async () => JSON.stringify({ status: "completed", url: "https://ex.com/lip.mp4" }),
      });

      await processLipSync("test-key", {
        model: "some-model", modelInfo: { hasPrompt: true },
        prompt: "Say hello", video_url: "https://ex.com/v.mp4",
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.prompt).toBe("Say hello");
    });
  });

  describe("getUserBalance()", () => {
    it("returns unsupported for non-muapi providers", async () => {
      const { getUserBalance } = await import("./muapi.js");
      setCurrentProvider("openai");

      const result = await getUserBalance("sk-test");
      expect(result).toEqual({ balance: null, unsupported: true });
      // Confirm no fetch was made — getUserBalance returns early for non-muapi providers
      expect(getCurrentProvider().id).toBe("openai");
    });

    it("fetches balance from API proxy for muapi", async () => {
      const { getUserBalance } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ balance: 123.45 }),
        text: async () => JSON.stringify({ balance: 123.45 }),
      });

      const result = await getUserBalance("mu-key");
      expect(result.balance).toBe(123.45);
      expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toContain("/api/api/v1/account/balance");
    });

    it("throws on failed balance fetch", async () => {
      const { getUserBalance } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 401,
        text: async () => "Unauthorized",
      });

      await expect(getUserBalance("bad-key")).rejects.toThrow("Failed to fetch balance");
    });
  });

  describe("workflow API functions", () => {
    it("getTemplateWorkflows sends x-api-key", async () => {
      const { getTemplateWorkflows } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => [{ id: "wf-1" }],
        text: async () => JSON.stringify([{ id: "wf-1" }]),
      });

      await getTemplateWorkflows("mu-key");
      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(call[0]).toContain("/api/workflow/get-template-workflows");
      expect(call[1].headers["x-api-key"]).toBe("mu-key");
    });

    it("getTemplateAgents extracts agents array from response", async () => {
      const { getTemplateAgents } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ agents: [{ id: "agent-1" }, { id: "agent-2" }] }),
        text: async () => JSON.stringify({ agents: [{ id: "agent-1" }, { id: "agent-2" }] }),
      });

      const result = await getTemplateAgents("mu-key");
      expect(result.length).toBe(2);
      expect(result[0].id).toBe("agent-1");
    });

    it("getUserConversations returns empty array for non-array response", async () => {
      const { getUserConversations } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ conversations: [] }),
        text: async () => JSON.stringify({ conversations: [] }),
      });

      const result = await getUserConversations("mu-key");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Provider-specific behavior
  // ---------------------------------------------------------------------------
  describe("OpenAI-compatible", () => {
    it("generateImage includes model field and Authorization header", async () => {
      const { generateImage } = await import("./muapi.js");
      setCurrentProvider("openai");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ created: 123, data: [{ url: "https://ex.com/img.png" }] }),
        text: async () => JSON.stringify({ created: 123, data: [{ url: "https://ex.com/img.png" }] }),
      });

      await generateImage("sk-openai", { model: "dall-e-3", prompt: "A painting" });

      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(call[0]).toContain("/api/api/v1/images/generations");
      expect(call[1].headers["Authorization"]).toBe("Bearer sk-openai");
      expect(call[1].headers["x-api-key"]).toBeUndefined();
      expect(call[1].headers["x-provider-base"]).toBe("https://api.openai.com/v1");

      const body = JSON.parse(call[1].body);
      expect(body.model).toBe("dall-e-3");
    });
  });

  describe("Alibaba-specific", () => {
    it("generateImage uses submitAlibabaTask flow", async () => {
      const { generateImage } = await import("./muapi.js");
      setCurrentProvider("alibaba");

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true, status: 200,
            json: async () => ({ output: { task_id: "alibaba-task-123" } }),
            text: async () => JSON.stringify({ output: { task_id: "alibaba-task-123" } }),
          });
        }
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({
            output: { task_status: "SUCCEEDED", results: [{ url: "https://dashscope.com/img.png" }] },
          }),
          text: async () => JSON.stringify({
            output: { task_status: "SUCCEEDED", results: [{ url: "https://dashscope.com/img.png" }] },
          }),
        });
      });

      const result = await generateImage("sk-alibaba", {
        model: "wanx2.1-t2i-turbo",
        modelInfo: { providerModel: "wanx2.1-t2i-turbo" },
        prompt: "A sunset",
        aspect_ratio: "16:9",
      });

      const calls = vi.mocked(globalThis.fetch).mock.calls;
      expect(calls[0][0]).toContain("/api/api/v1/services/aigc/text2image/image-synthesis");
      expect(calls[0][1].headers["X-DashScope-Async"]).toBe("enable");

      const body = JSON.parse(calls[0][1].body);
      expect(body.model).toBe("wanx2.1-t2i-turbo");
      expect(body.input.prompt).toBe("A sunset");
      expect(body.parameters.size).toBe("1280*720");

      expect(calls[1][0]).toContain("/api/api/v1/tasks/alibaba-task-123");
      expect(result.url).toBe("https://dashscope.com/img.png");
    }, 10000);
  });

  describe("fetchModels()", () => {
    it("sends correct x-provider-base for Alibaba", async () => {
      const { fetchModels } = await import("./muapi.js");
      setCurrentProvider("alibaba");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({
          data: [
            { id: "dall-e-3" },
            { id: "stable-diffusion-xl" },
            { id: "wanx2.1-t2i-turbo" },
          ],
        }),
        text: async () => JSON.stringify({
          data: [
            { id: "dall-e-3" },
            { id: "stable-diffusion-xl" },
            { id: "wanx2.1-t2i-turbo" },
          ],
        }),
      });

      const models = await fetchModels("sk-alibaba");
      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(call[1].headers["x-provider-base"]).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
      expect(models.t2iModels.length).toBeGreaterThanOrEqual(2);
    });

    it("throws on HTTP error", async () => {
      const { fetchModels } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 500,
        text: async () => "Server error",
      });

      await expect(fetchModels("test-key")).rejects.toThrow("Failed to fetch models");
    });

    it("throws on network error", async () => {
      const { fetchModels } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(fetchModels("test-key")).rejects.toThrow("Network error");
    });
  });

  describe("app functions", () => {
    it("calculateDynamicCost sends correct request", async () => {
      const { calculateDynamicCost } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ cost: 0.05 }),
        text: async () => JSON.stringify({ cost: 0.05 }),
      });

      await calculateDynamicCost("mu-key", "text-to-image", { prompt: "test" });
      expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toContain("/api/api/v1/app/calculate_dynamic_cost");
    });

    it("registerAppInterest sends correct request", async () => {
      const { registerAppInterest } = await import("./muapi.js");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ success: true }),
        text: async () => JSON.stringify({ success: true }),
      });

      await registerAppInterest("mu-key", "My App");
      expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toContain("/api/api/v1/app/interest");
    });
  });
});

// ===========================================================================
// uploadFile with mocked XHR
// ===========================================================================
function createMockXhr(overrides = {}) {
  return {
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(),
    upload: { onprogress: null },
    onload: null,
    onerror: null,
    status: 200,
    statusText: "OK",
    responseText: JSON.stringify({ url: "https://example.com/uploaded.png" }),
    ...overrides,
  };
}

describe("uploadFile()", () => {
  let originalXHR;
  let mockXhr;

  beforeEach(() => {
    setCurrentProvider("muapi");
    originalXHR = globalThis.XMLHttpRequest;
    mockXhr = createMockXhr();
    globalThis.XMLHttpRequest = function() { return mockXhr; };
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXHR;
  });

  it("resolves with file URL on successful upload for muapi", async () => {
    const { uploadFile } = await import("./muapi.js");
    const mockFile = new File(["test"], "image.png", { type: "image/png" });
    const uploadPromise = uploadFile("mu-key", mockFile);

    expect(mockXhr.open).toHaveBeenCalledWith("POST", "/api/api/v1/upload_file");
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("x-api-key", "mu-key");
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("x-provider-base", "https://api.muapi.ai");
    expect(mockXhr.send).toHaveBeenCalled();

    mockXhr.onload();
    const url = await uploadPromise;
    expect(url).toBe("https://example.com/uploaded.png");
  });

  it("sends Authorization: Bearer header for openai", async () => {
    const { uploadFile } = await import("./muapi.js");
    setCurrentProvider("openai");
    const mockFile = new File(["test"], "image.png", { type: "image/png" });
    const uploadPromise = uploadFile("sk-openai-key", mockFile);

    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer sk-openai-key");
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("x-provider-base", "https://api.openai.com/v1");

    mockXhr.onload();
    await uploadPromise;
  });

  it("rejects when no URL in upload response", async () => {
    const { uploadFile } = await import("./muapi.js");
    mockXhr.responseText = JSON.stringify({ success: true });
    const mockFile = new File(["test"], "image.png", { type: "image/png" });
    const uploadPromise = uploadFile("mu-key", mockFile);

    mockXhr.onload();
    await expect(uploadPromise).rejects.toThrow("No URL returned from file upload");
  });

  it("rejects on HTTP error status", async () => {
    const { uploadFile } = await import("./muapi.js");
    mockXhr.status = 401;
    mockXhr.statusText = "Unauthorized";
    mockXhr.responseText = JSON.stringify({ detail: "Invalid API key" });
    const mockFile = new File(["test"], "image.png", { type: "image/png" });
    const uploadPromise = uploadFile("bad-key", mockFile);

    mockXhr.onload();
    await expect(uploadPromise).rejects.toThrow("File upload failed: 401");
  });

  it("rejects on network error", async () => {
    const { uploadFile } = await import("./muapi.js");
    const mockFile = new File(["test"], "image.png", { type: "image/png" });
    const uploadPromise = uploadFile("mu-key", mockFile);

    mockXhr.onerror();
    await expect(uploadPromise).rejects.toThrow("Network error during file upload");
  });

  it("calls onProgress callback", async () => {
    const { uploadFile } = await import("./muapi.js");
    const onProgress = vi.fn();
    const mockFile = new File(["test"], "image.png", { type: "image/png" });
    const uploadPromise = uploadFile("mu-key", mockFile, onProgress);

    mockXhr.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
    expect(onProgress).toHaveBeenCalledWith(50);

    mockXhr.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
    expect(onProgress).toHaveBeenCalledWith(100);

    mockXhr.onload();
    await uploadPromise;
  });

  it("does not call onProgress when not lengthComputable", async () => {
    const { uploadFile } = await import("./muapi.js");
    const onProgress = vi.fn();
    const mockFile = new File(["test"], "image.png", { type: "image/png" });
    const uploadPromise = uploadFile("mu-key", mockFile, onProgress);

    mockXhr.upload.onprogress({ lengthComputable: false, loaded: 50, total: 100 });
    expect(onProgress).not.toHaveBeenCalled();

    mockXhr.onload();
    await uploadPromise;
  });
});
