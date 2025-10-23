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

import { sessionManager } from "@lib/stagehand";
import { createTool } from "@mastra/core";
import { z } from "zod/v3";

const BlogSearchInputSchema = z.object({
  blogUrl: z.string().url(), // The blog index URL to start from (e.g., juicebox.ai/blog)
  windowDays: z.number().default(7),
  maxPosts: z.number().default(10),
  olderStreakToStop: z.number().default(2), // tolerate a couple pinned/out-of-order items
});

const PostDataSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().url(),
  title: z.string(),
  author: z.string().optional(), // unused for now
  publishedAtISO: z.string().optional(),
  publishedAtText: z.string().optional(),
  content: z.string(),
});

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

  // Get date from [windowDays] days ago for comparison
  const windowDaysAgo = new Date();
  windowDaysAgo.setDate(windowDaysAgo.getDate() - windowDays);

  const stagehand = await sessionManager.ensureStagehand();

  const { sessionUrl } = await stagehand.init(); // useful for replay in console
  const page = stagehand.page;

  console.info("Launching browser...");
  console.info("Connected!");

  await page.goto(blogUrl);

  // 1) Find all blog post elements for future interaction
  console.info("Observing...");
  const [blogPosts] = await page.observe({
    instruction:
      "Find all clickable blog post elements including featured posts",
  });

  // 2) Extract URLs, titles, and publication dates from observed posts
  console.info("Extracting blog posts...");
  const { blogPostsData } = await page.extract({
    instruction:
      "Extract all blog post information including the publication date, title, and url link of each post.",
    schema: z.object({
      blogPostsData: z.array(
        z.object({
          url: z.string().url().describe("The link to the blog post"),
          date: z.string().optional().describe("Publication date"),
          title: z.string().describe("Post title"),
        })
      ),
    }),
  });

  // 3) Filter and visit posts from last [windowDays] days
  let totalHarvested = 0;
  let olderStreak = 0;
  for (const post of blogPostsData) {
    console.log(`post: ${JSON.stringify(post)}`);
    console.log("top of loop");

    const postDate = post.date ? new Date(post.date) : null;

    if (postDate === null || postDate >= windowDaysAgo) {
      console.log(
        `Visiting recent post: ${post.title} (${post.date}, ${post.url})`
      );

      // Click the post link
      await page.act(`Click the link to ${post.title}`);

      // Wait for navigation
      await page.waitForLoadState("networkidle");

      // If the postDate was null, we need to extract the date from the blog post itself
      // Then, if the post is outside of the week, we break the loop
      if (postDate) {
        console.log(`Extracting content from ${post.title}`);
        const { content } = await page.extract({
          instruction: "Extract the main text content of the blog post",
          schema: z.object({
            content: z
              .string()
              .describe("The main text content of the blog post"),
          }),
        });

        posts.push({
          url: post.url,
          canonicalUrl: page.url(),
          title: post.title,
          content,
          publishedAtISO: post.date
            ? new Date(post.date).toISOString()
            : undefined,
          publishedAtText: post.date,
        });
        totalHarvested++;

        console.log(`Content of "${post.title}":\n${content}\n---\n`);
      } else {
        console.log(`Extracting content from ${post.title}`);
        const { content, publishedDateString } = await page.extract({
          instruction:
            "Extract the main text content of the blog post and the publication date",
          schema: z.object({
            content: z
              .string()
              .describe("The main text content of the blog post"),
            publishedDateString: z.string().describe("The Publication Date"),
          }),
        });

        const publishedDate = publishedDateString
          ? new Date(publishedDateString)
          : null;

        if (!publishedDate || publishedDate < windowDaysAgo) {
          olderStreak++;
          if (olderStreak >= olderStreakToStop) {
            console.log(
              `Encountered ${olderStreak} older posts in a row, stopping harvest.`
            );

            break;
          }
        } else {
          olderStreak = 0; // reset streak

          posts.push({
            url: post.url,
            canonicalUrl: page.url(),
            title: post.title,
            content,
            publishedAtISO: publishedDate
              ? publishedDate.toISOString()
              : undefined,
            publishedAtText: publishedDateString,
          });
          totalHarvested++;
        }

        console.log(`Content of "${post.title}":\n${content}\n---\n`);
      }

      if (totalHarvested >= maxPosts) {
        console.log(`Reached max harvested posts of ${maxPosts}, stopping.`);
        break;
      }

      // Go back for next post
      await page.goBack();

      // Wait for main page to load
      await page.waitForLoadState("networkidle");
    }
  }

  console.log("Finished processing recent blog posts");

  await stagehand.close();
  return { sessionUrl, posts };
};
