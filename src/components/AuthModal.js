import {
  getAvailableProviders,
  setCurrentProvider,
  getApiKey,
  saveApiKey,
  getCurrentProvider,
  getCustomBaseUrl,
  setCustomBaseUrl,
} from "../lib/muapi.js";
import { globalModelManager } from "../lib/globalModelManager.js";

export function AuthModal(onSuccess) {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6";

  const modal = document.createElement("div");
  modal.className =
    "w-full max-w-md bg-panel-bg border border-white/10 rounded-3xl p-8 shadow-3xl animate-fade-in-up";

  const availableProviders = (() => {
    try {
      return getAvailableProviders();
    } catch (e) {
      return [
        { id: "muapi", name: "MuAPI" },
        { id: "openai", name: "OpenAI" },
        { id: "replicate", name: "Replicate" },
      ];
    }
  })();

  const currentProviderId = (() => {
    try {
      return getCurrentProvider().id || "muapi";
    } catch (e) {
      return "muapi";
    }
  })();

  const providerOptions = availableProviders
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === currentProviderId ? "selected" : ""}>${p.name}</option>`,
    )
    .join("");

  const currentKey = (() => {
    try {
      return getApiKey(currentProviderId) || "";
    } catch (e) {
      return localStorage.getItem("muapi_key") || "";
    }
  })();

  const currentCustomUrl = (() => {
    try {
      return getCustomBaseUrl() || "";
    } catch (e) {
      return "";
    }
  })();

  modal.innerHTML = `
    <div class="flex flex-col items-center text-center mb-8">
      <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-glow mb-6 group transition-all duration-300 hover:scale-110 hover:shadow-glow-accent">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.5" class="transition-transform duration-300 group-hover:rotate-12">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l-2.25-2.25"/>
        </svg>
      </div>
      <h2 class="text-2xl font-black text-white uppercase tracking-wider mb-2">Welcome to ApexStudios</h2>
      <p class="text-secondary text-sm leading-relaxed max-w-xs">Connect your API provider to start generating images, videos, and more.</p>
    </div>

    <div class="space-y-5">
      <div class="space-y-2">
        <label class="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">API Provider</label>
        <select id="auth-api-provider"
          class="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all duration-200 cursor-pointer appearance-none"
          style="background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 1rem center; padding-right: 2.5rem;">
          ${providerOptions}
        </select>
      </div>

      <div id="auth-custom-url-row" style="display:${currentProviderId === "custom" ? "block" : "none"};" class="space-y-2 animate-fade-in-up">
        <label class="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Base URL</label>
        <input id="auth-custom-url" type="url"
          class="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-all duration-200"
          placeholder="https://your-api-server.example.com/v1"
          value="${currentCustomUrl}">
      </div>

      <div class="space-y-2">
        <label id="auth-key-label" class="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">API Key</label>
        <input 
          type="password" 
          id="auth-api-key"
          placeholder="Enter your API key..."
          value="${currentKey}"
          class="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-all duration-200 shadow-inner"
        >
      </div>

      <div class="flex flex-col gap-3 pt-2">
        <button id="save-key-btn" class="w-full bg-primary text-white font-black py-4 rounded-2xl hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 relative overflow-hidden group/btn">
          <span class="relative z-10">Initialize Studio</span>
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
        </button>
        <a id="auth-provider-link" href="https://muapi.ai" target="_blank" class="text-center text-[11px] font-bold text-muted hover:text-white transition-colors py-2 uppercase tracking-tighter">
          Get an API Key →
        </a>
      </div>
      
      <div id="auth-error-msg" class="hidden text-xs text-red-400 font-bold text-center"></div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const input = modal.querySelector("#auth-api-key");
  const btn = modal.querySelector("#save-key-btn");
  const providerSelect = modal.querySelector("#auth-api-provider");
  const customUrlRow = modal.querySelector("#auth-custom-url-row");
  const customUrlInput = modal.querySelector("#auth-custom-url");
  const keyLabel = modal.querySelector("#auth-key-label");
  const providerLink = modal.querySelector("#auth-provider-link");

  const PROVIDER_LINKS = {
    muapi: "https://muapi.ai/access-keys",
    alibaba: "https://dashscope.console.aliyun.com/",
    openai: "https://platform.openai.com/api-keys",
    replicate: "https://replicate.com/account/api-tokens",
    huggingface: "https://huggingface.co/settings/tokens",
    stability: "https://platform.stability.ai/account/keys",
    custom: null,
  };

  // Update label and link when provider changes
  providerSelect.addEventListener("change", (e) => {
    const newProvider = e.target.value;
    setCurrentProvider(newProvider);

    const providerName =
      availableProviders.find((p) => p.id === newProvider)?.name || "API";
    keyLabel.textContent = `${providerName} Key`;

    customUrlRow.style.display = newProvider === "custom" ? "block" : "none";

    const link = PROVIDER_LINKS[newProvider];
    if (link) {
      providerLink.href = link;
      providerLink.textContent = `Get a ${providerName} Key →`;
      providerLink.style.display = "block";
    } else {
      providerLink.style.display = "none";
    }

    try {
      const savedKey = getApiKey(newProvider);
      input.value = savedKey || "";
    } catch (_) {}
  });

  // Focus input on load
  setTimeout(() => input.focus(), 300);

  // Enter key submits
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });

  const showError = (msg) => {
    const errEl = modal.querySelector("#auth-error-msg");
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
    errEl.classList.add("animate-fade-in-up");
    input.classList.add("border-red-500/50");
    setTimeout(() => {
      input.classList.remove("border-red-500/50");
    }, 2000);
  };

  btn.onclick = async () => {
    const providerId = providerSelect.value;
    const key = input.value.trim();
    const customUrl = customUrlInput?.value.trim() || "";

    if (!key) {
      showError("Please enter a valid API key.");
      return;
    }
    if (providerId === "custom" && !customUrl) {
      showError("Please enter the base URL for your custom provider.");
      return;
    }

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = `
      <span class="relative z-10 flex items-center justify-center gap-2">
        <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        Connecting...
      </span>
    `;

    try {
      // Persist the key and settings
      saveApiKey(providerId, key);
      if (providerId === "custom") setCustomBaseUrl(customUrl);
      setCurrentProvider(providerId);

      // Try to validate the key by fetching models
      try {
        await globalModelManager.loadModelsFromAPI();
      } catch (modelErr) {
        // Non-critical - models will use fallback
        console.warn("Model fetch failed on init:", modelErr);
      }

      // Remove overlay with fade-out
      overlay.style.transition = "opacity 0.3s ease";
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        if (onSuccess) onSuccess();
      }, 300);
    } catch (err) {
      showError(`Connection failed: ${err.message || "Unknown error"}`);
      btn.disabled = false;
      btn.innerHTML =
        '<span class="relative z-10">Initialize Studio</span>';
    }
  };

  // Click outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.style.transition = "opacity 0.2s ease";
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      }, 200);
    }
  });

  return overlay;
}
