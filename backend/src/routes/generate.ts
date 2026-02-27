import express from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { 
  replicate, 
  MODELS, 
  buildGenerationPrompt,
  TransformationType,
  trainingJobs
} from '../utils/replicate';
import { logger } from '../utils/logger';

const router = express.Router();

// Generate transformation using trained model
router.post('/', async (req, res) => {
  let requestId: string = 'unknown';
  
  try {
    const { modelVersion, type, customPrompt } = req.body;

    if (!modelVersion) {
      return res.status(400).json({
        success: false,
        error: 'Model version is required'
      });
    }

    if (!type && !customPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Transformation type or custom prompt is required'
      });
    }

    // Find the training job to get the trained model
    let trainedModelUrl: string | null = null;
    for (const [jobId, job] of trainingJobs.entries()) {
      if (job.model_version === modelVersion && job.status === 'succeeded') {
        // Get the trained model output
        try {
          const prediction = await replicate.predictions.get(modelVersion);
          if (prediction.output && typeof prediction.output === 'object') {
            trainedModelUrl = (prediction.output as any).weights || prediction.output;
          }
        } catch (error) {
          console.error('Error getting trained model:', error);
        }
        break;
      }
    }

    if (!trainedModelUrl) {
      return res.status(404).json({
        success: false,
        error: 'Trained model not found or not ready'
      });
    }

    // Build prompts
    const { prompt, negative_prompt } = buildGenerationPrompt(
      type as TransformationType, 
      customPrompt
    );

    const seed = Math.floor(Math.random() * 1000000);
    requestId = uuidv4();
    
    logger.generation.started(requestId, modelVersion, type || 'custom');

    // Generate image using the trained LoRA
    const prediction = await replicate.predictions.create({
      model: MODELS.GENERATION,
      input: {
        prompt,
        negative_prompt,
        lora_weights: trainedModelUrl,
        num_inference_steps: 50,
        guidance_scale: 7.5,
        width: 512,
        height: 512,
        seed,
        output_format: 'jpg',
        output_quality: 90
      },
    });

    // Wait for generation to complete (with timeout)
    let result = prediction;
    const startTime = Date.now();
    const timeout = 180000; // 3 minutes

    while (!result.output && result.status !== 'failed' && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await replicate.predictions.get(prediction.id);
    }

    if (result.status === 'failed') {
      logger.generation.failed(requestId, result.error?.toString() || 'Generation failed');
      return res.status(500).json({
        success: false,
        error: result.error?.toString() || 'Generation failed'
      });
    }

    if (!result.output) {
      logger.generation.failed(requestId, 'Generation timed out');
      return res.status(408).json({
        success: false,
        error: 'Generation timed out'
      });
    }

    // Save the generated image locally (optional)
    let localUri: string | undefined;
    try {
      if (Array.isArray(result.output) && result.output[0]) {
        const imageUrl = result.output[0] as string;
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        
        const filename = `generated_${requestId}_${Date.now()}.jpg`;
        const localPath = path.join(__dirname, '../../uploads/generated', filename);
        
        // Ensure directory exists
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(localPath, Buffer.from(buffer));
        localUri = `/uploads/generated/${filename}`;
      }
    } catch (error) {
      console.error('Error saving generated image locally:', error);
      // Continue without local copy
    }

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    
    logger.generation.completed(requestId, imageUrl, seed);

    res.json({
      success: true,
      imageUrl,
      localUri,
      type,
      seed,
      requestId,
      prompt: prompt,
      negative_prompt: negative_prompt
    });

  } catch (error: any) {
    logger.generation.failed(requestId, error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate transformation'
    });
  }
});

// Get generation history (if implemented)
router.get('/history', async (req, res) => {
  try {
    // This would typically query a database
    // For now, return empty array
    res.json({
      success: true,
      history: []
    });
  } catch (error: any) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get generation history'
    });
  }
});

export default router;