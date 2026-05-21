"use client";

import { createContext, createElement, useContext, useState, useEffect, useCallback } from 'react';
import {
  t2iModels as staticT2I,
  t2vModels as staticT2V,
  i2iModels as staticI2I,
  i2vModels as staticI2V,
  v2vModels as staticV2V,
  lipsyncModels as staticLipSync,
} from './models.js';

export const EMPTY_MODELS = {
  t2iModels: [],
  t2vModels: [],
  i2iModels: [],
  i2vModels: [],
  v2vModels: [],
  lipsyncModels: [],
};

export const STATIC_MODELS = {
  t2iModels: staticT2I,
  t2vModels: staticT2V,
  i2iModels: staticI2I,
  i2vModels: staticI2V,
  v2vModels: staticV2V,
  lipsyncModels: staticLipSync,
};

const ModelContext = createContext({
  ...STATIC_MODELS,
  loading: false,
  error: null,
  providerId: 'muapi',
  useStaticFallback: true,
  reload: () => {},
});

const CACHE_TTL = 30 * 60 * 1000;
const CACHE_VERSION = 'v2';

function getCacheKey(providerId, keyPrefix) {
  return `apexstudios_models_${CACHE_VERSION}_${providerId}_${keyPrefix}`;
}

function hasAnyModels(models) {
  return Object.values(models || {}).some((arr) => Array.isArray(arr) && arr.length > 0);
}

function readCache(cacheKey) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.timestamp || 0) > CACHE_TTL) return null;
    return hasAnyModels(parsed.models) ? parsed.models : null;
  } catch {
    return null;
  }
}

function writeCache(cacheKey, models) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(cacheKey, JSON.stringify({ models, timestamp: Date.now() }));
  } catch {
    // ignore quota/security errors
  }
}

export function ModelProvider({ apiKey, providerId = 'muapi', children }) {
  const [models, setModels] = useState(() => providerId === 'muapi' ? STATIC_MODELS : EMPTY_MODELS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadModels = useCallback(async (key, provId, force = false) => {
    if (!key) {
      setModels(STATIC_MODELS);
      setError(null);
      return;
    }

    const cacheKey = getCacheKey(provId, key.slice(0, 8));
    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setModels(cached);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const { fetchModels } = await import('./muapi.js');
      const fetched = await fetchModels(key);

      if (hasAnyModels(fetched)) {
        setModels(fetched);
        writeCache(cacheKey, fetched);
      } else {
        setModels(provId === 'muapi' ? STATIC_MODELS : EMPTY_MODELS);
        setError('No models returned by this API provider.');
      }
    } catch (err) {
      const message = err?.message || 'Failed to fetch models';
      console.warn('[ModelProvider] Failed to fetch models from API:', message);
      setError(message);
      setModels(provId === 'muapi' ? STATIC_MODELS : EMPTY_MODELS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Important: never show MuAPI's static model list while a non-MuAPI provider
    // is loading. Otherwise Alibaba/OpenAI users see the full MuAPI catalog.
    setModels(providerId === 'muapi' ? STATIC_MODELS : EMPTY_MODELS);
    setError(null);

    if (apiKey) {
      loadModels(apiKey, providerId);
    }
  }, [apiKey, providerId, loadModels]);

  const exposedModels = providerId === 'muapi' ? models : {
    t2iModels: models.t2iModels || [],
    t2vModels: models.t2vModels || [],
    i2iModels: models.i2iModels || [],
    i2vModels: models.i2vModels || [],
    v2vModels: models.v2vModels || [],
    lipsyncModels: models.lipsyncModels || [],
  };

  const value = {
    ...exposedModels,
    loading,
    error,
    providerId,
    useStaticFallback: providerId === 'muapi',
    reload: () => loadModels(apiKey, providerId, true),
  };

  return createElement(ModelContext.Provider, { value }, children);
}

export function useModels() {
  return useContext(ModelContext);
}
