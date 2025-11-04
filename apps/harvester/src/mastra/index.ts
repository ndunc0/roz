import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { blogPostSummarizerAgent } from "./agents/blog-post-summarizer-agent";
import { contentJudgeAgent } from "./agents/content-judge-agent";
import { cardWriterAgent } from "./agents/card-writer-agent";
import { cardValidatorAgent } from "./agents/card-validator-agent";
import { digestWorkflow } from "./workflows/digest-workflow";
import { linkedInUpdatesAgent } from "./agents/linkedin-updates-agent";
import { createAndValidateCardWorkflow } from "./workflows/create-and-validate-card-workflow";

export const mastra = new Mastra({
  workflows: { digestWorkflow, createAndValidateCardWorkflow },
  agents: {
    blogPostSummarizerAgent,
    contentJudgeAgent,
    cardWriterAgent,
    cardValidatorAgent,
    linkedInUpdatesAgent,
  },
  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
  bundler: {
    transpilePackages: ["@roz/models", "@roz/supabase"],
    sourcemap: true,
  },
});
