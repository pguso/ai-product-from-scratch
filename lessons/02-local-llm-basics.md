# Understanding Local LLMs and GGUF Models

## What Are Local LLMs?

**Local LLMs** are Large Language Models that run on your own hardware (your computer, server, or edge device) instead of being accessed via API calls to cloud services like OpenAI or Anthropic.

### Key Differences: Local vs. Cloud

| Aspect | Local LLMs | Cloud APIs (OpenAI, Anthropic) |
|--------|------------|-------------------------------|
| **Privacy** | Data never leaves your machine | Data sent to third-party servers |
| **Cost** | One-time model download (free) | Pay per API call (ongoing costs) |
| **Latency** | Depends on your hardware | Usually faster (powerful GPUs) |
| **Control** | Full control over model behavior | Limited to API parameters |
| **Offline** | Works without internet | Requires internet connection |
| **Setup** | Download model, configure | Just API key |
| **Hardware** | Requires RAM/VRAM | No hardware needed |

### Why Use Local LLMs?

1. **Privacy**: Sensitive data (messages, conversations) never leaves your machine
2. **Cost Control**: No per-request costs - download once, use forever
3. **Learning**: Understand how models work, experiment with prompts freely
4. **Customization**: Fine-tune models, adjust inference parameters
5. **Offline**: Works without internet (useful for edge deployments)

### Trade-offs

**Downsides of Local LLMs:**
- Requires significant RAM (4GB-16GB+ depending on model size)
- Slower than cloud APIs (unless you have powerful GPUs)
- Model management (downloading, updating, storing large files)
- Limited model selection (must be compatible with your runtime)

## What is GGUF Format?

**GGUF** (GPT-Generated Unified Format) is a file format for storing LLM models. It's the successor to GGML and is optimized for efficient inference on consumer hardware.

### Why GGUF?

1. **Quantization Support**: Models can be compressed (reduced precision) to save RAM
2. **Fast Loading**: Optimized for quick model loading
3. **Cross-Platform**: Works on CPU, GPU (CUDA, Metal, etc.)
4. **Efficient Inference**: Optimized for real-time generation

### Quantization Levels

Quantization reduces model size by using fewer bits per weight. Here's what the codes mean:

| Quantization | Quality | File Size | RAM Usage | Best For |
|--------------|---------|-----------|-----------|----------|
| **Q8_0** | Highest | Largest | Highest | Best quality, 8GB+ RAM |
| **Q6_K** | High | Medium | Medium | **Recommended** - good balance |
| **Q5_K_M** | Good | Medium | Medium | Good balance |
| **Q4_K_M** | Fair | Small | Low | Limited RAM (4-6GB) |
| **Q3_K_M** | Lower | Smaller | Lower | Very limited RAM |
| **Q2_K** | Lowest | Smallest | Lowest | Minimal RAM only |

**Example**: A 7B parameter model:
- **Q8_0**: ~7GB file, ~7GB RAM (highest quality)
- **Q6_K**: ~4.5GB file, ~4.5GB RAM (recommended)
- **Q4_K_M**: ~3GB file, ~3GB RAM (lower quality, but usable)

**Trade-off**: Lower quantization = smaller file, less RAM, but lower quality outputs.

## How This Project Uses Local LLMs

### Model Loading

The project uses `node-llama-cpp`, a Node.js binding for the llama.cpp library. Here's how models are loaded:

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
import { getLlama, Llama, LlamaModel } from 'node-llama-cpp';

// Initialize llama.cpp runtime
const llama = await getLlama();

// Load model from GGUF file
const model = new LlamaModel({
  modelPath: config.modelPath, // e.g., "./models/qwen3-1.7b-instruct.Q6_K.gguf"
});
```

**Key Points:**
- Model path is configured via `MODEL_PATH` environment variable
- Model loads asynchronously (non-blocking)
- Model stays in memory once loaded (shared across requests)

### Model Initialization Flow

**File**: [`backend/src/model-loader.ts`](../backend/src/model-loader.ts)

```typescript
export async function initializeModel(
  llmService: LLMService,
  modelPath: string,
  state: ModelLoaderState
): Promise<void> {
  state.loading = true;
  try {
    await llmService.initialize(); // Loads the GGUF model into memory
    console.log('Model loaded successfully');
  } catch (error) {
    state.error = error;
  } finally {
    state.loading = false;
  }
}
```

**What Happens:**
1. Server starts, begins loading model in background
2. API endpoints check if model is ready (middleware: `requireModelReady`)
3. If not ready, returns 503 (Service Unavailable)
4. Once loaded, all analysis requests can proceed

### Model Configuration

**File**: [`backend/src/config.ts`](../backend/src/config.ts)

```typescript
export const config = {
  modelPath: process.env.MODEL_PATH || './models/model.gguf',
  // ... other config
};
```

**Environment Variable**: `MODEL_PATH` in `backend/.env`

```bash
MODEL_PATH=./models/Qwen3-1.7b-Q8_0.gguf
```

### Inference Parameters

When generating responses, the project uses these parameters:

**File**: [`backend/lib/generator.ts`](../backend/lib/generator.ts)

```typescript
const response = await session.prompt(prompt, {
  grammar,           // JSON schema grammar (enforces structure)
  maxTokens: 2048,    // Maximum tokens to generate
  temperature: 0.7,   // Creativity/randomness (0.0 = deterministic, 1.0 = creative)
});
```

**Parameters Explained:**
- **`grammar`**: JSON schema that constrains output to valid JSON structure
- **`maxTokens`**: Limits response length (prevents infinite generation)
- **`temperature`**: Controls randomness (0.7 = balanced, good for analysis tasks)

## Understanding Model Requirements

### RAM Requirements by Model Size

| Model Size | Minimum RAM | Recommended RAM | Disk Space |
|------------|-------------|-----------------|------------|
| **1.7B** (Q6_K) | 3GB | 5GB | 1.5GB |
| **4B** (Q6_K) | 6GB | 8GB | 3GB |
| **8B** (Q6_K) | 8GB | 12GB | 5GB |

**Note**: These are approximate. Actual usage depends on:
- Quantization level (Q8_0 uses more RAM than Q4_K_M)
- Context size (longer conversations = more RAM)
- System overhead (OS, other processes)

### CPU vs. GPU

**CPU (Default)**:
- Works on any machine
- Slower (2-8 seconds per analysis)
- Uses system RAM
- No special hardware needed

**GPU (Optional)**:
- Much faster (0.5-2 seconds per analysis)
- Requires CUDA (NVIDIA) or Metal (Apple Silicon)
- Uses VRAM (dedicated GPU memory)
- Requires compatible GPU

**To Enable GPU**: Modify [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts) to set `gpuLayers` parameter (advanced, see node-llama-cpp docs).

## How Models Are Used in This Project

### Single Model, Multiple Analyses

The project loads **one model** and uses it for all analysis types:

1. **Intent Analysis**: "What is the speaker trying to accomplish?"
2. **Tone Analysis**: "What emotions does this convey?"
3. **Impact Analysis**: "How will the recipient respond?"
4. **Alternatives Generation**: "What are better ways to phrase this?"

All four analyses use the **same model instance**, just with different prompts.

### Context Management

**File**: [`backend/lib/llm-service.ts`](../backend/lib/llm-service.ts)

```typescript
// Create a context sequence (manages conversation context)
const contextSequence = new LlamaContextSequence({
  model,
  contextSize: 4096, // Maximum context length
});
```

**Context Size**: 4096 tokens (approximately 3000 words). This limits:
- How much conversation history can be included
- Maximum prompt length
- Maximum response length

**Why This Matters**: If your prompt + context + response exceeds 4096 tokens, it will be truncated. The project handles this by:
- Limiting context history (see [`session-manager.ts`](../backend/lib/session-manager.ts))
- Setting `maxTokens` to prevent overly long responses
- Detecting truncation and retrying (see [`generator.ts`](../backend/lib/generator.ts))

## Model Selection Guide

### For This Project

**Recommended Models** (tested and working):
- **Qwen3-1.7B-Q6_K**: Best for beginners (small, fast, good quality)
- **Qwen3-4B-Q6_K**: Best balance (medium size, better quality)
- **Qwen3-8B-Q6_K**: Best quality (larger, slower, most accurate)

**Where to Download**:
- Hugging Face: https://huggingface.co/models?search=qwen3+gguf
- TheBloke (reliable quantizations): https://huggingface.co/TheBloke

**Download Instructions**: See [`README.md`](../README.md) for detailed download steps.

### Choosing the Right Model

**Start Small**: If you're learning, start with 1.7B Q6_K. It's fast, uses little RAM, and produces ok results for this use case.

**Scale Up**: If you have more RAM and want good quality, try 4B or 8B models.

**Test Different Quantizations**: If 1.7B Q6_K is too slow, try Q4_K_M (faster, lower quality). If quality is poor, try Q8_0 (slower, higher quality).

## Common Issues and Solutions

### Issue: "Out of Memory" Error

**Cause**: Model is too large for available RAM.

**Solutions**:
1. Use a smaller model (1.7B instead of 8B)
2. Use lower quantization (Q4_K_M instead of Q6_K)
3. Close other applications to free RAM
4. Reduce context size (if configurable)

### Issue: Model Loading Takes Forever

**Cause**: Large model file, slow disk, or insufficient RAM causing swapping.

**Solutions**:
1. Use SSD instead of HDD (faster loading)
2. Ensure sufficient RAM (prevents disk swapping)
3. Be patient - 4GB+ models can take 30-60 seconds to load

### Issue: Slow Inference

**Cause**: CPU-only inference, large model, or high quantization.

**Solutions**:
1. Use smaller model (1.7B instead of 8B)
2. Enable GPU acceleration (if available)
3. Reduce context size
4. Accept slower speed (CPU inference is inherently slower)

## What's Different in Production?

### 1. **Model Serving Infrastructure**

**This Project**: Model loaded in API server process.

**Production**:
- **Separate Model Servers**: Models run on dedicated GPU servers
- **API Servers**: Lightweight, just forward requests to model servers
- **Load Balancing**: Multiple model servers for high availability
- **Model Versioning**: A/B test different models, rollback if needed

### 2. **Model Selection**

**This Project**: One model, configured at startup.

**Production**:
- **Multiple Models**: Different models for different use cases
  - Fast model (1.7B) for simple tasks
  - Quality model (8B+) for complex analysis
  - Specialized models (fine-tuned for specific domains)
- **Dynamic Selection**: Route requests to appropriate model based on complexity
- **Model Caching**: Keep multiple models in memory, load/unload as needed

### 3. **GPU Acceleration**

**This Project**: CPU-only (works everywhere, but slower).

**Production**:
- **GPU Clusters**: Dedicated GPU servers (NVIDIA A100, H100)
- **Batch Processing**: Process multiple requests together (more efficient GPU usage)
- **Model Quantization**: Use INT8/INT4 quantization for faster inference
- **Tensor Parallelism**: Split large models across multiple GPUs

### 4. **Model Updates**

**This Project**: Manual - download new model, update `MODEL_PATH`, restart.

**Production**:
- **Zero-Downtime Updates**: Load new model, switch traffic gradually
- **A/B Testing**: Run old and new models in parallel, compare results
- **Rollback**: Instant rollback if new model performs worse
- **Versioning**: Track which model version processed each request

### 5. **Cost Optimization**

**This Project**: Free (local models, no API costs).

**Production**:
- **Model Selection**: Use smallest model that meets quality requirements
- **Caching**: Cache common analyses (same message = same result)
- **Batching**: Process multiple requests together (better GPU utilization)
- **Quantization**: Use lower precision (INT8 instead of FP16) to reduce costs
- **Auto-scaling**: Scale down during low traffic, scale up during peaks

### 6. **Monitoring**

**This Project**: Console logs, basic status endpoint.

**Production**:
- **Latency Metrics**: Track inference time per model/request type
- **Quality Metrics**: Monitor output quality (validation failure rates, user feedback)
- **Resource Usage**: Track GPU/CPU/RAM utilization
- **Error Tracking**: Alert on model failures, OOM errors, timeouts
- **Cost Tracking**: Monitor inference costs per model/endpoint

### 7. **Hybrid Approach**

**Production Often Uses**:
- **Local Models**: For privacy-sensitive data, offline use, cost control
- **Cloud APIs**: For high-traffic, low-latency needs, or when local hardware is insufficient
- **Hybrid**: Route based on data sensitivity, latency requirements, or cost

