# Body Morph Backend

AI-powered body and age transformation API using Replicate's LoRA training.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   # Copy and edit the environment file
   cp .env.example .env
   
   # Add your Replicate API token
   REPLICATE_API_TOKEN=r8_your_token_here
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## API Documentation

See [API.md](./API.md) for complete API documentation.

## Features

- **LoRA Training**: Train personalized AI models with 3-8 face photos
- **Body Transformations**: Muscular, slim, heavy builds
- **Age Transformations**: Youthful, elderly appearances  
- **Custom Prompts**: Generate with custom descriptions
- **Progress Tracking**: Real-time training status updates
- **Error Handling**: Comprehensive logging and error reporting

## Requirements

- Node.js 18+
- Replicate API token
- 10GB+ disk space for uploads

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REPLICATE_API_TOKEN` | Yes | - | Replicate API token |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `UPLOAD_DIR` | No | uploads | Upload directory |
| `MAX_FILE_SIZE` | No | 10485760 | Max file size (bytes) |

## Training Process

1. **Upload**: 3-8 clear face photos
2. **Processing**: Photos resized and validated
3. **Training**: LoRA model trained (~3-5 minutes)
4. **Generation**: Transform using trained model

## Architecture

```
src/
├── routes/
│   ├── training.ts    # Training endpoints
│   └── generate.ts    # Generation endpoints
├── utils/
│   ├── replicate.ts   # Replicate client
│   └── logger.ts      # Logging utilities
└── middleware/
    └── errorHandler.ts # Error handling
```

## Monitoring

- Logs written to `./logs/YYYY-MM-DD.log`
- Health check at `/api/health`
- Training status polling every 3 seconds

## Security

- Rate limiting (10 requests/15min)
- File type validation
- Size limits (10MB per photo)
- Error message sanitization

## Development

### Scripts
```bash
npm run dev      # Start with nodemon
npm run build    # Compile TypeScript  
npm start        # Start production server
npm run clean    # Remove dist folder
```

### Testing
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test edit service
curl http://localhost:3000/api/edit/health

# Test image upload
curl -X POST -F "image=@test.jpg" \
     -F "bodyType=0.5" \
     -F "ageChange=10" \
     -F "preserveClothing=true" \
     -F "isFullBody=true" \
     http://localhost:3000/api/edit/image
```

### Debugging

Enable request logging by setting `NODE_ENV=development`:
```bash
NODE_ENV=development npm run dev
```

Check logs in console for:
- Request details (method, URL, body)
- Error stack traces
- OpenAI API responses
- File upload information

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Setup
Ensure production `.env` has:
- Valid OpenAI API key with sufficient credits
- Appropriate rate limits for your use case
- CORS origins for your frontend domains

### Monitoring
Monitor these metrics:
- Request latency
- Error rates  
- OpenAI API usage/costs
- Storage usage in upload directory
- Rate limit triggers

## OpenAI Integration

### Image Requirements
- Formats: JPEG, PNG, WebP
- Size: <4MB (OpenAI requirement)
- Resolution: Automatically resized to 1024x1024

### Prompt Engineering
The app uses sophisticated prompts to ensure quality:

```
Edit this full-body photo with the following changes: 
Make the person heavier with realistic proportions, 
age the person by approximately 10 years with subtle wrinkles and mature posture,
preserve the original clothing exactly,
IMPORTANT: preserve face identity exactly, maintain the same facial features and expression,
keep background and lighting consistent with the original,
maintain the same camera angle and perspective,
ensure photorealistic results,
avoid any distortions or unnatural proportions.
The result should look natural and believable, maintaining the person's recognizable identity while applying only the requested body and age modifications.
```

### Error Handling
- Retry logic for temporary failures
- Specific error messages for different failure types
- Cost tracking and budget alerts (implement as needed)

## Troubleshooting

**Server won't start**
- Check Node.js version (requires 18+)
- Verify all dependencies installed
- Check port availability

**OpenAI errors**
- Verify API key is valid and has credits
- Check image size/format requirements  
- Monitor rate limits on OpenAI side

**High memory usage**
- Images are processed in memory
- Consider adding memory monitoring
- Implement cleanup for temporary files

**Rate limiting issues**
- Adjust limits in `.env`
- Consider IP whitelisting for development
- Implement user-based rate limiting