import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

interface TrainingResponse {
  success: boolean;
  jobId: string;
  modelVersion?: string;
  message: string;
  estimated_minutes?: number;
  triggerWord?: string;
  modelName?: string;
}

interface TrainingStatusResponse {
  success: boolean;
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  model_version?: string;
  error?: string;
  progress?: number;
  logs?: string;
  created_at: string;
  completed_at?: string;
}

interface GenerationResponse {
  success: boolean;
  imageUrl: string;
  localUri?: string;
  type: string;
  seed: number;
  requestId: string;
  prompt?: string;
  negative_prompt?: string;
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    const baseURL = this.getApiBaseUrl();
    console.log('🌐 API Base URL:', process.env.EXPO_PUBLIC_API_URL || 'NOT SET');
    console.log('🌐 Computed API URL:', baseURL);
    
    this.api = axios.create({
      baseURL,
      timeout: 300000, // 5 minutes for training operations
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for debugging and auth
    this.api.interceptors.request.use(
      (config) => {
        console.log(`→ ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data && config.headers['Content-Type'] === 'multipart/form-data') {
          console.log('→ FormData upload (size hidden for brevity)');
        } else if (config.data) {
          console.log('→ Request data:', JSON.stringify(config.data).substring(0, 100) + '...');
        }
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for debugging and error handling
    this.api.interceptors.response.use(
      (response) => {
        console.log(`← ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`← ERROR ${error.response?.status} ${error.config?.url}`, error.response?.data || error.message);
        
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout - please check your connection and try again');
        }
        
        if (!error.response) {
          throw new Error('Network error - please check your connection');
        }
        
        const message = error.response.data?.error || error.response.data?.message || 'An unexpected error occurred';
        throw new Error(message);
      }
    );
  }

  private getApiBaseUrl(): string {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl && envUrl.trim().length > 0) {
      return envUrl.replace(/\/$/, '');
    }

    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:3000/api`;
    }

    return 'http://localhost:3000/api';
  }

  async uploadPhotosForTraining(photoUris: string[]): Promise<TrainingResponse> {
    const formData = new FormData();
    
    for (let i = 0; i < photoUris.length; i++) {
      const uri = photoUris[i];
      
      // For React Native, we need to handle file URIs differently
      const fileInfo = {
        uri,
        type: 'image/jpeg',
        name: `photo_${i}.jpg`,
      };
      
      formData.append('photos', fileInfo as any);
    }

    const response = await this.retryRequest(
      () => this.api.post('/training/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes for upload + training start
      }),
      2,
      2000
    );

    return response.data;
  }

  async getTrainingStatus(jobId: string): Promise<TrainingStatusResponse> {
    const response = await this.api.get(`/training/status/${jobId}`);
    return response.data;
  }

  async generateTransformation(
    modelVersion: string,
    type: 'muscular' | 'slim' | 'heavy' | 'youthful' | 'elderly' | 'astronaut' | 'renaissance' | 'superhero' | 'custom',
    customPrompt?: string,
    triggerWord?: string
  ): Promise<GenerationResponse> {
    const response = await this.api.post('/generate', {
      modelVersion,
      type,
      customPrompt,
      triggerWord,
    }, {
      timeout: 300000, // 5 minutes for generation (increased from 3 minutes)
    });

    return response.data;
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        const isNetworkError = 
          error.code === 'ECONNABORTED' || 
          error.code === 'ECONNREFUSED' ||
          error.message?.includes('Network Error') ||
          !error.response;

        if (attempt === maxRetries || !isNetworkError) {
          throw error;
        }

        console.warn(`Request attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.retryRequest(
        () => this.api.get('/health', { timeout: 10000 }),
        2,
        500
      );
      return response.data.success === true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async deleteModel(modelVersion: string): Promise<boolean> {
    try {
      const response = await this.api.delete(`/training/model/${modelVersion}`);
      return response.data.success === true;
    } catch (error) {
      console.error('Delete model failed:', error);
      return false;
    }
  }

  async recoverTraining(): Promise<TrainingStatusResponse | null> {
    try {
      const response = await this.api.get('/training/recover');
      return response.data.success ? response.data : null;
    } catch (error) {
      console.error('Recover training failed:', error);
      return null;
    }
  }

  async getLatestModel(): Promise<{ success: boolean; model_version?: string; status?: string } | null> {
    try {
      const response = await this.api.get('/training/latest-model');
      return response.data;
    } catch (error) {
      console.error('Get latest model failed:', error);
      return null;
    }
  }

  async getCompletedModels(): Promise<{
    success: boolean;
    models: Array<{
      jobId: string;
      modelName: string;
      modelVersion: string;
      triggerWord: string;
      createdAt: string;
      completedAt: string;
    }>;
  } | null> {
    try {
      const response = await this.api.get('/training/completed-models');
      return response.data;
    } catch (error) {
      console.error('Get completed models failed:', error);
      return null;
    }
  }
}

export default new ApiService();