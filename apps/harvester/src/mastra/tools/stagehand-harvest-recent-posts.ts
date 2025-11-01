/**
 * A Mastra tool that harvests recent blog posts from a given blog URL using Stagehand browser automation.
 *
 * This tool navigates to a blog's index page and collects posts published within a specified time window.
 * It extracts post metadata (title, URL, publication date) and the full text content of each post.
 *
 * **Important Limitations:**
 * - Only searches the **first page** of blog posts - DOES NOT PAGINATE
 * - This assumes the freshest posts appear on the first page (most recent first)
 * - Pagination support is intentionally omitted to reduce complexity in this first iteration
 *
 * @remarks
 * The tool uses Stagehand's browser automation to:
 * 1. Navigate to the blog index page
 * 2. Observe and extract post links with metadata
 * 3. Visit each qualifying post and extract its content
 * 4. Filter posts by publication date (within `windowDays`)
 * 5. Stop after `maxPosts` or when encountering `olderStreakToStop` consecutive older posts
 *
 * @example
 * ```typescript
 * const result = await stagehandHarvestRecentPosts.execute({
 *   context: {
 *     blogUrl: "https://example.com/blog",
 *     windowDays: 7,
 *     maxPosts: 10,
 *     olderStreakToStop: 2
 *   }
 * });
 * ```
 */

import { Page } from "@browserbasehq/stagehand";
import { sessionManager } from "@lib/services/stagehand";
import { createTool } from "@mastra/core";
import { z } from "zod/v3";

const BlogSearchInputSchema = z.object({
  blogUrl: z.string().url(), // The blog index URL to start from (e.g., juicebox.ai/blog)
  windowDays: z.number().default(7),
  maxPosts: z.number().default(10),
  olderStreakToStop: z.number().default(2), // tolerate a couple pinned/out-of-order items
});

const PostDataSchema = z.object({
  canonicalUrl: z.string().url(),
  title: z.string(),
  author: z.string().optional(), // unused for now
  publishedAtISO: z.string().optional(),
  publishedAtText: z.string().optional(),
  content: z.string(),
});

type LinkItem = {
  url: string;
  tabId: number;
  seq: number; // position within that tab
  postDate?: number | null; // +new Date(...), or null/undefined if unknown
};

export const stagehandHarvestRecentPostsTool = createTool({
  id: "stagehand-harvest-recent-posts",
  description:
    "Open a blog with Stagehand and collect posts from the last N days, stopping once older.",
  inputSchema: BlogSearchInputSchema,
  outputSchema: z.object({
    sessionUrl: z.string().optional(),
    posts: z.array(PostDataSchema),
  }),
  execute: async ({ context }) => {
    return await getRecentPosts(context);
  },
});

const getRecentPosts = async ({
  blogUrl,
  windowDays,
  maxPosts,
  olderStreakToStop,
}: z.infer<typeof BlogSearchInputSchema>) => {
  const posts: z.infer<typeof PostDataSchema>[] = [];
  let overallHarvested = 0;
  let olderStreak = 0;

  // Get date from [windowDays] days ago for comparison
  const windowDaysAgo = new Date();
  windowDaysAgo.setDate(windowDaysAgo.getDate() - windowDays);

  const stagehand = await sessionManager.ensureStagehand();

  const { sessionUrl } = await stagehand.init(); // useful for replay in console
  const page = stagehand.page;

  console.info("Launching browser...");
  console.info("Connected!");

  await page.goto(blogUrl);

  console.info("Observing...");
  // 1) Check for relevant tabs to navigate to (e.g., "Product Updates", "Company News")
  // If there are no tabs, proceed without navigation. If there are tabs, loop through them.
  const highPotentialTabs = await page.observe(
    "Find navigation tabs that would lead to a specific blog post category that would likely contain posts relevant to product updates, company updates, team updates, or other company-focused news as opposed to random thoughtpieces. (e.g. 'Company', 'Product Updates')."
  );

  console.log(`Found ${highPotentialTabs.length} high-potential tabs.`);

  // 2) For each tab, extract links to the first N [maxPosts] blog posts
  const allPostPreviewData: LinkItem[] = [];
  if (highPotentialTabs.length === 0) {
    console.info("Proceeding without tab navigation.");

    const postPreviewData = await extractPostLinks(
      page,
      -1,
      maxPosts + windowDays
    );

    console.log(`data without tabs:`, postPreviewData);

    allPostPreviewData.push(...postPreviewData);
  } else {
    for (let i = 0; i < highPotentialTabs.length; i++) {
      await page.act(`Click on the ${highPotentialTabs[i].selector} tab`);

      const tabPostPreviewData = await extractPostLinks(
        page,
        i,
        maxPosts + windowDays
      );

      console.log(`data from tab ${i}:`, tabPostPreviewData);

      allPostPreviewData.push(...tabPostPreviewData);
    }
  }

  // 3) Merge all extracted links into a single list, sorted by date (newest first)
  const mergedLinks = sortAndDedupe(allPostPreviewData);

  console.log(`filtered merged links:`, mergedLinks);

  // 4) Visit each link in order, harvesting posts until limits are reached
  for (const linkItem of mergedLinks) {
    console.info(`Navigating to blog post: ${linkItem.url}`);
    await page.goto(linkItem.url, { waitUntil: "domcontentloaded" });
    const post = await harvestPost(page, windowDaysAgo);

    if (post) {
      posts.push(post);
      overallHarvested++;
      olderStreak = 0; // reset streak
    } else {
      olderStreak++;
      if (olderStreak >= olderStreakToStop) {
        console.log(
          `Encountered ${olderStreak} older posts in a row, stopping harvest.`
        );
        break;
      }
    }
  }

  console.log("Finished processing recent blog posts");

  await stagehand.close();
  return { sessionUrl, posts };
};

async function extractPostLinks(
  page: Page,
  tabId: number,
  numPostsToExtract: number
): Promise<LinkItem[]> {
  const { postPreviewData } = await page.extract({
    instruction: `Extract the first ${numPostsToExtract} blog post links on the current page and their publication dates if available.`,
    schema: z.object({
      postPreviewData: z.array(
        z.object({
          url: z
            .string()
            .url()
            .describe("The URL to navigate to the blog post"),
          date: z
            .string()
            .optional()
            .describe("The publication date listed on the post element"),
        })
      ),
    }),
  });

  return postPreviewData.map((item, seq) => ({
    url: item.url,
    tabId,
    seq,
    postDate: item.date ? +new Date(item.date) : null,
  }));
}

async function harvestPost(
  page: Page,
  windowDaysAgo: Date
): Promise<z.infer<typeof PostDataSchema> | null> {
  const post = await page.extract({
    instruction:
      "Extract the blog post's title, publication date, and main text content. Ignore headers, footers, and ads.",
    schema: z.object({
      date: z.string().optional().describe("Publication date"),
      title: z.string().describe("Post title"),
      content: z.string().describe("The main text content of the blog post"),
    }),
  });

  console.log(`Captured post: ${post.title} from ${post.date}`);

  const postDate = post.date ? new Date(post.date) : null;

  if (!postDate || postDate < windowDaysAgo) {
    return null;
  } else {
    return {
      canonicalUrl: page.url(),
      title: post.title,
      content: post.content,
      publishedAtISO: postDate ? postDate.toISOString() : undefined,
      publishedAtText: post.date,
    };
  }
}

function sortAndDedupe(unsorted: LinkItem[]): LinkItem[] {
  const hasDate = (x: unknown): x is number =>
    typeof x === "number" && Number.isFinite(x);

  function cmp(a: LinkItem, b: LinkItem): number {
    const aHas = hasDate(a.postDate);
    const bHas = hasDate(b.postDate);

    // newest first
    if (aHas && bHas && a.postDate! !== b.postDate!) {
      return b.postDate! - a.postDate!;
    }

    if (a.seq !== b.seq) return a.seq - b.seq; // tie #1

    if (a.tabId !== b.tabId) return a.tabId < b.tabId ? -1 : 1; // tie #2

    if (a.url !== b.url) return a.url < b.url ? -1 : 1; // final fallback

    return 0;
  }

  const sorted = unsorted.sort(cmp);
  const seen = new Set<string>();
  const out: LinkItem[] = [];
  for (const it of sorted) {
    if (!seen.has(it.url)) {
      seen.add(it.url);
      out.push(it);
    }
  }
  return out;
}
