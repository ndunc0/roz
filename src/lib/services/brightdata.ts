import { parseJSONorJSONL } from "@lib/utils";

const BRIGHTDATA_URL_BASE = "https://api.brightdata.com";
const SCRAPE_ENDPOINT = "/datasets/v3/scrape";
const MONITOR_ENDPOINT = "/datasets/v3/progress";
const DOWNLOAD_ENDPOINT = "/datasets/v3/snapshot";

interface BrightDataLinkedInFetchParams {
  companyLinkedInUrl: string;
  windowDays?: number;
  maxNumberOfResults?: number;
}

interface SnapshotResponse {
  snapshot_id: string;
  message: string;
}

interface MonitorResponse {
  status: "running" | "ready" | "failed";
  error?: string;
}

/**
 * Monitors a snapshot until it's ready or failed
 * Implements exponential backoff after 10 minutes and times out after 1 hour
 */
export const monitorSnapshot = async (
  snapshotId: string
): Promise<MonitorResponse> => {
  const apiToken = process.env.BRIGHTDATA_API_KEY;
  if (!apiToken) {
    throw new Error("Bright Data API key is not set in environment variables.");
  }

  const url = `${BRIGHTDATA_URL_BASE}${MONITOR_ENDPOINT}/${snapshotId}`;
  const startTime = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;
  const ONE_HOUR = 60 * 60 * 1000;
  const INITIAL_POLL_INTERVAL = 60 * 1000; // 1 minute

  let pollInterval = INITIAL_POLL_INTERVAL;
  let attemptCount = 0;

  while (true) {
    const elapsedTime = Date.now() - startTime;

    // Timeout after 1 hour
    if (elapsedTime >= ONE_HOUR) {
      throw new Error(
        `Snapshot monitoring timed out after 1 hour. Snapshot ID: ${snapshotId}`
      );
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bright Data Monitor API error (${response.status}): ${errorText}`
        );
      }

      const data = (await response.json()) as MonitorResponse;
      console.log(`Snapshot ${snapshotId} status: ${data.status}`);

      // If ready or failed, return immediately
      if (data.status === "ready" || data.status === "failed") {
        return data;
      }

      // After 10 minutes, start exponential backoff
      if (elapsedTime >= TEN_MINUTES) {
        pollInterval = Math.min(
          INITIAL_POLL_INTERVAL * Math.pow(2, attemptCount - 10),
          5 * 60 * 1000 // Max 5 minutes between polls
        );
      }

      console.log(
        `Waiting ${pollInterval / 1000} seconds before next poll (attempt ${attemptCount + 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attemptCount++;
    } catch (error) {
      console.error("Error monitoring snapshot:", error);
      throw error;
    }
  }
};

/**
 * Helper function to check if an object is an error object from Bright Data
 */
const isErrorObject = (obj: unknown): boolean => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "error" in obj &&
    "error_code" in obj
  );
};

/**
 * Downloads snapshot data once it's ready
 * Filters out error objects and returns only valid posts
 */
export const downloadSnapshot = async (
  snapshotId: string
): Promise<{ validPosts: unknown[]; errorCount: number }> => {
  const apiToken = process.env.BRIGHTDATA_API_KEY;
  if (!apiToken) {
    throw new Error("Bright Data API key is not set in environment variables.");
  }

  const url = `${BRIGHTDATA_URL_BASE}${DOWNLOAD_ENDPOINT}/${snapshotId}?format=json`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Bright Data Download API error (${response.status}): ${errorText}`
      );
    }

    const rawText = await response.text();
    console.log(
      "Downloaded snapshot (first 500 chars):",
      rawText.substring(0, 500)
    );

    // Try to parse as JSON
    const data = parseJSONorJSONL(rawText);

    const dataArray = Array.isArray(data) ? data : [data];

    // Filter out error objects and keep only valid posts
    const validPosts = dataArray.filter((item) => !isErrorObject(item));
    const errorCount = dataArray.length - validPosts.length;

    console.log(
      `Filtered data: ${validPosts.length} valid posts, ${errorCount} errors ignored`
    );

    return { validPosts, errorCount };
  } catch (error) {
    console.error("Error downloading snapshot:", error);
    throw error;
  }
};

export const fetchCompanyLinkedInPosts = async ({
  companyLinkedInUrl,
  windowDays = 7, // How many days back to fetch posts from. Default is 7 days.
  maxNumberOfResults = 20,
}: BrightDataLinkedInFetchParams) => {
  const url = `${BRIGHTDATA_URL_BASE}${SCRAPE_ENDPOINT}`;
  const datasetId = "gd_lyy3tktm25m4avu764";
  const apiToken = process.env.BRIGHTDATA_API_KEY;
  if (!apiToken) {
    throw new Error("Bright Data API key is not set in environment variables.");
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - windowDays);
  const startDateISO = startDate.toISOString();

  const payload = {
    input: [
      {
        url: companyLinkedInUrl,
        start_date: startDateISO,
        end_date: new Date().toISOString(),
      },
    ],
  };

  // https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lyy3tktm25m4avu764&notify=false&include_errors=true&type=discover_new&discover_by=company_url&limit_per_input=20
  try {
    const response = await fetch(
      `${url}?dataset_id=${datasetId}&notify=false&include_errors=true&type=discover_new&discover_by=company_url&limit_per_input=${maxNumberOfResults}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    console.log("Bright Data fetch response status:", response.status);
    console.log("Content-Type:", response.headers.get("content-type"));

    // Get the raw text first to inspect it
    const rawText = await response.text();
    console.log("Raw response (first 500 chars):", rawText.substring(0, 500));

    // Handle 202 - request is still in progress
    if (response.status === 202) {
      try {
        const snapshotResponse = JSON.parse(rawText) as SnapshotResponse;
        console.log(
          "Received 202 with snapshot_id:",
          snapshotResponse.snapshot_id
        );
        return snapshotResponse; // Return the snapshot info for the tool to handle
      } catch (parseError) {
        throw new Error(
          `Failed to parse 202 response: ${parseError}. Raw response: ${rawText}`
        );
      }
    }

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`Bright Data API error (${response.status}): ${rawText}`);
    }

    // Try to parse as JSON
    const data = parseJSONorJSONL(rawText);

    console.log("Parsed data:", JSON.stringify(data).substring(0, 500));
    return data;
  } catch (error) {
    console.error("Error fetching LinkedIn posts:", error);
    throw error;
  }
};
