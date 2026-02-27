import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { editImage, validateImageFormat } from '../utils/openai';
import { buildEditPrompt, validateEditParameters, EditParameters } from '../utils/promptBuilder';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_DIR || 'uploads';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(file.originalname);
    cb(null, `${timestamp}_${randomString}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 400));
    }
  }
});

// POST /api/edit/image
router.post('/image', upload.single('image'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw createError('No image file provided', 400);
  }

  // Parse edit parameters
  const editParams: EditParameters = {
    bodyType: parseFloat(req.body.bodyType || '0'),
    ageChange: parseFloat(req.body.ageChange || '0'),
    preserveClothing: req.body.preserveClothing === 'true',
    isFullBody: req.body.isFullBody === 'true'
  };

  // Validate parameters
  const validation = validateEditParameters(editParams);
  if (!validation.isValid) {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    throw createError(`Invalid parameters: ${validation.errors.join(', ')}`, 400);
  }

  try {
    // Convert image to base64
    const imageBuffer = fs.readFileSync(req.file.path);
    const imageBase64 = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;

    // Validate image format
    if (!validateImageFormat(imageBase64)) {
      throw createError('Invalid image format', 400);
    }

    // Build prompt
    const prompt = buildEditPrompt(editParams);

    // Call OpenAI API
    const result = await editImage({
      imageBase64,
      prompt
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        editedImageUrl: result.editedImageUrl,
        requestId: result.requestId,
        prompt,
        parameters: editParams
      }
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw error;
  }
}));

// POST /api/edit/base64
router.post('/base64', asyncHandler(async (req: Request, res: Response) => {
  const { imageBase64, bodyType, ageChange, preserveClothing, isFullBody } = req.body;

  if (!imageBase64) {
    throw createError('No image data provided', 400);
  }

  // Validate image format
  if (!validateImageFormat(imageBase64)) {
    throw createError('Invalid image format. Expected base64 encoded image.', 400);
  }

  // Parse edit parameters
  const editParams: EditParameters = {
    bodyType: parseFloat(bodyType || '0'),
    ageChange: parseFloat(ageChange || '0'),
    preserveClothing: preserveClothing === true || preserveClothing === 'true',
    isFullBody: isFullBody === true || isFullBody === 'true'
  };

  // Validate parameters
  const validation = validateEditParameters(editParams);
  if (!validation.isValid) {
    throw createError(`Invalid parameters: ${validation.errors.join(', ')}`, 400);
  }

  // Build prompt
  const prompt = buildEditPrompt(editParams);

  // Call OpenAI API
  const result = await editImage({
    imageBase64,
    prompt
  });

  res.json({
    success: true,
    data: {
      editedImageUrl: result.editedImageUrl,
      requestId: result.requestId,
      prompt,
      parameters: editParams
    }
  });
}));

// GET /api/edit/health
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    service: 'image-edit',
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});

export default router;