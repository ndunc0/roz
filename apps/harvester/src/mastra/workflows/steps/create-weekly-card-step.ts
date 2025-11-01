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
    const { companyId, companyName, weekId, curatedTopics } = inputData;

    // Generate deterministic card_id from company_id + week_id
    const cardId = `${companyId}__${weekId}`;

    // Convert week ID to human-readable format (e.g., "2025-W44" → "Oct 27")
    const weekDate = formatWeekIdForHumans(weekId);

    const prompt = `You are creating a weekly digest card for ${companyName} for the week of ${weekDate}.

Here are the curated topics from the editorial judge:

${curatedTopics}

Please create a headline and 1-6 bullet points (typically 3) that capture the most significant updates from this week. Remember:
- This card covers the past 7 days of blog and LinkedIn activity (week of ${weekDate})
- Decide bullet count based on the week's activity level (1 = quiet, 3 = average, 6 = very busy)
- Headline should use "+" to connect themes
- Each bullet must be ≤ 160 characters including the "• " prefix
- Be specific with facts, dates, and metrics
- In source_context, use the format "Company blog + LinkedIn (week of ${weekDate})" or similar human-readable phrasing
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
      typeof cardData.significance_max !== "number" ||
      !cardData.coverage_top
    ) {
      throw new Error(
        `Invalid card data structure from agent (expected 1-6 bullets): ${JSON.stringify(cardData)}`
      );
    }

    // Validate bullet lengths (max 160 characters)
    for (const bullet of cardData.bullets) {
      if (bullet.length > 160) {
        console.warn(
          `Bullet exceeds 160 characters (${bullet.length}): "${bullet}"`
        );
        // Truncate if needed
        cardData.bullets[cardData.bullets.indexOf(bullet)] = bullet
          .substring(0, 157)
          .concat("...");
      }
    }

    // Construct the complete weekly card object
    return {
      curatedTopics, // Pass through for workflow output
      card_id: cardId,
      company_id: companyId,
      week_id: weekId,
      version: 1,
      headline: cardData.headline,
      bullets_json: cardData.bullets,
      significance_max: cardData.significance_max,
      coverage_top: cardData.coverage_top,
      source_context: cardData.source_context || null,
    };
  },
});
