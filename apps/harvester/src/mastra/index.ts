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
import { registerApiRoute } from "@mastra/core/server";

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
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    enabled: false,
  },
  observability: {
    default: { enabled: true },
  },
  bundler: {
    transpilePackages: ["@roz/models", "@roz/supabase"],
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 8080,
    timeout: 60 * 60 * 1000,
    apiRoutes: [
      registerApiRoute("/health", {
        method: "GET",
        handler: async (c) => {
          return c.json({ ok: true }, 200);
        },
      }),
      registerApiRoute("/workflows/harvester/run", {
        method: "POST",
        handler: async (c) => {
          let rawInput;
          try {
            rawInput = await c.req.json();
          } catch (e) {
            return c.json(
              {
                ok: false,
                error: "Invalid JSON in request body",
                details: e instanceof Error ? e.message : String(e),
              },
              400
            );
          }

          const parseResult = digestWorkflow.inputSchema.safeParse(rawInput);
          if (!parseResult.success) {
            return c.json(
              {
                ok: false,
                error: "Invalid input payload",
                issues: parseResult.error.flatten(),
              },
              400
            );
          }
          const mastra = c.get("mastra");
          const wf = mastra.getWorkflow("digestWorkflow");
          if (!wf) {
            return c.json({ ok: false, error: `Workflow not found` }, 404);
          }

          const run = await wf.createRunAsync();
          const result = await run.start({
            inputData: parseResult.data,
          });

          switch (result.status) {
            case "success":
              return c.json({ ok: true, result });

            case "failed":
              return c.json(
                {
                  ok: false,
                  error: "Workflow run failed",
                  result,
                },
                500
              );

            case "suspended":
              return c.json(
                {
                  ok: false,
                  error: "Workflow run suspended",
                  result,
                },
                500
              );
          }
        },
      }),
    ],
  },
});
