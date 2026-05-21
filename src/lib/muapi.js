import {
  getModelById,
  getVideoModelById,
  getI2IModelById,
  getI2VModelById,
  getV2VModelById,
  getLipSyncModelById,
} from "./models.js";

export class MuapiClient {
  constructor() {
    // Ideally user provides this in settings
    this.baseUrl = import.meta.env.DEV ? "" : "https://api.muapi.ai";
  }

  getKey() {
    const provider =
      localStorage.getItem("apexstudios_api_provider") || "muapi";
    const key =
      window.__MUAPI_KEY__ ||
      localStorage.getItem(`apexstudios_api_key_${provider}`) ||
      localStorage.getItem("muapi_key"); // backward compat
    if (!key) throw new Error("API Key missing. Please set it in Settings.");
    return key;
  }

  /**
   * Generates an image (Text-to-Image or Image-to-Image)
   * @param {Object} params
   * @param {string} params.model
   * @param {string} params.prompt
   * @param {string} params.negative_prompt
   * @param {string} params.aspect_ratio
   * @param {number} params.steps
   * @param {number} params.guidance_scale
   * @param {number} params.seed
   * @param {string} [params.image_url] - If present, treats as Image-to-Image
   */
  async generateImage(params) {
    const key = this.getKey();

    // Resolve endpoint from model definition
    const modelInfo = getModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const url = `${this.baseUrl}/api/v1/${endpoint}`;

    // Build payload matching the API's expected format
    const finalPayload = {
      prompt: params.prompt,
    };

    // Aspect ratio (send as string, the API handles it)
    if (params.aspect_ratio) {
      finalPayload.aspect_ratio = params.aspect_ratio;
    }

    // Resolution
    if (params.resolution) {
      finalPayload.resolution = params.resolution;
    }

    // Quality (used by seedream and similar models)
    if (params.quality) {
      finalPayload.quality = params.quality;
    }

    // Image-to-Image
    if (params.image_url) {
      finalPayload.image_url = params.image_url;
      finalPayload.strength = params.strength || 0.6;
    } else {
      finalPayload.image_url = null;
    }

    // Optional params if supported by model
    if (params.seed && params.seed !== -1) {
      finalPayload.seed = params.seed;
    }

    console.log("[Muapi] Requesting:", url);
    console.log("[Muapi] Payload:", finalPayload);

    try {
      // Step 1: Submit the task
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[Muapi] API Error Body:", errText);
        throw new Error(
          `API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`,
        );
      }

      const submitData = await response.json();
      console.log("[Muapi] Submit Response:", submitData);

      // Extract request_id for polling
      const requestId = submitData.request_id || submitData.id;
      if (!requestId) {
        // Some endpoints return the result directly
        return submitData;
      }

      // Notify caller of requestId so they can persist it before polling begins
      if (params.onRequestId) params.onRequestId(requestId);

      // Step 2: Poll for results
      console.log("[Muapi] Polling for results, request_id:", requestId);
      const result = await this.pollForResult(requestId, key);

      // Normalize: extract image URL from outputs array
      const imageUrl = result.outputs?.[0] || result.url || result.output?.url;
      console.log("[Muapi] Image URL:", imageUrl);
      return { ...result, url: imageUrl };
    } catch (error) {
      console.error("Muapi Client Error:", error);
      throw error;
    }
  }

  /**
   * Polls the predictions endpoint until the result is ready.
   * @param {string} requestId - The request ID from the submit response
   * @param {string} key - The API key
   * @param {number} maxAttempts - Maximum polling attempts (default 60 = ~2 min)
   * @param {number} interval - Polling interval in ms (default 2000)
   */
  async pollForResult(requestId, key, maxAttempts = 60, interval = 2000) {
    const pollUrl = `${this.baseUrl}/api/v1/predictions/${requestId}/result`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      console.log(`[Muapi] Polling attempt ${attempt}/${maxAttempts}...`);

      try {
        const response = await fetch(pollUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[Muapi] Poll error (${response.status}):`, errText);
          // Continue polling on non-fatal errors
          if (response.status >= 500) continue;
          throw new Error(
            `Poll Failed: ${response.status} - ${errText.slice(0, 100)}`,
          );
        }

        const data = await response.json();
        console.log("[Muapi] Poll Response:", data);

        const status = data.status?.toLowerCase();

        if (
          status === "completed" ||
          status === "succeeded" ||
          status === "success"
        ) {
          return data;
        }

        if (status === "failed" || status === "error") {
          throw new Error(
            `Generation failed: ${data.error || "Unknown error"}`,
          );
        }

        // Otherwise (processing, pending, etc.) keep polling
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        console.warn("[Muapi] Poll attempt failed, retrying...", error.message);
      }
    }

    throw new Error("Generation timed out after polling.");
  }

  async generateVideo(params) {
    const key = this.getKey();

    const modelInfo = getVideoModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const url = `${this.baseUrl}/api/v1/${endpoint}`;

    const finalPayload = {};

    if (params.prompt) finalPayload.prompt = params.prompt;
    if (params.request_id) finalPayload.request_id = params.request_id;
    if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
    if (params.duration) finalPayload.duration = params.duration;
    if (params.resolution) finalPayload.resolution = params.resolution;
    if (params.quality) finalPayload.quality = params.quality;
    if (params.mode) finalPayload.mode = params.mode;
    if (params.image_url) finalPayload.image_url = params.image_url;

    console.log("[Muapi] Video Request:", url);
    console.log("[Muapi] Video Payload:", finalPayload);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[Muapi] API Error Body:", errText);
        throw new Error(
          `API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`,
        );
      }

      const submitData = await response.json();
      console.log("[Muapi] Video Submit Response:", submitData);

      const requestId = submitData.request_id || submitData.id;
      if (!requestId) return submitData;

      if (params.onRequestId) params.onRequestId(requestId);

      console.log("[Muapi] Polling for video results, request_id:", requestId);
      const result = await this.pollForResult(requestId, key, 900, 2000);

      const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
      console.log("[Muapi] Video URL:", videoUrl);
      return { ...result, url: videoUrl };
    } catch (error) {
      console.error("Muapi Video Client Error:", error);
      throw error;
    }
  }

  /**
   * Generates an image using an Image-to-Image model.
   * The model's imageField determines which payload key receives the uploaded image URL.
   * @param {Object} params
   * @param {string} params.model - i2iModel id
   * @param {string} params.image_url - The uploaded reference image URL
   * @param {string} [params.prompt] - Optional text prompt
   * @param {string} [params.aspect_ratio]
   * @param {string} [params.resolution]
   */
  async generateI2I(params) {
    const key = this.getKey();
    const modelInfo = getI2IModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const url = `${this.baseUrl}/api/v1/${endpoint}`;

    const finalPayload = {};

    // Only include prompt if the model supports it and one was provided
    finalPayload.prompt = params.prompt || "";

    // Place the uploaded image(s) in the correct field for this model
    const imageField = modelInfo?.imageField || "image_url";
    const imagesList =
      params.images_list?.length > 0
        ? params.images_list
        : params.image_url
          ? [params.image_url]
          : null;
    if (imagesList) {
      if (imageField === "images_list") {
        finalPayload.images_list = imagesList;
      } else {
        finalPayload[imageField] = imagesList[0];
      }
    }

    if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
    if (params.resolution) finalPayload.resolution = params.resolution;
    if (params.quality) finalPayload.quality = params.quality;

    console.log("[Muapi] I2I Request:", url);
    console.log("[Muapi] I2I Payload:", finalPayload);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`,
        );
      }

      const submitData = await response.json();
      console.log("[Muapi] I2I Submit Response:", submitData);

      const requestId = submitData.request_id || submitData.id;
      if (!requestId) return submitData;

      if (params.onRequestId) params.onRequestId(requestId);

      const result = await this.pollForResult(requestId, key);
      const imageUrl = result.outputs?.[0] || result.url || result.output?.url;
      console.log("[Muapi] I2I Result URL:", imageUrl);
      return { ...result, url: imageUrl };
    } catch (error) {
      console.error("Muapi I2I Error:", error);
      throw error;
    }
  }

  /**
   * Generates a video using an Image-to-Video model.
   * @param {Object} params
   * @param {string} params.model - i2vModel id
   * @param {string} params.image_url - The uploaded start frame image URL
   * @param {string} [params.prompt]
   * @param {string} [params.aspect_ratio]
   * @param {string} [params.resolution]
   * @param {number} [params.duration]
   * @param {string} [params.quality]
   */
  async generateI2V(params) {
    const key = this.getKey();
    const modelInfo = getI2VModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const url = `${this.baseUrl}/api/v1/${endpoint}`;

    const finalPayload = {};

    if (params.prompt) finalPayload.prompt = params.prompt;

    // Place image in the correct field for this model
    const imageField = modelInfo?.imageField || "image_url";
    if (params.image_url) {
      if (imageField === "images_list") {
        finalPayload.images_list = [params.image_url];
      } else {
        finalPayload[imageField] = params.image_url;
      }
    }

    if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
    if (params.duration) finalPayload.duration = params.duration;
    if (params.resolution) finalPayload.resolution = params.resolution;
    if (params.quality) finalPayload.quality = params.quality;
    if (params.mode) finalPayload.mode = params.mode;
    if (params.name) finalPayload.name = params.name;

    console.log("[Muapi] I2V Request:", url);
    console.log("[Muapi] I2V Payload:", finalPayload);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`,
        );
      }

      const submitData = await response.json();
      console.log("[Muapi] I2V Submit Response:", submitData);

      const requestId = submitData.request_id || submitData.id;
      if (!requestId) return submitData;

      if (params.onRequestId) params.onRequestId(requestId);

      const result = await this.pollForResult(requestId, key, 900, 2000);
      const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
      console.log("[Muapi] I2V Result URL:", videoUrl);
      return { ...result, url: videoUrl };
    } catch (error) {
      console.error("Muapi I2V Error:", error);
      throw error;
    }
  }

  /**
   * Uploads a file to muapi and returns the hosted URL.
   * @param {File} file - The image file to upload
   * @returns {Promise<string>} The hosted URL of the uploaded file
   */
  async uploadFile(file) {
    const key = this.getKey();
    const url = `${this.baseUrl}/api/v1/upload_file`;

    const formData = new FormData();
    formData.append("file", file);

    console.log("[Muapi] Uploading file:", file.name);

    const response = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": key },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `File upload failed: ${response.status} - ${errText.slice(0, 100)}`,
      );
    }

    const data = await response.json();
    console.log("[Muapi] Upload response:", data);

    const fileUrl = data.url || data.file_url || data.data?.url;
    if (!fileUrl) throw new Error("No URL returned from file upload");
    return fileUrl;
  }

  /**
   * Processes a video through a Video-to-Video model (e.g. watermark remover).
   * @param {Object} params
   * @param {string} params.model - v2vModel id
   * @param {string} params.video_url - The uploaded video URL
   */
  async processV2V(params) {
    const key = this.getKey();
    const modelInfo = getV2VModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const url = `${this.baseUrl}/api/v1/${endpoint}`;

    const videoField = modelInfo?.videoField || "video_url";
    const finalPayload = { [videoField]: params.video_url };

    console.log("[Muapi] V2V Request:", url);
    console.log("[Muapi] V2V Payload:", finalPayload);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`,
        );
      }

      const submitData = await response.json();
      console.log("[Muapi] V2V Submit Response:", submitData);

      const requestId = submitData.request_id || submitData.id;
      if (!requestId) return submitData;

      if (params.onRequestId) params.onRequestId(requestId);

      const result = await this.pollForResult(requestId, key, 900, 2000);
      const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
      console.log("[Muapi] V2V Result URL:", videoUrl);
      return { ...result, url: videoUrl };
    } catch (error) {
      console.error("Muapi V2V Error:", error);
      throw error;
    }
  }

  /**
   * Processes lipsync / speech-to-video generation.
   * Supports image+audio → video and video+audio → video models.
   * @param {Object} params
   * @param {string} params.model - lipsyncModel id
   * @param {string} [params.image_url] - Portrait image URL (image-based models)
   * @param {string} [params.video_url] - Source video URL (video-based models)
   * @param {string} params.audio_url - Audio file URL
   * @param {string} [params.prompt] - Optional prompt (for models that support it)
   * @param {string} [params.resolution] - Output resolution
   * @param {number} [params.seed] - Optional seed (-1 for random)
   * @param {Function} [params.onRequestId] - Called when request_id is received
   */
  async processLipSync(params) {
    const key = this.getKey();
    const modelInfo = getLipSyncModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const url = `${this.baseUrl}/api/v1/${endpoint}`;

    const finalPayload = {};

    if (params.audio_url) finalPayload.audio_url = params.audio_url;
    if (params.image_url) finalPayload.image_url = params.image_url;
    if (params.video_url) finalPayload.video_url = params.video_url;
    if (modelInfo?.hasPrompt) finalPayload.prompt = params.prompt || "";
    if (params.resolution) finalPayload.resolution = params.resolution;
    if (params.seed !== undefined && params.seed !== -1)
      finalPayload.seed = params.seed;

    console.log("[Muapi] LipSync Request:", url);
    console.log("[Muapi] LipSync Payload:", finalPayload);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[Muapi] LipSync API Error:", errText);
        throw new Error(
          `API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`,
        );
      }

      const submitData = await response.json();
      console.log("[Muapi] LipSync Submit Response:", submitData);

      const requestId = submitData.request_id || submitData.id;
      if (!requestId) return submitData;

      if (params.onRequestId) params.onRequestId(requestId);

      const result = await this.pollForResult(requestId, key, 900, 2000);
      const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
      console.log("[Muapi] LipSync Result URL:", videoUrl);
      return { ...result, url: videoUrl };
    } catch (error) {
      console.error("Muapi LipSync Error:", error);
      throw error;
    }
  }

  /**
   * Fetches available models from the API based on the current API key
   * @returns {Promise<Object>} Object containing different model categories
   */
  async fetchModelIds() {
    const key = this.getKey();
    const url = `${this.baseUrl}/api/v1/models`;

    console.log("[Muapi] Fetching available models from:", url);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[Muapi] Models API Error:", errText);
        throw new Error(
          `Failed to fetch models: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`,
        );
      }

      const modelsData = await response.json();
      console.log("[Muapi] Models Response:", modelsData);

      // Normalize the response to match expected structure
      const normalized = {
        t2iModels: modelsData.text_to_image || [],
        t2vModels: modelsData.text_to_video || [],
        i2iModels: modelsData.image_to_image || [],
        i2vModels: modelsData.image_to_video || [],
        v2vModels: modelsData.video_to_video || [],
        lipsyncModels: modelsData.lip_sync || [],
      };

      return normalized;
    } catch (error) {
      console.error("Muapi fetchModelIds Error:", error);
      throw error;
    }
  }

  getDimensionsFromAR(ar) {
    // Base unit 1024 (Flux standard)
    switch (ar) {
      case "1:1":
        return [1024, 1024];
      case "16:9":
        return [1280, 720]; // 1024*1024 area approx
      case "9:16":
        return [720, 1280];
      case "4:3":
        return [1152, 864];
      case "3:2":
        return [1216, 832];
      case "21:9":
        return [1536, 640];
      default:
        return [1024, 1024];
    }
  }
}

// ── Standalone fetchModels (mirrors packages/studio/src/muapi.js API) ─────────
// Allows vanilla-JS components to fetch model catalogs without using the class.
export async function fetchModels(apiKey) {
  const m = new MuapiClient();
  return m.fetchModelIds();
}

export const muapi = new MuapiClient();

// ── Provider-aware helpers ────────────────────────────────────────────────────
// Mirrors the same API as packages/studio/src/muapi.js so that vanilla-JS
// components (e.g. SettingsModal) can use the same abstraction without
// importing from the React package.

const PROVIDER_DEFINITIONS = {
  muapi: {
    id: "muapi",
    name: "MuAPI",
    authHeader: "x-api-key",
    authPrefix: "",
  },
  alibaba: {
    id: "alibaba",
    name: "Alibaba Cloud (DashScope)",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  replicate: {
    id: "replicate",
    name: "Replicate",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  huggingface: {
    id: "huggingface",
    name: "HuggingFace Inference",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  stability: {
    id: "stability",
    name: "Stability AI",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
  },
  custom: {
    id: "custom",
    name: "Custom Provider",
    authHeader: "x-api-key",
    authPrefix: "",
  },
};

export function getAvailableProviders() {
  return Object.values(PROVIDER_DEFINITIONS).map(({ id, name }) => ({
    id,
    name,
  }));
}

export function getCurrentProvider() {
  const id = localStorage.getItem("apexstudios_api_provider") || "muapi";
  return PROVIDER_DEFINITIONS[id] || PROVIDER_DEFINITIONS.muapi;
}

export function setCurrentProvider(providerId) {
  if (PROVIDER_DEFINITIONS[providerId]) {
    localStorage.setItem("apexstudios_api_provider", providerId);
    return true;
  }
  return false;
}

export function getApiKey(providerId) {
  const id = providerId || getCurrentProvider().id || "muapi";
  const key = localStorage.getItem(`apexstudios_api_key_${id}`);
  if (!key && id === "muapi") return localStorage.getItem("muapi_key"); // backward compat
  return key;
}

export function saveApiKey(providerId, key) {
  const id = providerId || "muapi";
  localStorage.setItem(`apexstudios_api_key_${id}`, key);
  if (id === "muapi") localStorage.setItem("muapi_key", key); // keep legacy key in sync
}

export function getCustomBaseUrl() {
  return localStorage.getItem("apexstudios_custom_base_url") || "";
}

export function setCustomBaseUrl(url) {
  localStorage.setItem("apexstudios_custom_base_url", url);
}
