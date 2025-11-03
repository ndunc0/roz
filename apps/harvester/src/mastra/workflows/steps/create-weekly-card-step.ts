import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { cardWriterAgent } from "@mastra/agents/card-writer-agent";
import {
  CreateWeeklyCardInputSchema,
  WeeklyCardOutputSchema,
} from "@lib/schemas/workflow-schemas";
import { parseJsonFromLLM, formatWeekIdForHumans } from "@lib/utils";

export const createWeeklyCardStep = createStep({
  id: "create-weekly-card-step",
  inputSchema: CreateWeeklyCardInputSchema,
  outputSchema: WeeklyCardOutputSchema,
  execute: async ({ inputData }) => {
    const {
      companyId,
      companyName,
      weekId,
      curatedTopics,
      validationFeedback,
      previousCardData,
    } = inputData;

    // Generate deterministic cardId from companyId + weekId
    const cardId = `${companyId}__${weekId}`;

    // Convert week ID to human-readable format (e.g., "2025-W44" → "Oct 27")
    const weekDate = formatWeekIdForHumans(weekId);

    // Build the base prompt
    let prompt = `You are creating a weekly digest card for ${companyName} for the week of ${weekDate}.

Here are the curated topics from the editorial judge:

${curatedTopics}`;

    // If this is a retry, include validation feedback and previous attempt
    if (validationFeedback && previousCardData) {
      prompt += `

⚠️ IMPORTANT - THIS IS A RETRY ATTEMPT:
Your previous card was rejected by the validator. Here's what you created before:

PREVIOUS HEADLINE:
${previousCardData.headline}

PREVIOUS BULLETS:
${previousCardData.bulletsJson.map((b, i) => `${i + 1}. ${b} (${b.length} chars)`).join("\n")}

VALIDATION FEEDBACK:
${validationFeedback}

Please fix the issues mentioned above and create an improved version.`;
    }

    prompt += `

Please create a headline and 1-6 bullet points (typically 3) that capture the most significant updates from this week. Remember:
- This card covers the past 7 days of blog and LinkedIn activity (week of ${weekDate})
- Decide bullet count based on the week's activity level (1 = quiet, 3 = average, 6 = very busy)
- Headline should use "+" to connect themes
- Each bullet must be ≤ 160 characters including the "• " prefix
- Be specific with facts, dates, and metrics
- In sourceContext, use the format "Company blog + LinkedIn (week of ${weekDate})" or similar human-readable phrasing
- Output valid JSON only (no markdown, no explanatory text)`;

    const { text } = await cardWriterAgent.generate([
      { role: "user", content: prompt },
    ]);

    console.log("Card Writer Agent Output:", text);

    // Parse the agent's JSON response (strips markdown code fences if present)
    const cardData = parseJsonFromLLM(text);

    // Validate the card data structure
    if (
      !cardData.headline ||
      !Array.isArray(cardData.bullets) ||
      cardData.bullets.length < 1 ||
      cardData.bullets.length > 6 ||
      typeof cardData.significanceMax !== "number" ||
      !cardData.coverageTop
    ) {
      throw new Error(
        `Invalid card data structure from agent (expected 1-6 bullets): ${JSON.stringify(cardData)}`
      );
    }

    // Construct the complete weekly card object (LLM returns camelCase)
    return {
      curatedTopics, // Pass through for workflow output
      cardId,
      companyId,
      companyName, // Pass through for retries in dountil loops
      weekId,
      version: 1,
      headline: cardData.headline,
      bulletsJson: cardData.bullets,
      significanceMax: cardData.significanceMax,
      coverageTop: cardData.coverageTop,
      sourceContext: cardData.sourceContext || null,
    };
  },
});
