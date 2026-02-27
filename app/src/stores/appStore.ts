import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TrainingStatus = 'idle' | 'capturing' | 'uploading' | 'training' | 'ready' | 'failed';
export type TransformationType = 'muscular' | 'slim' | 'heavy' | 'youthful' | 'elderly' | 'astronaut' | 'renaissance' | 'superhero' | 'custom';

export interface TrainedModel {
  id: string;
  name: string;
  modelVersion: string;
  triggerWord: string;
  trainingPhotos: string[];
  createdAt: string;
  isActive: boolean;
}

interface GenerationResult {
  imageUrl: string;
  localUri: string;
  type: string;
  seed: number;
}

interface HistoryItem {
  id: string;
  type: TransformationType;
  localUri: string;
  imageUrl: string;
  seed: number;
  createdAt: string;
}

interface AppState {
  // Training state (PERSISTED across app restarts)
  facePhotos: string[];
  trainedModelVersion: string | null; // Legacy - for backward compatibility
  trainedModelCreatedAt: string | null; // Legacy - for backward compatibility
  trainingJobId: string | null;
  trainingStatus: TrainingStatus;
  trainingError: string | null;

  // Multi-model support (PERSISTED)
  models: TrainedModel[];
  activeModelId: string | null;

  // Generation state (per-session)
  selectedType: TransformationType | null;
  isGenerating: boolean;
  generationResult: GenerationResult | null;
  generationError: string | null;

  // History (PERSISTED)
  history: HistoryItem[];

  // Actions
  setFacePhotos: (photos: string[]) => void;
  setTrainingJobId: (jobId: string | null) => void;
  setTrainingStatus: (status: TrainingStatus) => void;
  setTrainingError: (error: string | null) => void;
  setTrainedModel: (version: string | null, createdAt?: string) => void; // Legacy
  resetTraining: () => void;

  // Model management
  addModel: (model: Omit<TrainedModel, 'id'>) => void;
  setActiveModel: (modelId: string | null) => void;
  getActiveModel: () => TrainedModel | null;
  updateModelName: (modelId: string, newName: string) => void;
  deleteModel: (modelId: string) => void;
  getSelectedModel: () => TrainedModel | null; // For backward compatibility with EditorScreen
  getAllModels: () => TrainedModel[]; // For backward compatibility with EditorScreen
  
  setSelectedType: (type: TransformationType | null) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGenerationResult: (result: GenerationResult | null) => void;
  setGenerationError: (error: string | null) => void;
  clearGeneration: () => void;

  addToHistory: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;

  // Computed getters
  hasTrainedModel: () => boolean;
  isTrainingInProgress: () => boolean;
  canStartNewTraining: () => boolean;
}

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial training state
      facePhotos: [],
      trainedModelVersion: null,
      trainedModelCreatedAt: null,
      trainingJobId: null,
      trainingStatus: 'idle',
      trainingError: null,

      // Initial multi-model state
      models: [
        {
          id: 'model_ohwx',
          name: 'You (OHWX)',
          modelVersion: 'zulalakarsu/face-lora-1772141825029:efa4c4021973c934308feaad473ebd125bc2321e2b5325d1f85023d27a134e7e',
          triggerWord: 'OHWX',
          trainingPhotos: [
            '/path/to/photo1.jpg',
            '/path/to/photo2.jpg', 
            '/path/to/photo3.jpg',
            '/path/to/photo4.jpg',
            '/path/to/photo5.jpg'
          ],
          createdAt: '2026-02-27T02:00:00.000Z',
          isActive: true,
        },
        {
          id: 'model_user774833',
          name: 'You (New)',
          modelVersion: 'zulalakarsu/face-lora-1772161774833:efa4c4021973c934308feaad473ebd125bc2321e2b5325d1f85023d27a134e7e',
          triggerWord: 'USER774833',
          trainingPhotos: [
            '/path/to/new1.jpg',
            '/path/to/new2.jpg', 
            '/path/to/new3.jpg',
            '/path/to/new4.jpg',
            '/path/to/new5.jpg'
          ],
          createdAt: '2026-02-27T03:00:00.000Z',
          isActive: false,
        }
      ],
      activeModelId: 'model_ohwx', // Default to OHWX model as you prefer

      // Initial generation state
      selectedType: null,
      isGenerating: false,
      generationResult: null,
      generationError: null,

      // Initial history
      history: [],

      // Training actions
      setFacePhotos: (photos) => set({ facePhotos: photos }),
      
      setTrainingJobId: (jobId) => set({ trainingJobId: jobId }),
      
      setTrainingStatus: (status) => set({ trainingStatus: status }),
      
      setTrainingError: (error) => set({ 
        trainingError: error,
        trainingStatus: error ? 'failed' : get().trainingStatus 
      }),
      
      setTrainedModel: (version, createdAt) => set({
        trainedModelVersion: version,
        trainedModelCreatedAt: createdAt || new Date().toISOString(),
        trainingStatus: version ? 'ready' : 'idle',
        trainingJobId: null,
        trainingError: null,
      }),

      resetTraining: () => set({
        facePhotos: [],
        trainedModelVersion: null,
        trainedModelCreatedAt: null,
        trainingJobId: null,
        trainingStatus: 'idle',
        trainingError: null,
      }),

      // Model management actions
      addModel: (model: Omit<TrainedModel, 'id'>) => {
        const newModel: TrainedModel = {
          ...model,
          id: `model_${Date.now()}`,
        };
        
        set((state) => ({
          models: [...state.models, newModel],
          activeModelId: state.activeModelId || newModel.id, // Auto-select if no model active
        }));
      },

      setActiveModel: (modelId: string | null) => {
        set((state) => ({
          models: state.models.map(m => ({ ...m, isActive: m.id === modelId })),
          activeModelId: modelId,
        }));
      },

      getActiveModel: () => {
        const state = get();
        return state.models.find(m => m.id === state.activeModelId) || null;
      },

      updateModelName: (modelId: string, newName: string) => {
        set((state) => ({
          models: state.models.map(m => 
            m.id === modelId ? { ...m, name: newName } : m
          ),
        }));
      },

      deleteModel: (modelId: string) => {
        set((state) => {
          const updatedModels = state.models.filter(m => m.id !== modelId);
          const newActiveModelId = state.activeModelId === modelId 
            ? (updatedModels.length > 0 ? updatedModels[0].id : null)
            : state.activeModelId;
          
          return {
            models: updatedModels,
            activeModelId: newActiveModelId,
          };
        });
      },

      // Backward compatibility methods for EditorScreen
      getSelectedModel: () => {
        const state = get();
        return state.models.find(m => m.id === state.activeModelId) || null;
      },

      getAllModels: () => get().models,

      // Generation actions
      setSelectedType: (type) => set({ selectedType: type }),
      
      setGenerating: (isGenerating) => set({ isGenerating }),
      
      setGenerationResult: (result) => set({ 
        generationResult: result,
        isGenerating: false,
        generationError: null,
      }),
      
      setGenerationError: (error) => set({ 
        generationError: error,
        isGenerating: false,
      }),
      
      clearGeneration: () => set({
        selectedType: null,
        generationResult: null,
        generationError: null,
        isGenerating: false,
      }),

      // History actions
      addToHistory: (item) => {
        const newItem: HistoryItem = {
          ...item,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          history: [newItem, ...state.history].slice(0, 50) // Keep only last 50 items
        }));
      },
      
      clearHistory: () => set({ history: [] }),
      
      removeFromHistory: (id) => set((state) => ({
        history: state.history.filter(item => item.id !== id)
      })),

      // Computed getters
      hasTrainedModel: () => {
        const state = get();
        // Check new multi-model system first
        if (state.models.length > 0) {
          return true;
        }
        // Fallback to legacy system
        return !!(state.trainedModelVersion && state.trainingStatus === 'ready');
      },
      
      isTrainingInProgress: () => {
        const state = get();
        return ['capturing', 'uploading', 'training'].includes(state.trainingStatus);
      },
      
      canStartNewTraining: () => {
        const state = get();
        return !['uploading', 'training'].includes(state.trainingStatus);
      },
    }),
    {
      name: 'body-morph-storage',
      storage: {
        getItem: async (name: string) => {
          try {
            const value = await AsyncStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch (error) {
            console.error('Error loading from AsyncStorage:', error);
            return null;
          }
        },
        setItem: async (name: string, value: any) => {
          try {
            await AsyncStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            console.error('Error saving to AsyncStorage:', error);
          }
        },
        removeItem: async (name: string) => {
          try {
            await AsyncStorage.removeItem(name);
          } catch (error) {
            console.error('Error removing from AsyncStorage:', error);
          }
        },
      },
      // Only persist these fields across app restarts
      partialize: (state) => ({
        facePhotos: state.facePhotos,
        trainedModelVersion: state.trainedModelVersion,
        trainedModelCreatedAt: state.trainedModelCreatedAt,
        trainingJobId: state.trainingJobId,
        trainingStatus: state.trainingStatus,
        trainingError: state.trainingError,
        models: state.models,
        activeModelId: state.activeModelId,
        history: state.history,
      }),
    }
  )
);

export default useAppStore;