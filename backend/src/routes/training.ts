import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { 
  replicate, 
  MODELS, 
  TRAINING_CONFIG, 
  trainingJobs, 
  TrainingJob 
} from '../utils/replicate';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/training');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const jobId = req.body.jobId || uuidv4();
    cb(null, `${jobId}_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload photos and start training
router.post('/upload', upload.array('photos', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'At least 3 photos are required for training'
      });
    }

    if (files.length > 8) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 8 photos allowed for training'
      });
    }

    const jobId = uuidv4();
    
    // Process and validate photos
    const processedPhotos: string[] = [];
    
    for (const file of files) {
      try {
        // Resize and optimize the image
        const processedPath = path.join(path.dirname(file.path), `processed_${path.basename(file.path)}`);
        
        await sharp(file.path)
          .resize(512, 512, { 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 90 })
          .toFile(processedPath);
        
        processedPhotos.push(processedPath);
        
        // Remove original file
        fs.unlinkSync(file.path);
        
      } catch (error) {
        console.error(`Error processing photo ${file.filename}:`, error);
        return res.status(400).json({
          success: false,
          error: `Failed to process photo: ${file.originalname}`
        });
      }
    }

    // Create training job
    const trainingJob: TrainingJob = {
      id: jobId,
      status: 'starting',
      created_at: new Date().toISOString()
    };
    
    trainingJobs.set(jobId, trainingJob);

    // Start training asynchronously
    logger.training.started(jobId, processedPhotos.length);
    
    startTraining(jobId, processedPhotos).catch(error => {
      logger.training.failed(jobId, error.message);
      trainingJobs.set(jobId, {
        ...trainingJobs.get(jobId)!,
        status: 'failed',
        error: error.message,
        completed_at: new Date().toISOString()
      });
    });

    res.json({
      success: true,
      jobId,
      message: `Training started with ${processedPhotos.length} photos`,
      estimated_minutes: 3
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process upload'
    });
  }
});

// Get training status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = trainingJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }

    // If job is processing, check Replicate status
    if (job.status === 'processing' && job.model_version) {
      try {
        const prediction = await replicate.predictions.get(job.model_version);
        
        // Update job status based on Replicate response
        const updatedJob: TrainingJob = {
          ...job,
          status: prediction.status as any,
          logs: prediction.logs || job.logs,
          error: prediction.error?.toString(),
        };
        
        if (prediction.status === 'succeeded') {
          updatedJob.model_version = prediction.output?.version || prediction.id;
          updatedJob.completed_at = new Date().toISOString();
          logger.training.completed(jobId, updatedJob.model_version || prediction.id);
        } else if (['failed', 'canceled'].includes(prediction.status)) {
          updatedJob.completed_at = new Date().toISOString();
          if (prediction.status === 'failed') {
            logger.training.failed(jobId, updatedJob.error || 'Unknown error');
          }
        }
        
        logger.training.statusUpdated(jobId, prediction.status, (prediction as any).progress);
        trainingJobs.set(jobId, updatedJob);
        
        res.json({
          success: true,
          ...updatedJob
        });
        
      } catch (replicateError) {
        console.error('Error checking Replicate status:', replicateError);
        res.json({
          success: true,
          ...job
        });
      }
    } else {
      res.json({
        success: true,
        ...job
      });
    }
    
  } catch (error: any) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check training status'
    });
  }
});

// Cancel training
router.post('/cancel/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = trainingJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }

    if (job.status === 'processing' && job.model_version) {
      try {
        await replicate.predictions.cancel(job.model_version);
      } catch (error) {
        console.error('Error canceling Replicate training:', error);
      }
    }

    const canceledJob: TrainingJob = {
      ...job,
      status: 'canceled',
      completed_at: new Date().toISOString()
    };
    
    trainingJobs.set(jobId, canceledJob);

    res.json({
      success: true,
      message: 'Training canceled successfully'
    });

  } catch (error: any) {
    console.error('Cancel training error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel training'
    });
  }
});

// Delete trained model
router.delete('/model/:modelVersion', async (req, res) => {
  try {
    const { modelVersion } = req.params;
    
    // Find and remove the job associated with this model
    for (const [jobId, job] of trainingJobs.entries()) {
      if (job.model_version === modelVersion) {
        trainingJobs.delete(jobId);
        break;
      }
    }

    // Note: Replicate doesn't have a direct delete model API
    // Models are automatically cleaned up after a period of inactivity
    
    res.json({
      success: true,
      message: 'Model deletion requested'
    });

  } catch (error: any) {
    console.error('Delete model error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete model'
    });
  }
});

// Helper function to start training
async function startTraining(jobId: string, photoPaths: string[]): Promise<void> {
  const job = trainingJobs.get(jobId);
  if (!job) throw new Error('Training job not found');

  try {
    // Update job status
    trainingJobs.set(jobId, { ...job, status: 'processing' });

    // Convert local file paths to URLs or base64 for Replicate
    const photoUrls: string[] = [];
    
    for (const photoPath of photoPaths) {
      // Read file and convert to base64 data URL
      const fileBuffer = fs.readFileSync(photoPath);
      const base64 = fileBuffer.toString('base64');
      const mimeType = 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      photoUrls.push(dataUrl);
    }

    // Start training with Replicate
    const prediction = await replicate.predictions.create({
      model: MODELS.FACE_TRAINING,
      input: {
        input_images: photoUrls.join(','),
        trigger_word: TRAINING_CONFIG.trigger_word,
        max_train_steps: TRAINING_CONFIG.steps,
        learning_rate: TRAINING_CONFIG.learning_rate,
        batch_size: TRAINING_CONFIG.batch_size,
        resolution: TRAINING_CONFIG.resolution,
        autocaption: true,
        is_lora: true,
      },
    });

    // Update job with prediction ID
    trainingJobs.set(jobId, {
      ...trainingJobs.get(jobId)!,
      model_version: prediction.id,
      status: 'processing'
    });

    console.log(`Training started for job ${jobId}, Replicate ID: ${prediction.id}`);

  } catch (error: any) {
    console.error(`Training setup failed for job ${jobId}:`, error);
    trainingJobs.set(jobId, {
      ...trainingJobs.get(jobId)!,
      status: 'failed',
      error: error.message,
      completed_at: new Date().toISOString()
    });
    throw error;
  }
}

export default router;