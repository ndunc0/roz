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
