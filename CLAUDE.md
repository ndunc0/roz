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
- `card-writer-agent.ts` - Transforms curated topics into polished weekly digest cards with headline and 1-6 bullet points (typically 3), enforcing 160-character limit per bullet
- `card-validator-agent.ts` - Quality assurance agent that validates cards before upload; checks structural compliance, content quality, factual accuracy, and editorial judgment; decides to APPROVE, REVISE_CARD, or RESTART_WORKFLOW

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
  4. Loops `createAndValidateCardWorkflow` (up to 5 times) until card is approved
  5. Uploads approved card to Supabase via `uploadCardStep`
  6. Returns success status, curated topics, and weekly card object

- `create-and-validate-card-workflow.ts` - Nested workflow that:
  1. Runs `createWeeklyCardStep` to generate card
  2. Runs `validateCardStep` to check quality
  3. Returns validation result + card data

Workflows use:
- `inputSchema` and `outputSchema` (Zod schemas)
- `.parallel([step1, step2])` - Run steps concurrently
- `.dountil(step, condition)` - Loop step until condition is met
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
  agents: {
    blogPostSummarizerAgent,
    contentJudgeAgent,
    cardWriterAgent,
    linkedInUpdatesAgent
  },
  storage: new LibSQLStore({ url: ":memory:" }),  // In-memory for dev
  logger: new PinoLogger({ name: "Mastra", level: "info" }),
  observability: { default: { enabled: true } },
});
```

#### Key Services & Utilities (`apps/harvester/src/lib/`)

**Services** (`services/`):
- `stagehand.ts` - Session manager for Stagehand browser automation
- `brightdata.ts` - BrightData API client

**Utilities** (`utils.ts`):
- `parseJsonFromLLM()` - Strips markdown code fences from LLM JSON output
- `parseJSONorJSONL()` - Parses JSON or JSONL format with fallback
- `getWeekId()` - Generates ISO 8601 week identifiers (e.g., "2025-W44")
- `formatWeekIdForHumans()` - Converts week IDs to readable format (e.g., "Oct 27")

#### Schemas (`apps/harvester/src/lib/schemas/`)
Zod schemas for type safety and validation (all use **camelCase** field names):
- `workflow-schemas.ts` - Core workflow input/output schemas
  - `CompanyInfoSchema`: `{ companyId, companyName, blogUrl, linkedInUrl }`
  - `JudgeContentInputSchema`: Extends CompanyInfoSchema with summaries
  - `CreateWeeklyCardInputSchema`: `{ companyId, companyName, weekId, curatedTopics }`
  - `WeeklyCardOutputSchema`: Complete card object with `cardId`, `headline`, `bulletsJson`, etc.
  - `WeeklyCardDataSchema`: Card data without `curatedTopics` field
  - `CardValidationResultSchema`: Validation result structure
  - `ValidatedCardOutputSchema`: Combined validation + card data
  - `DigestWorkflowOutputSchema`: Final digest workflow output
- `brightdata-schemas.ts` - BrightData API request/response schemas

**Important**: All application schemas use **camelCase** field names (e.g., `cardId`, `companyId`, `weekId`). When interfacing with the database, fields are converted to **snake_case** (e.g., `card_id`, `company_id`, `week_id`) to match database column names.

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

1. **Input**: Company info (`companyId`, `companyName`, `blogUrl`, `linkedInUrl`)

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

4. **Card Generation & Validation Loop** (up to 5 iterations):
   - `createWeeklyCardStep`: Uses `cardWriterAgent` to:
     - Transform curated topics into a polished weekly card
     - Generate headline (60-100 chars) connecting themes with "+"
     - Create 1-6 bullet points (typically 3) based on week's activity
     - Enforce 160-character limit per bullet
     - Generate deterministic `cardId` from `companyId` + `weekId`
     - Include metadata (`significanceMax`, `coverageTop`, `sourceContext`)
     - Output uses **camelCase** field names
   - `validateCardStep`: Uses `cardValidatorAgent` to:
     - Check structural compliance (headline length, bullet count, character limits)
     - Verify content quality (specific, compelling, professional)
     - Ensure factual accuracy (info matches curated topics)
     - Assess editorial judgment (captures most newsworthy info)
     - Decide: APPROVE, REVISE_CARD, or RESTART_WORKFLOW
   - If REVISE_CARD: Loop back to `createWeeklyCardStep` (max 5 times)
   - If RESTART_WORKFLOW: Throw error (manual intervention required)
   - If APPROVE: Proceed to upload

5. **Upload to Database**:
   - `uploadCardStep`: Inserts approved card into Supabase
     - Converts camelCase fields to snake_case for database
     - Inserts into `company_weekly_card` table
     - Returns success status and card metadata

6. **Output**:
   - `success`: Boolean indicating upload success
   - `cardId`: Uploaded card identifier
   - `message`: Success message
   - `curatedTopics`: JSON string with ranked topics
   - `weeklyCard`: Complete card object (camelCase format)

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
- The `content-judge-agent` and `card-writer-agent` output pure JSON (no markdown fences) for parsing
- Use `parseJsonFromLLM()` utility to safely parse LLM output and strip markdown code fences if present
- All agents return **camelCase** field names in JSON output to match application conventions

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
