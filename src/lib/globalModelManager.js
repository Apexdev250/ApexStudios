// Global model manager for dynamic model loading

// Load v2vModels from models.js as fallback for Video Tools
import { v2vModels as staticV2VModels } from './models.js';

export class GlobalModelManager {
    constructor() {
        this.models = {
            t2iModels: [],
            t2vModels: [],
            i2iModels: [],
            i2vModels: [],
            v2vModels: [],
            lipsyncModels: []
        };
        this.listeners = [];
        this.isLoading = false;
    }

    // Set models and notify listeners
    setModels(newModels) {
        this.models = { ...newModels };
        this.notifyListeners();
    }

    // Get models
    getModels() {
        return { ...this.models };
    }

    // Get specific model category
    getModel(category) {
        return this.models[category] || [];
    }

    // Add listener for model changes
    addListener(callback) {
        this.listeners.push(callback);
    }

    // Remove listener
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    // Notify all listeners
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.models);
            } catch (error) {
                console.error('Error in model listener:', error);
            }
        });
    }

    // Load models from API
    async loadModelsFromAPI() {
        if (this.isLoading) return;

        this.isLoading = true;
        try {
            const { muapi } = await import('./muapi.js');
            const models = await muapi.fetchModelIds();
            this.setModels(models);
        } catch (error) {
            console.error('Failed to load models from API:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
}

// Create global instance
export const globalModelManager = new GlobalModelManager();

// Export static v2vModels for Video Tools (these don't need to be dynamic)
export const v2vModels = staticV2VModels;