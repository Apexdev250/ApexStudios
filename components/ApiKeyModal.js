"use client";

import { useState, useEffect } from "react";
import {
  getAvailableProviders,
  setCurrentProvider,
  getApiKey,
  saveApiKey,
  getCustomBaseUrl,
  setCustomBaseUrl,
} from "studio";

export default function ApiKeyModal({ onSave }) {
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState("muapi");
  const [customBaseUrl, setCustomBaseUrl_] = useState("");
  const [error, setError] = useState("");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const availableProviders = getAvailableProviders();
      setProviders(availableProviders);

      // Set saved provider or default to first available
      const savedProvider = localStorage.getItem("apexstudios_api_provider");
      const activeProvider =
        savedProvider && availableProviders.find((p) => p.id === savedProvider)
          ? savedProvider
          : availableProviders[0]?.id || "muapi";

      setProvider(activeProvider);
      setCurrentProvider(activeProvider);

      // Pre-fill existing key and custom URL
      const savedKey = getApiKey(activeProvider);
      if (savedKey) setKey(savedKey);
      setCustomBaseUrl_(getCustomBaseUrl());
    } catch (err) {
      console.error("Failed to load providers:", err);
      setProviders([{ id: "muapi", name: "MuAPI" }]);
      setProvider("muapi");
      setCurrentProvider("muapi");
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    setCurrentProvider(newProvider);
    // Pre-fill the saved key for this provider (if any)
    const savedKey = getApiKey(newProvider);
    setKey(savedKey || "");
    setError("");
  };

  const PROVIDER_LINKS = {
    muapi: "https://muapi.ai/access-keys",
    alibaba: "https://dashscope.console.aliyun.com/",
    openai: "https://platform.openai.com/api-keys",
    replicate: "https://replicate.com/account/api-tokens",
    huggingface: "https://huggingface.co/settings/tokens",
    stability: "https://platform.stability.ai/account/keys",
    custom: null,
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter your API key");
      return;
    }
    if (provider === "custom" && !customBaseUrl.trim()) {
      setError("Please enter the base URL for your custom provider");
      return;
    }
    // Persist key (and custom URL) into localStorage via the studio helpers
    saveApiKey(provider, trimmed);
    if (provider === "custom") setCustomBaseUrl(customBaseUrl.trim());
    onSave(trimmed, provider);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 font-inter">
        <div className="w-full max-w-sm bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/10 rounded-xl p-10 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-blue-600/5 rounded-2xl flex items-center justify-center border border-blue-500/10">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="1.5"
              >
                <path
                  d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mb-2">
              ApexStudios
            </h1>
            <p className="text-white/40 text-[13px] leading-relaxed px-4">
              Loading providers...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 font-inter">
      <div className="w-full max-w-sm bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/10 rounded-xl p-10 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-14 h-14 bg-blue-600/5 rounded-2xl flex items-center justify-center border border-blue-500/10 mb-6 group hover:border-blue-500/30 transition-colors">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.5"
              className="group-hover:scale-110 transition-transform"
            >
              <path
                d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-2">
            ApexStudios
          </h1>
          <p className="text-white/40 text-[13px] leading-relaxed px-4">
            Enter your API key to start creating
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label className="block text-xs font-bold text-white/30 ml-1">
              API Provider
            </label>
            <select
              value={provider}
              onChange={handleProviderChange}
              className="w-full bg-white/5 border border-white/[0.03] rounded-md px-5 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.07] transition-all"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {provider === "custom" && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white/30 ml-1">
                Base URL
              </label>
              <input
                type="url"
                value={customBaseUrl}
                onChange={(e) => {
                  setCustomBaseUrl_(e.target.value);
                  setError("");
                }}
                placeholder="https://your-api-server.example.com/v1"
                className="w-full bg-white/5 border border-white/[0.03] rounded-md px-5 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.07] transition-all"
                suppressHydrationWarning
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-white/30 ml-1">
              API Access Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError("");
              }}
              placeholder="Paste your key here..."
              className="w-full bg-white/5 border border-white/[0.03] rounded-md px-5 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.07] transition-all"
              suppressHydrationWarning
            />
            {error && (
              <p className="mt-2 text-red-500/80 text-[11px] font-medium ml-1">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-md hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
            suppressHydrationWarning
          >
            Get Started
          </button>

          {PROVIDER_LINKS[provider] && (
            <p className="text-center text-[12px] text-white/20 pt-2">
              Need a key?{" "}
              <a
                href={PROVIDER_LINKS[provider]}
                target="_blank"
                rel="noreferrer"
                className="text-white/40 hover:text-blue-400 transition-colors font-medium"
              >
                Get one here →
              </a>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
