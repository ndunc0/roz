import { createStep } from "@mastra/core/workflows";
import { cardValidatorAgent } from "@mastra/agents/card-validator-agent";
import {
  WeeklyCardOutputSchema,
  ValidatedCardOutputSchema,
} from "@lib/schemas/workflow-schemas";
import { parseJsonFromLLM } from "@lib/utils";

export const validateCardStep = createStep({
  id: "validate-card-step",
  inputSchema: WeeklyCardOutputSchema,
  outputSchema: ValidatedCardOutputSchema,
  execute: async ({ inputData }) => {
    const { curatedTopics, ...cardData } = inputData;

    const prompt = `Please validate the following weekly digest card:

CARD DATA:
${JSON.stringify(cardData, null, 2)}

CURATED TOPICS (used to create this card):
${curatedTopics}

COMPANY INFO:
- Company ID: ${cardData.companyId}
- Week ID: ${cardData.weekId}

Please review the card for:
1. Structural compliance (headline length, bullet count, character limits)
2. Content quality (specific, compelling, professional)
3. Factual accuracy (all info supported by curated topics)
4. Editorial judgment (captures most newsworthy information)

Output your decision as valid JSON only (no markdown, no explanatory text).`;

    const { text } = await cardValidatorAgent.generate([
      { role: "user", content: prompt },
    ]);

    console.log("Card Validator Agent Output:", text);

    // Parse the agent's JSON response
    const validationResult = parseJsonFromLLM(text);

    // Validate the response structure
    if (
      typeof validationResult.approved !== "boolean" ||
      !["APPROVE", "REVISE_CARD", "RESTART_WORKFLOW"].includes(
        validationResult.action
      ) ||
      !validationResult.reason
    ) {
      throw new Error(
        `Invalid validation result from agent: ${JSON.stringify(validationResult)}`
      );
    }

    // Return validation result with the card data attached
    return {
      approved: validationResult.approved,
      action: validationResult.action,
      reason: validationResult.reason,
      feedback: validationResult.feedback || "",
      weeklyCard: inputData, // Pass through the complete card data
    };
  },
});
