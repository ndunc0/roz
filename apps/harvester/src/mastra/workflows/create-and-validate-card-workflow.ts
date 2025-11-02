import { createWorkflow } from "@mastra/core/workflows";
import {
  CreateWeeklyCardInputSchema,
  ValidatedCardOutputSchema,
} from "@lib/schemas/workflow-schemas";
import { createWeeklyCardStep } from "./steps/create-weekly-card-step";
import { validateCardStep } from "./steps/validate-card-step";

/**
 * Workflow that creates a weekly card and validates it.
 *
 * Input: Same schema as CreateWeeklyCardInputSchema (companyId, companyName, weekId, curatedTopics)
 * Output: Validation result + card data (ValidatedCardOutputSchema)
 *
 * This workflow is designed to be used in a loop (via dountil) to retry card creation
 * if the validator rejects it with REVISE_CARD action.
 */
export const createAndValidateCardWorkflow = createWorkflow({
  id: "create-and-validate-card",
  inputSchema: CreateWeeklyCardInputSchema,
  outputSchema: ValidatedCardOutputSchema,
})
  .then(createWeeklyCardStep)
  .then(validateCardStep)
  .commit();
