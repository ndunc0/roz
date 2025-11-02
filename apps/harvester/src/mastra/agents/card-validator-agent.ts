import { cardValidatorPrompt } from "@lib/prompts/card-validator-prompt";
import { Agent } from "@mastra/core/agent";

export const cardValidatorAgent = new Agent({
  name: "card-validator-agent",
  description:
    "Quality assurance agent that validates weekly digest cards before publication. Checks structural compliance, content quality, factual accuracy, and editorial judgment. Decides whether to approve, revise, or restart the workflow.",
  instructions: cardValidatorPrompt,
  model: "anthropic/claude-sonnet-4-5",
});
