// From https://github.com/mastra-ai/template-browsing-agent/

import { Stagehand } from "@browserbasehq/stagehand";

const MODEL_OPTIONS = {
  modelName: "google/gemini-2.5-flash-lite",
  modelClientOptions: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  },
};

class StagehandSessionManager {
  private static instance: StagehandSessionManager;
  private stagehand: Stagehand | null = null;
  private initialized = false;
  private lastUsed = Date.now();
  private readonly sessionTimeout = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    // Schedule session cleanup to prevent memory leaks
    setInterval(() => this.checkAndCleanupSession(), 60 * 1000);
  }

  /**
   * Get the singleton instance of StagehandSessionManager
   */
  public static getInstance(): StagehandSessionManager {
    if (!StagehandSessionManager.instance) {
      StagehandSessionManager.instance = new StagehandSessionManager();
    }
    return StagehandSessionManager.instance;
  }

  /**
   * Ensure Stagehand is initialized and return the instance
   */
  public async ensureStagehand(): Promise<Stagehand> {
    this.lastUsed = Date.now();

    try {
      // Initialize if not already initialized
      if (!this.stagehand || !this.initialized) {
        console.log("Creating new Stagehand instance");
        this.stagehand = new Stagehand({
          apiKey: process.env.BROWSERBASE_API_KEY!,
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          env: "BROWSERBASE",
          ...MODEL_OPTIONS,
        });

        try {
          console.log("Initializing Stagehand...");
          await this.stagehand.init();
          console.log("Stagehand initialized successfully");
          this.initialized = true;
          return this.stagehand;
        } catch (initError) {
          console.error("Failed to initialize Stagehand:", initError);
          throw initError;
        }
      }

      try {
        const title = await this.stagehand.page.evaluate(() => document.title);
        console.log("Session check successful, page title:", title);
        return this.stagehand;
      } catch (error) {
        // If we get an error indicating the session is invalid, reinitialize
        console.error("Session check failed:", error);
        if (
          error instanceof Error &&
          (error.message.includes(
            "Target page, context or browser has been closed"
          ) ||
            error.message.includes("Session expired") ||
            error.message.includes("context destroyed"))
        ) {
          console.log("Browser session expired, reinitializing Stagehand...");
          this.stagehand = new Stagehand({
            apiKey: process.env.BROWSERBASE_API_KEY!,
            projectId: process.env.BROWSERBASE_PROJECT_ID!,
            env: "BROWSERBASE",
            ...MODEL_OPTIONS,
          });
          await this.stagehand.init();
          this.initialized = true;
          return this.stagehand;
        }
        throw error; // Re-throw if it's a different type of error
      }
    } catch (error) {
      this.initialized = false;
      this.stagehand = null;
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize/reinitialize Stagehand: ${errorMsg}`
      );
    }
  }

  /**
   * Close the Stagehand session if it's been idle for too long
   */
  private async checkAndCleanupSession(): Promise<void> {
    if (!this.stagehand || !this.initialized) return;

    const now = Date.now();
    if (now - this.lastUsed > this.sessionTimeout) {
      console.log("Cleaning up idle Stagehand session");
      try {
        await this.stagehand.close();
      } catch (error) {
        console.error(`Error closing idle session: ${error}`);
      }
      this.stagehand = null;
      this.initialized = false;
    }
  }

  /**
   * Manually close the session
   */
  public async close(): Promise<void> {
    if (this.stagehand) {
      try {
        await this.stagehand.close();
      } catch (error) {
        console.error(`Error closing Stagehand session: ${error}`);
      }
      this.stagehand = null;
      this.initialized = false;
    }
  }
}

// Get the singleton instance
export const sessionManager = StagehandSessionManager.getInstance();
