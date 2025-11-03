/**
 * Parses a string containing either JSON or JSONL (JSON Lines) format.
 * Attempts standard JSON parsing first, then falls back to JSONL if that fails.
 * JSONL results are flattened into a single array.
 *
 * @param rawText - The raw text string to parse (JSON or JSONL format)
 * @returns The parsed data structure
 * @throws {Error} When the input cannot be parsed as either format
 */
export function parseJSONorJSONL(rawText: string) {
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseError) {
    // If it's JSONL (JSON Lines), split by newlines and parse each line
    const lines = rawText.trim().split("\n");
    if (lines.length > 1) {
      console.log(
        `Detected JSONL format with ${lines.length} lines, parsing each line`
      );
      data = lines
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      // Flatten if it's an array of arrays
      data = data.flat();
    } else {
      throw new Error(
        `Failed to parse response as JSON: ${parseError}. Raw response: ${rawText.substring(0, 200)}`
      );
    }
  }

  return data;
}

/**
 * Parses JSON from an LLM response, automatically stripping markdown code fences if present.
 * Many LLMs add ```json...``` wrappers despite instructions to output pure JSON.
 *
 * @param text - Raw text from LLM that should contain JSON (possibly wrapped in markdown)
 * @returns Parsed JSON object
 * @throws {Error} When the text cannot be parsed as JSON after cleaning
 *
 * @example
 * ```ts
 * // Handles pure JSON
 * parseJsonFromLLM('{"key": "value"}') // Returns { key: "value" }
 *
 * // Handles markdown-wrapped JSON
 * parseJsonFromLLM('```json\n{"key": "value"}\n```') // Returns { key: "value" }
 * ```
 */
export function parseJsonFromLLM(text: string): any {
  // Strip markdown code fences if present
  let cleanedText = text.trim();

  if (cleanedText.startsWith("```json")) {
    cleanedText = cleanedText.slice(7); // Remove ```json
  } else if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.slice(3); // Remove ```
  }

  if (cleanedText.endsWith("```")) {
    cleanedText = cleanedText.slice(0, -3); // Remove trailing ```
  }

  cleanedText = cleanedText.trim();

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    throw new Error(
      `Failed to parse LLM output as JSON: ${error}. Original text: ${text.substring(0, 200)}...`
    );
  }
}

/**
 * Generates an ISO 8601 week identifier (e.g., "2024-W15") for a given date in a specific timezone.
 *
 * Uses ISO week date system where weeks start on Monday and week 1 contains the first Thursday of the year.
 *
 * @param date - The date to calculate the week for. Defaults to current date.
 * @param timeZone - IANA timezone identifier. Defaults to "America/Los_Angeles".
 * @returns ISO week string in format "YYYY-Wnn" (e.g., "2024-W01").
 *
 * @example
 * ```ts
 * getWeekId(new Date('2024-01-15'), 'America/Los_Angeles') // Returns "2024-W03"
 * getWeekId() // Returns current week in Pacific timezone
 * ```
 */
export function getWeekId(
  date: Date = new Date(),
  timeZone = "America/Los_Angeles"
): string {
  // Get the Y-M-D for the given TZ
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);

  // Create a UTC date representing that local TZ date (avoid DST issues)
  const utc = new Date(Date.UTC(y, m - 1, d));

  // ISO week calc (Mon=0..Sun=6)
  const day = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - day + 3); // go to Thursday of this week
  const isoYear = utc.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  const firstThuDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDay + 3);

  const week =
    1 + Math.round((utc.getTime() - firstThu.getTime()) / 604_800_000);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Converts an ISO 8601 week identifier to a human-readable format.
 * Returns the Monday of that week formatted as "MMM D" (e.g., "Oct 27").
 *
 * @param weekId - ISO week string in format "YYYY-Wnn" (e.g., "2025-W44")
 * @returns Human-readable date string (e.g., "Oct 27")
 *
 * @example
 * ```ts
 * formatWeekIdForHumans("2025-W44") // Returns "Oct 27" (Monday of week 44)
 * formatWeekIdForHumans("2024-W01") // Returns "Jan 1" (Monday of week 1)
 * ```
 */
export function formatWeekIdForHumans(weekId: string): string {
  // Guard against undefined/null input
  if (!weekId) {
    throw new Error(`Week ID is required but received: ${weekId}`);
  }

  // Parse the ISO week ID (e.g., "2025-W44")
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week ID format: ${weekId}. Expected format: YYYY-Wnn`);
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Calculate the Monday of the given ISO week
  // ISO week 1 is the week containing the first Thursday of the year
  const jan4 = new Date(Date.UTC(year, 0, 4)); // Jan 4 is always in week 1
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // Mon=0, Sun=6
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - jan4Day);

  // Add (week - 1) weeks to get the Monday of the target week
  const targetMonday = new Date(firstMonday);
  targetMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);

  // Format as "MMM D"
  return targetMonday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
