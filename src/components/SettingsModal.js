import { LocalModelManager } from "./LocalModelManager.js";
import { isLocalAIAvailable } from "../lib/localInferenceClient.js";
import { globalModelManager } from "../lib/globalModelManager.js";
import {
  getAvailableProviders,
  setCurrentProvider,
  getApiKey,
  saveApiKey,
  getCurrentProvider,
  getCustomBaseUrl,
  setCustomBaseUrl,
} from "../lib/muapi.js";

export function SettingsModal(onClose) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:100;";

  const modal = document.createElement("div");
  modal.style.cssText =
    "background:var(--bg-card,#111);border-radius:1rem;border:1px solid rgba(255,255,255,0.08);width:min(90vw,36rem);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;";

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;";
  header.innerHTML = `
        <h2 style="font-size:1rem;font-weight:800;color:#fff;margin:0;">Settings</h2>
        <button id="settings-close-btn" style="color:rgba(255,255,255,0.4);background:none;border:none;cursor:pointer;padding:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;
  modal.appendChild(header);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id: "api", label: "API Key" },
    ...(isLocalAIAvailable() ? [{ id: "local", label: "Local Models" }] : []),
  ];

  let activeTab = "api";

  const tabBar = document.createElement("div");
  tabBar.style.cssText =
    "display:flex;gap:0.25rem;padding:0.75rem 1.5rem 0;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;";

  const tabBtns = {};
  TABS.forEach(({ id, label }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText =
      "padding:0.4rem 0.75rem;border-radius:0.5rem 0.5rem 0 0;font-size:0.75rem;font-weight:700;border:none;cursor:pointer;transition:all 0.15s;";
    btn.onclick = () => switchTab(id);
    tabBtns[id] = btn;
    tabBar.appendChild(btn);
  });
  modal.appendChild(tabBar);

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = document.createElement("div");
  body.style.cssText = "flex:1;overflow-y:auto;padding:1.5rem;";
  modal.appendChild(body);

  // ── Tab: API Key ──────────────────────────────────────────────────────────
  const apiPanel = document.createElement("div");

  const availableProviders = (() => {
    try {
      return getAvailableProviders();
    } catch (e) {
      return [{ id: "muapi", name: "MuAPI" }];
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

  apiPanel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <div>
                <label style="display:block;font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:0.4rem;font-weight:600;">API Provider</label>
                <select id="settings-api-provider"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.6rem 0.9rem;color:#fff;font-size:0.875rem;outline:none;cursor:pointer;">
                    ${providerOptions}
                </select>
            </div>
            <div id="settings-custom-url-row" style="display:${currentProviderId === "custom" ? "block" : "none"};">
                <label style="display:block;font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:0.4rem;font-weight:600;">Base URL</label>
                <input id="settings-custom-url" type="url"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.6rem 0.9rem;color:#fff;font-size:0.875rem;outline:none;"
                    placeholder="https://your-api-server.example.com/v1"
                    value="${currentCustomUrl}">
            </div>
            <div>
                <label id="settings-key-label" style="display:block;font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:0.4rem;font-weight:600;">API Key</label>
                <input id="settings-api-key" type="password"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.6rem 0.9rem;color:#fff;font-size:0.875rem;outline:none;"
                    placeholder="Enter your API key..."
                    value="${currentKey}">
            </div>
            <p style="font-size:0.7rem;color:rgba(255,255,255,0.3);margin:0;">
                Your API key is stored locally in your browser and never shared.
            </p>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.5rem;">
                <button id="settings-cancel-btn" style="padding:0.5rem 1rem;border-radius:0.5rem;background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font-size:0.75rem;font-weight:700;cursor:pointer;">Cancel</button>
                <button id="settings-save-btn" style="padding:0.5rem 1rem;border-radius:0.5rem;background:var(--color-primary,#2563eb);color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;border:none;">Save</button>
            </div>
        </div>
    `;

  // Wire up provider selector so the key input & custom URL row update live
  apiPanel
    .querySelector("#settings-api-provider")
    .addEventListener("change", (e) => {
      const newProvider = e.target.value;
      setCurrentProvider(newProvider);

      const customRow = apiPanel.querySelector("#settings-custom-url-row");
      customRow.style.display = newProvider === "custom" ? "block" : "none";

      const keyLabel = apiPanel.querySelector("#settings-key-label");
      const providerName =
        availableProviders.find((p) => p.id === newProvider)?.name || "API";
      keyLabel.textContent = `${providerName} Key`;

      try {
        const savedKey = getApiKey(newProvider);
        apiPanel.querySelector("#settings-api-key").value = savedKey || "";
      } catch (_) {}
    });

  // ── Tab: Local Models ─────────────────────────────────────────────────────
  const localPanel = LocalModelManager();

  // ── Tab switching ─────────────────────────────────────────────────────────
  const switchTab = (id) => {
    activeTab = id;
    body.innerHTML = "";

    TABS.forEach(({ id: tid }) => {
      const btn = tabBtns[tid];
      if (tid === id) {
        btn.style.background = "rgba(255,255,255,0.08)";
        btn.style.color = "#fff";
      } else {
        btn.style.background = "transparent";
        btn.style.color = "rgba(255,255,255,0.4)";
      }
    });

    if (id === "api") body.appendChild(apiPanel);
    if (id === "local") body.appendChild(localPanel);
  };

  switchTab("api");

  // ── API key save/cancel handlers ──────────────────────────────────────────
  const close = () => {
    if (document.body.contains(overlay)) document.body.removeChild(overlay);
    if (onClose) onClose();
  };

  apiPanel.querySelector("#settings-cancel-btn").onclick = close;
  apiPanel.querySelector("#settings-save-btn").onclick = async () => {
    const providerId = apiPanel.querySelector("#settings-api-provider").value;
    const key = apiPanel.querySelector("#settings-api-key").value.trim();
    const customUrl =
      apiPanel.querySelector("#settings-custom-url")?.value.trim() || "";

    if (!key) {
      alert("Please enter a valid API key.");
      return;
    }
    if (providerId === "custom" && !customUrl) {
      alert("Please enter the base URL for your custom provider.");
      return;
    }

    // Persist via the provider-aware helpers
    try {
      saveApiKey(providerId, key);
      if (providerId === "custom") setCustomBaseUrl(customUrl);
      setCurrentProvider(providerId);
    } catch (err) {
      // Fallback: at least keep the legacy key working
      localStorage.setItem("muapi_key", key);
    }

    // Refresh models after saving API key
    try {
      await globalModelManager.loadModelsFromAPI();
      console.log("Models refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh models:", error);
      // Don't show error to user, models will use fallback
    }

    close();
  };

  header.querySelector("#settings-close-btn").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  overlay.appendChild(modal);
  return overlay;
}
