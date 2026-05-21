import { getModelById, getVideoModelById, getI2IModelById, getI2VModelById, getV2VModelById, getLipSyncModelById } from './models.js';

// Provider configurations
const PROVIDERS = {
  muapi: {
    id: 'muapi',
    name: 'MuAPI',
    baseUrl: 'https://api.muapi.ai',
    authHeader: 'x-api-key',
    authPrefix: '',
    keyStorageKey: 'apexstudios_api_key_muapi',
    proxyWfBase: '/api/workflow',
    endpoints: {
      pollResult: '/api/v1/predictions/{requestId}/result',
      submit: '/api/v1/{endpoint}',
      uploadFile: '/api/v1/upload_file',
      balance: '/api/v1/account/balance',
      templateWorkflows: '/workflow/get-template-workflows',
      userWorkflows: '/workflow/get-workflow-defs',
      publishedWorkflows: '/workflow/get-published-workflows',
      templateAgents: '/agents/templates/agents',
      userAgents: '/agents/user/agents',
      publishedAgents: '/agents/featured/agents',
      userConversations: '/agents/user/conversations',
      createWorkflow: '/workflow/create',
      updateWorkflowName: '/workflow/update-name/{workflowId}',
      deleteWorkflow: '/workflow/delete-workflow-def/{workflowId}',
      workflowInputs: '/workflow/{workflowId}/api-inputs',
      executeWorkflow: '/workflow/{workflowId}/api-execute',
      workflowResult: '/workflow/run/{runId}/api-outputs',
      nodeSchemas: '/workflow/{workflowId}/node-schemas',
      workflowData: '/workflow/get-workflow-def/{workflowId}',
      apiNodeSchemas: '/workflow/{workflowId}/api-node-schemas',
      runSingleNode: '/workflow/{workflowId}/node/{nodeId}/run',
      deleteNodeRun: '/workflow/node-run/{nodeRunId}',
      nodeStatus: '/workflow/run/{runId}/status',
      dynamicCost: '/api/v1/app/calculate_dynamic_cost',
      registerInterest: '/app/interest',
      getInterests: '/app/interests'
    }
  },
  alibaba: {
    id: 'alibaba',
    name: 'Alibaba Cloud (DashScope)',
    // Generation APIs live under /api/v1/services/... and /api/v1/tasks/...
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    // Model discovery is OpenAI-compatible and lives under /compatible-mode/v1/models
    modelsBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    keyStorageKey: 'apexstudios_api_key_alibaba',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    keyStorageKey: 'apexstudios_api_key_openai',
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    keyStorageKey: 'apexstudios_api_key_replicate',
  },
  huggingface: {
    id: 'huggingface',
    name: 'HuggingFace Inference',
    baseUrl: 'https://api-inference.huggingface.co',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    keyStorageKey: 'apexstudios_api_key_huggingface',
  },
  stability: {
    id: 'stability',
    name: 'Stability AI',
    baseUrl: 'https://api.stability.ai/v2beta',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    keyStorageKey: 'apexstudios_api_key_stability',
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    get baseUrl() {
      return (typeof localStorage !== 'undefined'
        ? localStorage.getItem('apexstudios_custom_base_url')
        : null) || '';
    },
    authHeader: 'x-api-key',
    authPrefix: '',
    keyStorageKey: 'apexstudios_api_key_custom',
  },
};

// Get current provider from localStorage or default to muapi
export function getCurrentProvider() {
  const providerId = (typeof localStorage !== 'undefined'
    ? localStorage.getItem('apexstudios_api_provider')
    : null) || 'muapi';
  return PROVIDERS[providerId] || PROVIDERS.muapi;
}

// Set current provider
export function setCurrentProvider(providerId) {
  if (PROVIDERS[providerId]) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('apexstudios_api_provider', providerId);
    }
    return true;
  }
  return false;
}

// Get available providers
export function getAvailableProviders() {
  return Object.keys(PROVIDERS).map(id => ({
    id,
    name: PROVIDERS[id].name
  }));
}

/**
 * Reads the stored API key for a given provider.
 * Falls back to the legacy 'muapi_key' key for backward compatibility.
 */
export function getApiKey(providerId) {
  if (typeof localStorage === 'undefined') return null;
  const id = providerId || getCurrentProvider().id || 'muapi';
  const storageKey = PROVIDERS[id]?.keyStorageKey || `apexstudios_api_key_${id}`;
  const key = localStorage.getItem(storageKey);
  // Backward-compat: fall back to legacy key for muapi
  if (!key && id === 'muapi') return localStorage.getItem('muapi_key');
  return key;
}

/**
 * Persists the API key for a given provider into localStorage.
 */
export function saveApiKey(providerId, key) {
  if (typeof localStorage === 'undefined') return;
  const id = providerId || 'muapi';
  const storageKey = PROVIDERS[id]?.keyStorageKey || `apexstudios_api_key_${id}`;
  localStorage.setItem(storageKey, key);
  // Keep the legacy key in sync for muapi so older code still works
  if (id === 'muapi') localStorage.setItem('muapi_key', key);
}

/** Returns the base URL configured for the custom provider. */
export function getCustomBaseUrl() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('apexstudios_custom_base_url') || '';
}

/** Persists a custom provider base URL. */
export function setCustomBaseUrl(url) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('apexstudios_custom_base_url', url);
}

// Always route through Next.js proxy to avoid CORS.
// The proxy at /api/api/v1/[[...path]] forwards to the provider's actual API.
const API_PROXY = '/api/api/v1';
const WF_PROXY = '/api/workflow';
const AGENTS_PROXY = '/api/agents';

/**
 * Build headers for ALL proxied API calls.
 * - For MuAPI: sends x-api-key (proxy passes it through)
 * - For OAuth providers (Alibaba, OpenAI, etc.): sends Authorization: Bearer <key>
 * - Passes x-provider-base so the proxy knows where to forward
 */
function buildProxyHeaders(key, includeContentType = true, baseUrlOverride = null) {
  const provider = getCurrentProvider();
  const authHeader = provider.authHeader || 'x-api-key';
  const authPrefix = provider.authPrefix || '';
  const headers = {};
  if (includeContentType) headers['Content-Type'] = 'application/json';
  headers[authHeader] = authPrefix + key;
  const baseUrl = baseUrlOverride || provider.baseUrl;
  if (baseUrl) headers['x-provider-base'] = baseUrl;
  return headers;
}

/**
 * Headers for workflow/agents proxy routes (always MuAPI format).
 * These proxies hardcode MuAPI's base URL, so only x-api-key is needed.
 */
function buildWfHeaders(key) {
  return { 'Content-Type': 'application/json', 'x-api-key': key };
}

async function pollForResult(requestId, key, maxAttempts = 900, interval = 2000) {
  const pollUrl = `${API_PROXY}/predictions/${requestId}/result`;
  const pollHeaders = buildProxyHeaders(key);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    try {
      const response = await fetch(pollUrl, {
        headers: pollHeaders
      });
      if (!response.ok) {
        const errText = await response.text();
        if (response.status >= 500) continue;
        throw new Error(`Poll Failed: ${response.status} - ${errText.slice(0, 100)}`);
      }
      const data = await response.json();
      const status = data.status?.toLowerCase();
      if (status === 'completed' || status === 'succeeded' || status === 'success') return data;
      if (status === 'failed' || status === 'error') throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
    }
  }
  throw new Error('Generation timed out after polling.');
}

export function getAlibabaSize(aspectRatio = '16:9') {
  const sizes = {
    '1:1': '1024*1024',
    '16:9': '1280*720',
    '9:16': '720*1280',
    '4:3': '1024*768',
    '3:4': '768*1024',
  };
  return sizes[aspectRatio] || sizes['16:9'];
}

export function extractAlibabaOutput(data) {
  const output = data?.output || data;
  const results = output?.results || output?.result || [];
  const first = Array.isArray(results) ? results[0] : results;
  return (
    output?.video_url ||
    output?.url ||
    first?.url ||
    first?.video_url ||
    data?.url ||
    data?.output_url ||
    null
  );
}

async function submitAlibabaTask(endpoint, payload, key, onRequestId, maxAttempts = 900) {
  const response = await fetch(`${API_PROXY}/${endpoint}`, {
    method: 'POST',
    headers: {
      ...buildProxyHeaders(key),
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Alibaba API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 160)}`);
  }

  const submitData = await response.json();
  const taskId = submitData.output?.task_id || submitData.task_id || submitData.id;
  if (!taskId) {
    return { ...submitData, url: extractAlibabaOutput(submitData) };
  }

  if (onRequestId) onRequestId(taskId);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const poll = await fetch(`${API_PROXY}/tasks/${taskId}`, {
      headers: buildProxyHeaders(key),
    });
    const data = await poll.json().catch(() => ({}));
    if (!poll.ok) {
      if (poll.status >= 500) continue;
      throw new Error(`Alibaba poll failed: ${poll.status} - ${JSON.stringify(data).slice(0, 160)}`);
    }

    const status = (data.output?.task_status || data.status || '').toUpperCase();
    if (status === 'SUCCEEDED' || status === 'COMPLETED' || status === 'SUCCESS') {
      return { ...data, url: extractAlibabaOutput(data) };
    }
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELED') {
      throw new Error(`Alibaba generation failed: ${data.output?.message || data.message || 'Unknown error'}`);
    }
  }

  throw new Error('Alibaba generation timed out after polling.');
}

async function submitAndPoll(endpoint, payload, key, onRequestId, maxAttempts = 60) {
  const url = `${API_PROXY}/${endpoint}`;
  const headers = buildProxyHeaders(key);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
  }
  const submitData = await response.json();
  const requestId = submitData.request_id || submitData.id;
  if (!requestId) {
    const directUrl = submitData.outputs?.[0] || submitData.url || submitData.output?.url || submitData.data?.[0]?.url || submitData.data?.[0]?.b64_json;
    return { ...submitData, url: directUrl };
  }
  if (onRequestId) onRequestId(requestId);
  const result = await pollForResult(requestId, key, maxAttempts);
  const outputUrl = result.outputs?.[0] || result.url || result.output?.url || result.data?.[0]?.url || result.data?.[0]?.b64_json;
  return { ...result, url: outputUrl };
}

export async function generateImage(apiKey, params) {
  const provider = getCurrentProvider();
  const modelInfo = getModelById(params.model) || params.modelInfo;
  const endpoint = provider.id === 'muapi' ? (modelInfo?.endpoint || params.model) : (modelInfo?.endpoint || 'images/generations');
  const payload = { prompt: params.prompt };
  if (provider.id !== 'muapi') payload.model = modelInfo?.providerModel || params.model;
  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.quality) payload.quality = params.quality;
  if (params.image_url) {
    payload.image_url = params.image_url;
    payload.strength = params.strength || 0.6;
  } else if (params.images_list) {
    payload.images_list = params.images_list;
  } else {
    payload.image_url = null;
  }
  if (params.seed && params.seed !== -1) payload.seed = params.seed;

  if (provider.id === 'alibaba') {
    return submitAlibabaTask('services/aigc/text2image/image-synthesis', {
      model: modelInfo?.providerModel || params.model,
      input: { prompt: params.prompt },
      parameters: { size: getAlibabaSize(params.aspect_ratio || '1:1') },
    }, apiKey, params.onRequestId, 900);
  }

  return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 60);
}

export async function generateI2I(apiKey, params) {
  const modelInfo = getI2IModelById(params.model) || params.modelInfo;
  const endpoint = modelInfo?.endpoint || params.model;
  const payload = {};
  if (params.prompt) payload.prompt = params.prompt;
  const imageField = modelInfo?.imageField || 'image_url';
  const imagesList = params.images_list?.length > 0 ? params.images_list : (params.image_url ? [params.image_url] : null);
  if (imagesList) {
    if (imageField === 'images_list') payload.images_list = imagesList;
    else payload[imageField] = imagesList[0];
  }
  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.quality) payload.quality = params.quality;
  return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 60);
}

export async function generateVideo(apiKey, params) {
  const provider = getCurrentProvider();
  const modelInfo = getVideoModelById(params.model) || params.modelInfo;
  const endpoint = provider.id === 'muapi' ? (modelInfo?.endpoint || params.model) : (modelInfo?.endpoint || params.model);
  const payload = {};
  if (provider.id !== 'muapi') payload.model = modelInfo?.providerModel || params.model;
  if (params.prompt) payload.prompt = params.prompt;
  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.duration) payload.duration = params.duration;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.quality) payload.quality = params.quality;
  if (params.mode) payload.mode = params.mode;
  if (params.image_url) payload.image_url = params.image_url;

  if (provider.id === 'alibaba') {
    return submitAlibabaTask('services/aigc/video-generation/video-synthesis', {
      model: modelInfo?.providerModel || params.model,
      input: { prompt: params.prompt || '' },
      parameters: {
        size: getAlibabaSize(params.aspect_ratio || '16:9'),
        duration: params.duration || 5,
      },
    }, apiKey, params.onRequestId, 900);
  }

  return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function generateI2V(apiKey, params) {
  const provider = getCurrentProvider();
  const modelInfo = getI2VModelById(params.model) || params.modelInfo;
  const endpoint = provider.id === 'muapi' ? (modelInfo?.endpoint || params.model) : (modelInfo?.endpoint || params.model);
  const payload = {};
  if (provider.id !== 'muapi') payload.model = modelInfo?.providerModel || params.model;
  if (params.prompt) payload.prompt = params.prompt;
  const imageField = modelInfo?.imageField || 'image_url';
  if (params.image_url) {
    if (imageField === 'images_list') payload.images_list = [params.image_url];
    else payload[imageField] = params.image_url;
  }
  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.duration) payload.duration = params.duration;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.quality) payload.quality = params.quality;
  if (params.mode) payload.mode = params.mode;

  if (provider.id === 'alibaba') {
    return submitAlibabaTask('services/aigc/video-generation/video-synthesis', {
      model: modelInfo?.providerModel || params.model,
      input: {
        prompt: params.prompt || '',
        img_url: params.image_url,
      },
      parameters: {
        size: getAlibabaSize(params.aspect_ratio || '16:9'),
        duration: params.duration || 5,
      },
    }, apiKey, params.onRequestId, 900);
  }

  return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function generateMarketingStudioAd(apiKey, params) {
  const provider = getCurrentProvider();
  // For now, keep the same endpoints as they're likely provider-specific
  // In a full implementation, these would be configurable per provider
  const endpoint = params.resolution === '1080p' ? 'sd-2-vip-omni-reference-1080p' : 'seedance-2-vip-omni-reference';
  const payload = {
    prompt: params.prompt,
    aspect_ratio: params.aspect_ratio || '16:9',
    duration: params.duration || 5,
    images_list: params.images_list || [],
    video_files: params.video_files || []
  };
  return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function processLipSync(apiKey, params) {
  const modelInfo = getLipSyncModelById(params.model) || params.modelInfo;
  const endpoint = modelInfo?.endpoint || params.model;
  const payload = {};
  if (params.audio_url) payload.audio_url = params.audio_url;
  if (params.image_url) payload.image_url = params.image_url;
  if (params.video_url) payload.video_url = params.video_url;
  if (modelInfo?.hasPrompt) payload.prompt = params.prompt || '';
  if (params.resolution) payload.resolution = params.resolution;
  if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;
  return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export function uploadFile(apiKey, file, onProgress) {
  return new Promise((resolve, reject) => {
    const provider = getCurrentProvider();
    const authHeader = provider.authHeader || 'x-api-key';
    const authPrefix = provider.authPrefix || '';
    const url = `${API_PROXY}/upload_file`;
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader(authHeader, authPrefix + apiKey);
    if (provider.baseUrl) xhr.setRequestHeader('x-provider-base', provider.baseUrl);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const fileUrl = data.url || data.file_url || data.data?.url;
          if (!fileUrl) {
            reject(new Error('No URL returned from file upload'));
          } else {
            resolve(fileUrl);
          }
        } catch (e) {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        let detail = xhr.statusText;
        try {
          const errObj = JSON.parse(xhr.responseText);
          detail = errObj.detail || detail;
        } catch (e) {
          // fallback to statusText
        }
        reject(new Error(`File upload failed: ${xhr.status} - ${detail}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.send(formData);
  });
}

export async function getUserBalance(apiKey) {
  const provider = getCurrentProvider();
  if (provider.id !== 'muapi') {
    return { balance: null, unsupported: true };
  }
  const response = await fetch(`${API_PROXY}/account/balance`, {
    headers: buildProxyHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch balance: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
}

export async function getTemplateWorkflows(apiKey) {
  const response = await fetch(`${WF_PROXY}/get-template-workflows`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch template workflows: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function getUserWorkflows(apiKey) {
  const response = await fetch(`${WF_PROXY}/get-workflow-defs`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch user workflows: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function getPublishedWorkflows(apiKey) {
  const response = await fetch(`${WF_PROXY}/get-published-workflows`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch published workflows: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function getTemplateAgents(apiKey) {
  const response = await fetch(`${AGENTS_PROXY}/templates/agents`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch template agents: ${response.status} - ${errText.slice(0, 100)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : (data.agents || data.items || []);
};

export async function getUserAgents(apiKey) {
  const response = await fetch(`${AGENTS_PROXY}/user/agents`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch user agents: ${response.status} - ${errText.slice(0, 100)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : (data.agents || data.items || []);
};

export async function getPublishedAgents(apiKey) {
  const response = await fetch(`${AGENTS_PROXY}/featured/agents`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch featured agents: ${response.status} - ${errText.slice(0, 100)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : (data.agents || data.items || []);
};

// GET /agents/user/conversations — returns the user's chat history across all agents
export async function getUserConversations(apiKey) {
  const response = await fetch(`${AGENTS_PROXY}/user/conversations`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch conversations: ${response.status} - ${errText.slice(0, 100)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

export async function createWorkflow(apiKey, payload) {
  const response = await fetch(`${WF_PROXY}/create`, {
    method: 'POST',
    headers: buildWfHeaders(apiKey),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create workflow: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function updateWorkflowName(apiKey, workflowId, name) {
  const response = await fetch(`${WF_PROXY}/update-name/${workflowId}`, {
    method: 'POST',
    headers: buildWfHeaders(apiKey),
    body: JSON.stringify({ name })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to rename workflow: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function deleteWorkflow(apiKey, workflowId) {
  const response = await fetch(`${WF_PROXY}/delete-workflow-def/${workflowId}`, {
    method: 'DELETE',
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete workflow: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function getWorkflowInputs(apiKey, workflowId) {
  const response = await fetch(`${WF_PROXY}/${workflowId}/api-inputs`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch workflow inputs: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function executeWorkflow(apiKey, workflowId, inputs) {
  const response = await fetch(`${WF_PROXY}/${workflowId}/api-execute`, {
    method: 'POST',
    headers: buildWfHeaders(apiKey),
    body: JSON.stringify({ inputs })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to execute workflow: ${response.status} - ${errText.slice(0, 100)}`);
  }
  const submitData = await response.json();
  const runId = submitData.run_id || submitData.id;
  if (!runId) return submitData;

  // Poll for results
  return await pollWorkflowResult(runId, apiKey);
};

async function pollWorkflowResult(runId, apiKey, maxAttempts = 900, interval = 2000) {
  const pollUrl = `${WF_PROXY}/run/${runId}/api-outputs`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    try {
      const response = await fetch(pollUrl, {
        headers: buildWfHeaders(apiKey)
      });
      if (!response.ok) {
        if (response.status >= 500) continue;
        throw new Error(`Poll Failed: ${response.status}`);
      }
      const data = await response.json();
      const status = data.status?.toLowerCase();
      if (status === 'completed' || status === 'succeeded' || status === 'success') return data;
      if (status === 'failed' || status === 'error') throw new Error(`Workflow failed: ${data.error || 'Unknown error'}`);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
    }
  }
  throw new Error('Workflow timed out after polling.');
};

export async function getAllNodeSchemas(apiKey, workflowId) {
  const response = await fetch(`${WF_PROXY}/${workflowId}/node-schemas`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch node schemas: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function getWorkflowData(apiKey, workflowId) {
  const response = await fetch(`${WF_PROXY}/get-workflow-def/${workflowId}`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch workflow data: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function getNodeSchemas(apiKey, workflowId) {
  const response = await fetch(`${WF_PROXY}/${workflowId}/api-node-schemas`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch node schemas: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function runSingleNode(apiKey, workflowId, nodeId, payload) {
  const response = await fetch(`${WF_PROXY}/${workflowId}/node/${nodeId}/run`, {
    method: 'POST',
    headers: buildWfHeaders(apiKey),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to run single node: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function deleteNodeRun(apiKey, nodeRunId) {
  const response = await fetch(`${WF_PROXY}/node-run/${nodeRunId}`, {
    method: 'DELETE',
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete node run: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

export async function getNodeStatus(apiKey, runId) {
  const response = await fetch(`${WF_PROXY}/run/${runId}/status`, {
    headers: buildWfHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get node status: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
};

/**
 * Handle proxy requests centralizing communication logic with the current provider.
 * This is used by the server-side entry points.
 */
export async function handleProxyRequest(prefix, path, method, headers, body, apiKey) {
  const provider = getCurrentProvider();
  const url = `${provider.baseUrl}/${prefix}/${path}`;

  const finalHeaders = new Headers(headers);
  finalHeaders.delete('host');
  finalHeaders.delete('connection');
  finalHeaders.delete('content-length'); // Let fetch recalculate this for safety

  if (apiKey) {
    const authHeader = provider.authHeader || 'x-api-key';
    const authPrefix = provider.authPrefix || '';
    finalHeaders.set(authHeader, authPrefix + apiKey);
  }

  try {
    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: (method !== 'GET' && method !== 'HEAD') ? body : undefined,
      redirect: 'follow',
    });

    const contentType = response.headers.get('Content-Type') || 'application/json';
    const buffer = await response.arrayBuffer();

    return {
      status: response.status,
      contentType,
      data: buffer
    };
  } catch (error) {
    console.error(`Provider Proxy error for ${url}:`, error);
    throw error;
  }
}

/**
 * A centralized handler for Next.js API routes or middleware.
 */
export async function handleServerSideProxy(prefix, request, params, apiKey) {
  try {
    const provider = getCurrentProvider();
    const slug = await params;
    const pathSegments = slug.path || [];
    const path = pathSegments.join('/');

    const method = request.method;
    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    const { search } = new URL(request.url);
    const pathWithSearch = search ? `${path}${search}` : path;

    return await handleProxyRequest(
      prefix,
      pathWithSearch,
      method,
      request.headers,
      body,
      apiKey
    );
  } catch (error) {
    console.error(`Server proxy failed:`, error);
    throw error;
  }
}

export async function calculateDynamicCost(apiKey, taskName, payload) {
  const response = await fetch(`${API_PROXY}/app/calculate_dynamic_cost`, {
    method: 'POST',
    headers: buildProxyHeaders(apiKey),
    body: JSON.stringify({ task_name: taskName, payload })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to calculate dynamic cost: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
}

export async function registerAppInterest(apiKey, appName) {
  const response = await fetch(`${API_PROXY}/app/interest`, {
    method: 'POST',
    headers: buildProxyHeaders(apiKey),
    body: JSON.stringify({ app_name: appName })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to register interest: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
}

export async function getAppInterests(apiKey) {
  const response = await fetch(`${API_PROXY}/app/interests`, {
    headers: buildProxyHeaders(apiKey)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch interests: ${response.status} - ${errText.slice(0, 100)}`);
  }
  return await response.json();
}

function createPromptInput() {
  return {
    prompt: {
      type: 'string',
      title: 'Prompt',
      name: 'prompt',
      description: 'Describe what you want to generate.',
    },
  };
}

function createAspectRatioInput(defaultValue = '16:9') {
  return {
    aspect_ratio: {
      enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      title: 'Aspect Ratio',
      name: 'aspect_ratio',
      type: 'string',
      description: 'Output aspect ratio',
      default: defaultValue,
    },
  };
}

function normalizeProviderModel(rawModel, providerId) {
  const id = typeof rawModel === 'string' ? rawModel : (rawModel.id || rawModel.name || rawModel.model || rawModel.model_id);
  if (!id) return null;

  const lower = id.toLowerCase();
  const name = (typeof rawModel === 'object' && (rawModel.name || rawModel.display_name)) || id;
  const base = {
    id,
    name,
    provider: providerId,
    providerModel: id,
  };

  // IMPORTANT: Check t2i/i2i FIRST, before generic keywords like 'wan' or 'video'.
  // Alibaba models like 'wanx2.1-t2i-turbo' contain both 'wan' AND 't2i' —
  // the t2i check must come first so text-to-image models are not mis-categorised as video.
  if (lower.includes('t2i') || lower.includes('text-to-image') || lower.includes('image-gen')) {
    return {
      category: 't2iModels',
      model: {
        ...base,
        endpoint: providerId === 'muapi' ? id : 'images/generations',
        inputs: {
          ...createPromptInput(),
          ...createAspectRatioInput('1:1'),
        },
      },
    };
  }

  if (lower.includes('i2i') || lower.includes('image-to-image')) {
    return {
      category: 'i2iModels',
      model: {
        ...base,
        endpoint: providerId === 'muapi' ? id : id,
        inputs: {
          ...createPromptInput(),
          ...createAspectRatioInput('1:1'),
        },
      },
    };
  }

  if (lower.includes('wan') || lower.includes('video') || lower.includes('t2v') || lower.includes('text-to-video')) {
    return {
      category: lower.includes('i2v') || lower.includes('image-to-video') ? 'i2vModels' : 't2vModels',
      model: {
        ...base,
        endpoint: providerId === 'muapi' ? id : id,
        inputs: {
          ...createPromptInput(),
          ...createAspectRatioInput('16:9'),
          duration: {
            enum: [5, 10],
            title: 'Duration',
            name: 'duration',
            type: 'number',
            description: 'Video duration',
            default: 5,
          },
        },
      },
    };
  }

  // HappyHorse and most OpenAI-compatible image generators are text-to-image.
  if (lower.includes('image') || lower.includes('img') || lower.includes('flux') || lower.includes('sd') || lower.includes('stable') || lower.includes('happyhorse') || lower.includes('qwen')) {
    return {
      category: 't2iModels',
      model: {
        ...base,
        endpoint: providerId === 'muapi' ? id : 'images/generations',
        inputs: {
          ...createPromptInput(),
          ...createAspectRatioInput('1:1'),
        },
      },
    };
  }

  // Do not show text/chat/embedding models in the image/video UI.
  if (lower.includes('embedding') || lower.includes('text') || lower.includes('chat') || lower.includes('audio') || lower.includes('tts') || lower.includes('asr')) {
    return null;
  }

  return null;
}

function normalizeModelsResponse(data, providerId) {
  const categorized = {
    t2iModels: data.text_to_image || data.t2i || [],
    t2vModels: data.text_to_video || data.t2v || [],
    i2iModels: data.image_to_image || data.i2i || [],
    i2vModels: data.image_to_video || data.i2v || [],
    v2vModels: data.video_to_video || data.v2v || [],
    lipsyncModels: data.lip_sync || data.lipsync || [],
  };

  if (Object.values(categorized).some(arr => Array.isArray(arr) && arr.length > 0)) {
    return categorized;
  }

  // OpenAI-compatible model list format: { data: [{ id, ... }] }
  const flatModels = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : (Array.isArray(data) ? data : []));
  const normalized = {
    t2iModels: [],
    t2vModels: [],
    i2iModels: [],
    i2vModels: [],
    v2vModels: [],
    lipsyncModels: [],
  };

  flatModels.forEach((raw) => {
    const entry = normalizeProviderModel(raw, providerId);
    if (entry) normalized[entry.category].push(entry.model);
  });

  return normalized;
}

/**
 * Fetches the list of available models from the API.
 * Returns normalized model arrays matching the static models.js format.
 */
export async function fetchModels(apiKey) {
  const provider = getCurrentProvider();
  const response = await fetch(`${API_PROXY}/models`, {
    headers: buildProxyHeaders(apiKey, true, provider.modelsBaseUrl || provider.baseUrl)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch models: ${response.status} - ${errText.slice(0, 160)}`);
  }
  const data = await response.json();
  return normalizeModelsResponse(data, provider.id);
}
