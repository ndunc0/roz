# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Roz** is a company digest generation system built as a Turborepo monorepo. It harvests content from company blogs and LinkedIn profiles, uses AI to analyze and curate the content, and generates weekly digest cards and emails for users following those companies.

### Tech Stack
- **Monorepo**: Turborepo with npm workspaces
- **Runtime**: Node.js ≥20.9.0
- **Language**: TypeScript (ES2022 modules)
- **AI Framework**: Mastra (agents, workflows, tools, evals)
- **Database**: Supabase (Postgres 17)
- **Web Scraping**: Stagehand (browser automation), BrightData

## Repository Structure

```
roz/
├── apps/
│   └── harvester/          # Main Mastra application for content harvesting
├── packages/
│   └── supabase/           # Database schema, migrations, and TypeScript types
├── package.json            # Root workspace config
└── turbo.json              # Turborepo task pipeline
```

## Essential Commands

### Development
```bash
# Run all apps/packages in dev mode (with hot reload)
npm run dev

# Run dev mode in harvester app only
cd apps/harvester && npm run dev

# Type check across all packages
npm run check-types
```

### Building
```bash
# Build all packages (runs in dependency order)
npm run build

# Build harvester specifically
cd apps/harvester && npm run build
```

### Mastra Operations (from apps/harvester/)
```bash
# Start Mastra dev server with hot reload
npm run dev

# Build the Mastra app
npm run build

# Start production Mastra server
npm start

# Type check only
npm run check-types
```

### Supabase Operations (from packages/supabase/)
```bash
# Start local Supabase instance (requires Supabase CLI installed)
supabase start

# Stop local instance
supabase stop

# Generate TypeScript types from database schema
supabase gen types typescript --local > src/types/database.types.ts

# Create new migration
supabase migration new <migration_name>

# Apply migrations locally
supabase migration up

# Reset database (WARNING: destroys data)
supabase db reset
```

## Architecture

### Apps: Harvester

The harvester is a Mastra application that orchestrates content collection, analysis, and curation through **agents**, **workflows**, and **tools**.

#### Path Aliases
The harvester uses TypeScript path aliases for clean imports:
- `@mastra/*` → `apps/harvester/src/mastra/*` (agents, workflows, tools)
- `@lib/*` → `apps/harvester/src/lib/*` (utilities, schemas, prompts, services)

#### Core Mastra Concepts

**Agents** (`apps/harvester/src/mastra/agents/`)
AI agents with specific responsibilities:
- `blog-post-summarizer-agent.ts` - Summarizes blog posts
- `linkedin-updates-agent.ts` - Summarizes LinkedIn posts
- `content-judge-agent.ts` - Analyzes summaries, scores topics by significance (1-10), ranks them, and outputs structured JSON for downstream processing

Each agent has:
- **name**: Unique identifier
- **description**: What it does
- **instructions**: System prompt (imported from `@lib/prompts/`)
- **model**: LLM to use (e.g., `anthropic/claude-sonnet-4-5`)
- **tools**: Available tools (can be empty object)
- **scorers**: Optional evals (e.g., relevancy, hallucination scoring)

**Workflows** (`apps/harvester/src/mastra/workflows/`)
Multi-step orchestration pipelines built with `createWorkflow()`:
- `digest-workflow.ts` - Main workflow that:
  1. Runs `getBlogUpdatesStep` and `getLinkedInUpdatesStep` in parallel
  2. Maps results to combine blog and LinkedIn summaries
  3. Runs `judgeContentStep` to curate topics
  4. Returns curated topics ready for email generation

Workflows use:
- `inputSchema` and `outputSchema` (Zod schemas)
- `.parallel([step1, step2])` - Run steps concurrently
- `.map(async fn => ...)` - Transform data between steps
- `.then(nextStep)` - Sequential step
- `.commit()` - Finalize workflow

**Workflow Steps** (`apps/harvester/src/mastra/workflows/steps/`)
Individual units of work created with `createStep()`:
- Each step has `id`, `inputSchema`, `outputSchema`, and `execute` function
- Steps can invoke agents using `.generate([{ role, content }])`

**Tools** (`apps/harvester/src/mastra/tools/`)
Reusable functions that can be attached to agents:
- `stagehand-harvest-recent-posts.ts` - Browser automation to scrape blog posts
  - Uses Stagehand (Browserbase) to navigate blogs, extract post links, visit posts, and extract content
  - **Important**: Only searches first page (no pagination)
  - Configurable: `windowDays` (default 7), `maxPosts` (default 10), `olderStreakToStop` (default 2)
- `brightdata-fetch-linkedin-posts.ts` - Trigger BrightData scraper for LinkedIn
- `brightdata-poll-snapshot.ts` - Poll BrightData API for scraper results

#### Mastra Configuration (`apps/harvester/src/mastra/index.ts`)
Central registration point:
```typescript
export const mastra = new Mastra({
  workflows: { digestWorkflow },
  agents: { blogPostSummarizerAgent, contentJudgeAgent, linkedInUpdatesAgent },
  storage: new LibSQLStore({ url: ":memory:" }),  // In-memory for dev
  logger: new PinoLogger({ name: "Mastra", level: "info" }),
  observability: { default: { enabled: true } },
});
```

#### Key Services (`apps/harvester/src/lib/services/`)
- `stagehand.ts` - Session manager for Stagehand browser automation
- `brightdata.ts` - BrightData API client

#### Schemas (`apps/harvester/src/lib/schemas/`)
Zod schemas for type safety and validation:
- `workflow-schemas.ts` - Core workflow input/output schemas
  - `CompanyInfoSchema`: `{ companyName, blogUrl, linkedInUrl }`
  - `JudgeContentInputSchema`: Extends CompanyInfoSchema with summaries
- `brightdata-schemas.ts` - BrightData API request/response schemas

### Packages: Supabase

Database package containing schema migrations and generated TypeScript types. See `packages/supabase/CLAUDE.md` for detailed database documentation.

#### Key Points
- **Local dev**: Supabase runs locally via Docker (ports 54321-54324)
- **Migrations**: Timestamped SQL files in `packages/supabase/migrations/`
- **Types**: Auto-generated in `src/types/database.types.ts` - **DO NOT EDIT MANUALLY**
- **Type imports**: `import type { Tables } from '@roz/supabase/types'`

#### Core Tables (brief)
- `company` - Company profiles (name, website, LinkedIn, blog URLs)
- `company_weekly_card` - Weekly digest cards with headlines, bullets (max 160 chars), significance scores
- `user_digest` - User-specific email digests
- `user_digest_card` - Join table linking digests to cards
- `user_follow_company` - User follows

## Workflow: Digest Generation Pipeline

The typical flow for generating a company digest:

1. **Input**: Company info (`companyName`, `blogUrl`, `linkedInUrl`)

2. **Parallel Content Collection**:
   - `getBlogUpdatesStep`: Uses `blogPostSummarizerAgent` to summarize recent blog posts
   - `getLinkedInUpdatesStep`: Uses `linkedInUpdatesAgent` to summarize LinkedIn updates

3. **Content Curation**:
   - `judgeContentStep`: Uses `contentJudgeAgent` to:
     - Identify distinct topics from all summaries
     - Score each topic 1-10 for significance
     - Categorize topics (Product Launch, Partnership, etc.)
     - Recommend coverage level (HIGH/MEDIUM/LOW/SKIP)
     - Output structured JSON with ranked topics

4. **Output**: Curated topics ready for final email generation (not yet implemented)

## Development Patterns

### Adding a New Agent
1. Create prompt in `apps/harvester/src/lib/prompts/<agent-name>-prompt.ts`
2. Create agent in `apps/harvester/src/mastra/agents/<agent-name>-agent.ts`
3. Import and configure with model, instructions, tools, scorers
4. Register in `apps/harvester/src/mastra/index.ts`

### Adding a New Workflow Step
1. Define input/output schemas (in `@lib/schemas/` or inline)
2. Create step file in `apps/harvester/src/mastra/workflows/steps/`
3. Use `createStep()` with `id`, schemas, and `execute` function
4. Import and compose in workflow using `.then()`, `.parallel()`, or `.map()`

### Adding a New Tool
1. Create tool in `apps/harvester/src/mastra/tools/<tool-name>.ts`
2. Use `createTool()` with `id`, `description`, `inputSchema`, `outputSchema`, `execute`
3. Add to agent's `tools` object when registering

### Creating Database Migrations
1. Create migration: `supabase migration new <description>`
2. Write SQL in `packages/supabase/migrations/<timestamp>_<description>.sql`
3. Follow pattern: CREATE → SET OWNER → GRANT permissions (anon, authenticated, service_role)
4. Apply: `supabase migration up`
5. Regenerate types: `supabase gen types typescript --local > src/types/database.types.ts`
6. Rebuild supabase package: `cd packages/supabase && npm run build`

## Important Notes

### Mastra Agent Instructions
- Prompts should be **detailed and explicit** - agents follow instructions literally
- Use structured output formats (like JSON) when downstream processing is needed
- The `content-judge-agent` outputs pure JSON (no markdown fences) for parsing

### Stagehand Tool Limitations
- **Only searches first page** of blog listings - no pagination
- Assumes recent posts appear first on the page
- Configurable parameters: `windowDays`, `maxPosts`, `olderStreakToStop`

### Type Safety
- Zod schemas define runtime validation **and** TypeScript types
- Use `z.infer<typeof Schema>` to extract TypeScript types from schemas
- All workflow inputs/outputs must have schemas

### Turborepo Task Dependencies
- `build` depends on `^build` (builds dependencies first)
- Tasks cache by default except `dev` (persistent, no cache)
- Global env loaded from `.env` at root

### Environment Variables
- `.env` files are gitignored
- Required for: API keys (OpenAI, BrightData, etc.), Supabase credentials
- Loaded automatically by Mastra and Supabase CLI

## Package Manager
- **npm** (version 11.6.2 specified in `packageManager` field)
- Workspaces enabled (`apps/*`, `packages/*`)
- Lock file is `package-lock.json`
