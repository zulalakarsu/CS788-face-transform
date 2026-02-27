import Replicate from 'replicate';

if (!process.env.REPLICATE_API_TOKEN) {
  console.warn('REPLICATE_API_TOKEN environment variable is not set. Some features will not work.');
}

export const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Model configurations for different body/age transformations
export const MODELS = {
  // Face LoRA training model
  FACE_TRAINING: 'ostris/flux-dev-lora-trainer:4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f157b7324d0a',
  
  // Generation model that works with trained LoRAs
  GENERATION: 'black-forest-labs/flux-dev',
  
  // Fallback for direct face transformation if needed
  FACE_SWAP: 'yan-ops/face_swap'
};

// Transformation prompts for different body types and ages
export const TRANSFORMATION_PROMPTS = {
  muscular: {
    positive: 'muscular, strong physique, defined muscles, athletic build, fit body, toned',
    negative: 'thin, skinny, weak, flabby, out of shape'
  },
  slim: {
    positive: 'slim, lean, thin, slender figure, fit, healthy weight',
    negative: 'overweight, heavy, bulky, muscular, fat'
  },
  heavy: {
    positive: 'heavier build, larger frame, fuller figure, robust',
    negative: 'thin, skinny, slim, lean'
  },
  youthful: {
    positive: 'young, youthful appearance, smooth skin, vibrant, teenage look',
    negative: 'old, aged, wrinkled, elderly, mature'
  },
  elderly: {
    positive: 'older, mature, aged appearance, wisdom lines, distinguished',
    negative: 'young, youthful, teenage, smooth skin'
  }
} as const;

export type TransformationType = keyof typeof TRANSFORMATION_PROMPTS;

// Helper function to build generation prompts
export function buildGenerationPrompt(
  type: TransformationType, 
  customPrompt?: string,
  triggerWord: string = 'ohwx person'
): { prompt: string; negative_prompt: string } {
  if (customPrompt) {
    return {
      prompt: `${triggerWord}, ${customPrompt}`,
      negative_prompt: 'blurry, low quality, distorted, deformed, artificial'
    };
  }

  const config = TRANSFORMATION_PROMPTS[type];
  return {
    prompt: `${triggerWord}, ${config.positive}, high quality, realistic, detailed`,
    negative_prompt: `${config.negative}, blurry, low quality, distorted, deformed, artificial`
  };
}

// Training configuration
export const TRAINING_CONFIG = {
  steps: 1200,
  learning_rate: 0.0001,
  batch_size: 1,
  resolution: 512,
  trigger_word: 'ohwx person',
  max_train_epochs: 30
};

export interface TrainingJob {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  model_version?: string;
  error?: string;
  logs?: string;
  created_at: string;
  completed_at?: string;
}

// In-memory storage for training jobs (in production, use Redis or database)
export const trainingJobs = new Map<string, TrainingJob>();