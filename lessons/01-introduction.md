# What is an AI Product and Why This Project?

## Understanding AI Products

An **AI product** is software that uses artificial intelligence (specifically Large Language Models or LLMs) to provide value to users. Unlike traditional software that follows rigid rules, AI products leverage the reasoning capabilities of language models to understand context, generate insights, and adapt to user needs.

### Key Characteristics of AI Products

1. **Probabilistic, not Deterministic**: Traditional software: input A always produces output B. AI products: input A produces output B most of the time, but may vary based on context, model state, and prompt design.

2. **Context-Aware**: AI products understand nuance, context, and implicit meaning. They can analyze "Can you finally send the document?" and understand the frustration behind "finally" without explicit rules.

3. **Natural Language Interface**: Users interact in natural language, not structured queries. The AI interprets intent from conversational text.

4. **Multi-Step Reasoning**: AI products often break complex tasks into multiple analysis steps, each feeding into the next.

## What is This Project?

This repository implements a **Communication Mirror** - an AI agent that analyzes the emotional and relational impact of messages before you send them. It's designed to help people understand how their communication might be perceived.

### What It Does

When you type a message like "Can you finally send the document today?", the system:

1. **Analyzes Intent**: What are you really trying to accomplish? (Primary, secondary, implicit goals)
2. **Detects Tone**: What emotions does your message convey? (Frustration, impatience, etc.)
3. **Predicts Impact**: How will the recipient likely respond? (Friction, defensiveness, cooperation likelihood)
4. **Suggests Alternatives**: Offers 3 different phrasings that might improve communication

### Why This Project Exists

**Goal: Understanding, not production.**

This project is a **learning tool** designed to teach you:

- How to structure multi-step AI reasoning
- Prompt engineering that actually works (not just examples)
- Local LLM integration with `node-llama-cpp`
- Building without frameworks (so you understand what's happening)

### What's Included

**INCLUDED:**
- **Core AI Logic**: Multi-step analysis pipeline  
- **Local LLM Integration**: Runs models on your machine (no API keys needed)  
- **Structured Output**: JSON schemas and grammar constraints  
- **Session Management**: Conversation context tracking  
- **Frontend Integration**: React UI that consumes AI APIs  
- **Error Handling**: Validation, retry logic, truncation detection  
- **Comprehensive Documentation**: Inline comments explaining design decisions

### What's Intentionally Excluded

**EXCLUDED:**
- **Production Concerns**: No authentication, rate limiting, or security hardening  
- **Scalability**: Single-server, in-memory sessions (lost on restart)  
- **Frameworks**: Minimal dependencies to understand what's happening  
- **Deployment**: No Docker, Kubernetes, or cloud infrastructure  
- **Database**: Sessions stored in memory, not persisted  
- **Monitoring**: Basic logging, no metrics/alerting systems

### Why These Exclusions?

**Focus on Learning**: Production concerns (auth, scaling, deployment) are important but distract from understanding how AI products work at their core. This project strips away everything except the essential AI logic.

**Understand the Fundamentals**: By avoiding frameworks and abstractions, you see exactly how prompts are built, how LLMs are called, and how outputs are validated. This knowledge transfers to any framework or production environment.

**Local First**: Using local LLMs (instead of API calls) means:
- No API keys or costs
- Full control over model behavior
- Understand inference latency and resource usage
- See exactly what the model generates (via logs)

## How This Repository Serves as a Learning Tool

### 1. Real, Working Code

This isn't a tutorial with simplified examples. It's a **complete, functional AI product** that you can run, modify, and learn from. Every design decision is documented in code comments.

### 2. Progressive Complexity

The codebase follows a clear structure:
- **Building Blocks** (`backend/lib/`): Core AI logic (prompts, LLM service, validation)
- **API Layer** (`backend/src/routes/`): REST endpoints that expose AI capabilities
- **Frontend** (`frontend/`): React UI that demonstrates real-world integration

### 3. Design Decision Documentation

Every major component includes comments explaining:
- **Why** this approach was chosen
- **Alternatives** that were considered and rejected
- **Trade-offs** made
- **How** it relates to other components

For example, see [`backend/lib/prompts.ts`](../backend/lib/prompts.ts) - each prompt function includes extensive documentation about calibration rules, edge cases, and why certain wording was chosen.

### 4. Learn by Reading, Not Just Building

You can learn by:
- **Reading the code**: Understand how prompts are structured
- **Running the code**: See it in action, modify prompts, observe changes
- **Following the lessons**: This folder provides guided learning paths

## What You'll Learn

By studying this codebase, you'll understand:

1. **Prompt Engineering**: Not just "how to write prompts," but how to solve real problems (over-interpretation, inconsistent outputs, truncation) through prompt design.

2. **Structured Output**: How to enforce JSON schemas using grammar constraints, validate outputs, and handle edge cases.

3. **Multi-Step Reasoning**: How to decompose complex tasks (analyzing communication) into parallel analysis steps (intent, tone, impact, alternatives).

4. **Error Handling**: How to validate LLM outputs, detect truncation, implement retry logic, and gracefully handle failures.

5. **API Design**: How to expose AI capabilities through REST APIs, manage sessions, and structure endpoints.

6. **Frontend Integration**: How to build React UIs that consume AI APIs, handle loading states, and display analysis results.

## How to Use This Repository

### Building Blocks First 

Start with fundamentals and build up:
1. Introduction (this file)
2. Local LLM Basics
3. Prompt Engineering
4. Structured Output
5. Multi-Step Reasoning
6. API Design
7. Frontend Integration
8. Session Management
9. Validation & Error Handling
10. Trade-offs & Lessons

## What's Different in Production?

### 1. **Authentication & Authorization**

**This Project**: No authentication. Anyone can call the API.

**Production**: 
- API keys or OAuth tokens
- User authentication (login/signup)
- Role-based access control
- Rate limiting per user/API key

### 2. **Scalability**

**This Project**: Single server, in-memory sessions, sequential model loading.

**Production**:
- Horizontal scaling (multiple servers)
- Load balancers
- Session storage in Redis/database
- Model serving infrastructure (separate from API servers)
- Queue systems for long-running analyses

### 3. **Model Management**

**This Project**: One model loaded at startup, runs on CPU.

**Production**:
- Multiple models (different sizes for different use cases)
- GPU acceleration (faster inference)
- Model versioning and A/B testing
- Dynamic model loading/unloading
- Model serving clusters (separate from API)

### 4. **Data Persistence**

**This Project**: Sessions stored in memory, lost on restart.

**Production**:
- Database for sessions, user data, analysis history
- Backup and recovery systems
- Data retention policies
- Analytics and usage tracking

### 5. **Error Handling & Monitoring**

**This Project**: Console logs, basic error responses.

**Production**:
- Structured logging (JSON logs, log aggregation)
- Error tracking (Sentry, Rollbar)
- Metrics and alerting (Prometheus, Datadog)
- Health checks and uptime monitoring
- Incident response procedures

### 6. **Security**

**This Project**: Basic CORS, no input sanitization.

**Production**:
- Input validation and sanitization
- SQL injection prevention (if using databases)
- XSS protection
- Rate limiting and DDoS protection
- Secrets management (API keys, tokens)
- HTTPS/TLS encryption

### 7. **Cost Management**

**This Project**: Free (local models, no API costs).

**Production**:
- API usage tracking and billing
- Cost optimization (caching, model selection)
- Budget alerts and limits
- Usage analytics per user/feature

### 8. **Testing**

**This Project**: Manual testing, no automated tests.

**Production**:
- Unit tests for core logic
- Integration tests for API endpoints
- E2E tests for critical flows
- Prompt testing framework (evaluate outputs)
- Regression testing for model updates

### 9. **Deployment**

**This Project**: Run locally with `npm run dev`.

**Production**:
- CI/CD pipelines
- Containerization (Docker)
- Orchestration (Kubernetes)
- Blue-green deployments
- Rollback procedures
- Environment management (dev/staging/prod)

### 10. **User Experience**

**This Project**: Basic UI, no loading states for model initialization.

**Production**:
- Progressive loading (show partial results)
- Optimistic updates
- Offline support
- Mobile responsiveness
- Accessibility (WCAG compliance)
- Performance optimization (code splitting, lazy loading)

