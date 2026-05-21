import { describe, it, expect, beforeEach } from "vitest";

// --- localStorage mock ---
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => {
    store[key] = String(value);
  },
  removeItem: (key) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index) => Object.keys(store)[index] ?? null,
};

beforeEach(() => {
  // Clear the mock store before each test
  Object.keys(store).forEach((k) => delete store[k]);
});

// Inject mock localStorage into global scope before importing the module
// The source module checks `typeof localStorage !== 'undefined'`
globalThis.localStorage = localStorageMock;

// Import AFTER setting up the mock so the module's top-level
// `PROVIDERS` definition (which references localStorage for custom.baseUrl)
// picks up our mock.
const {
  getAvailableProviders,
  getCurrentProvider,
  setCurrentProvider,
  getApiKey,
  saveApiKey,
  getCustomBaseUrl,
  setCustomBaseUrl,
} = await import("./muapi.js");

// ---------------------------------------------------------------------------
// getAvailableProviders
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// getCurrentProvider / setCurrentProvider
// ---------------------------------------------------------------------------
describe("getCurrentProvider() / setCurrentProvider()", () => {
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
    expect(localStorage.getItem("apexstudios_api_provider")).toBe(
      "huggingface"
    );
  });
});

// ---------------------------------------------------------------------------
// getApiKey / saveApiKey
// ---------------------------------------------------------------------------
describe("getApiKey() / saveApiKey()", () => {
  it("returns null when no key is stored", () => {
    expect(getApiKey("muapi")).toBeNull();
    expect(getApiKey("openai")).toBeNull();
  });

  it("saveApiKey stores the key under the provider-specific key", () => {
    saveApiKey("openai", "sk-openai-test-123");
    expect(localStorage.getItem("apexstudios_api_key_openai")).toBe(
      "sk-openai-test-123"
    );
  });

  it("getApiKey retrieves the stored key for a provider", () => {
    saveApiKey("replicate", "rep-key-456");
    expect(getApiKey("replicate")).toBe("rep-key-456");
  });

  it("getApiKey returns null for a provider with no key stored", () => {
    // muapi and replicate have no keys, only openai does
    saveApiKey("openai", "sk-xyz");
    expect(getApiKey("replicate")).toBeNull();
  });

  it("saveApiKey with muapi also updates the legacy muapi_key", () => {
    saveApiKey("muapi", "mu-key-legacy-sync");
    expect(localStorage.getItem("apexstudios_api_key_muapi")).toBe(
      "mu-key-legacy-sync"
    );
    expect(localStorage.getItem("muapi_key")).toBe("mu-key-legacy-sync");
  });

  it("getApiKey falls back to legacy muapi_key for muapi", () => {
    // Only set the legacy key, not the new one
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
    // If providerId is undefined, it should use the current provider
    expect(getApiKey()).toBe("sk-default-provider");
  });

  it("getApiKey defaults to muapi when no provider is set and no key stored", () => {
    // Clear everything
    setCurrentProvider("muapi");
    expect(getApiKey()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCustomBaseUrl / setCustomBaseUrl
// ---------------------------------------------------------------------------
describe("getCustomBaseUrl() / setCustomBaseUrl()", () => {
  it("returns empty string when no custom URL is set", () => {
    expect(getCustomBaseUrl()).toBe("");
  });

  it("setCustomBaseUrl stores the URL", () => {
    setCustomBaseUrl("https://custom-provider.example.com/v1");
    expect(localStorage.getItem("apexstudios_custom_base_url")).toBe(
      "https://custom-provider.example.com/v1"
    );
  });

  it("getCustomBaseUrl retrieves the stored URL", () => {
    setCustomBaseUrl("https://my-ai.example.org/api");
    expect(getCustomBaseUrl()).toBe("https://my-ai.example.org/api");
  });

  it("overwrites previous custom URL", () => {
    setCustomBaseUrl("https://old-url.com");
    setCustomBaseUrl("https://new-url.com");
    expect(getCustomBaseUrl()).toBe("https://new-url.com");
  });

  it("custom provider's baseUrl getter reads from localStorage", () => {
    setCustomBaseUrl("https://my-custom.ai");
    const provider = getCurrentProvider();
    // Switch to custom provider to trigger its baseUrl getter
    setCurrentProvider("custom");
    const customProvider = getCurrentProvider();
    expect(customProvider.baseUrl).toBe("https://my-custom.ai");
  });
});

// ---------------------------------------------------------------------------
// Integration: Full provider round-trip
// ---------------------------------------------------------------------------
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

  it("legacy muapi_key backward compat keys are kept in sync after save", () => {
    saveApiKey("muapi", "sync-test-key");
    expect(localStorage.getItem("muapi_key")).toBe("sync-test-key");
    expect(localStorage.getItem("apexstudios_api_key_muapi")).toBe(
      "sync-test-key"
    );
  });
});
