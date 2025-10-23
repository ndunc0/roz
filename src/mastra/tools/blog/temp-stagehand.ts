// Initialize Stagehand with Gemini model
const stagehand = new Stagehand({
  modelName: "google/gemini-2.0-flash-exp",
});
await stagehand.init();

const page = stagehand.page;

console.info("Launching browser...");
console.info("Connected!");

await page.goto("https://www.juicebox.ai/blog");

// Look for visible publication dates
// If there are publication dates, click into the links that are from the last week and scrape content.

// Observe: store an array of actions that click into these posts. Go from left to right, top to bottom. If the last post you look at
// is still within the last week, store the the navigation button to view the next page of posts. (And then repeat this) If that button does not exist, end.
// If you get to a post that was posted earlier than within the last week, end.

// EDGE CASE: NO DATES
// If there are no visible dates, click into the links one by one, from left to right, top to bottom.
// On each post, locate the post's date. If the post date is within the last week, continue and scrape content.
// If it's not, do not scrape, and end.
// If you scrape 5 posts, end.

// Prompt: Find all the blog post links and published dates. If the date is within the last week, click into it
// Extract all blog posts with their links and dates
console.info("Observing...");
const blogPosts = await page.observe({
  instruction: "Find all clickable blog post elements including featured posts",
});

console.info("Extracting blog posts...");
const { blogPostsData } = await page.extract({
  instruction:
    "Extract all blog posts including featured post with the publication dates and url link to each post",
  schema: z.object({
    blogPostsData: z.array(
      z.object({
        url: z.string().url().describe("The link to the blog post"),
        date: z.string().optional().describe("Publication date"),
        title: z.string().describe("Post title"),
      })
    ),
  }),
  selector: blogPosts.selector,
});

// Log the titles
console.log("Blog post titles:");
blogPostsData.forEach((post, index) => {
  console.log(
    `${index + 1}. ${post.title} published at ${post.date} (${post.url})`
  );
});

// Get date from 7 days ago for comparison
const oneWeekAgo = new Date();
oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

// Filter and visit posts from last 7 days
for (const post of blogPostsData) {
  console.log("top of loop");

  const postDate = post.date ? new Date(post.date) : null;

  if (postDate === null || postDate >= oneWeekAgo) {
    console.log(`Visiting recent post: ${post.title} (${post.date})`);

    // Click the post link
    await page.act(`Click the link to "${post.title}"`);

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

      console.log(`Content of "${post.title}":\n${content}\n---\n`);
    } else {
      console.log(`Extracting content from ${post.title}`);
      const { content } = await page.extract({
        instruction:
          "Extract the main text content of the blog post and the publication date",
        schema: z.object({
          content: z
            .string()
            .describe("The main text content of the blog post"),
          publishedDate: z.string().describe("The Publication Date"),
        }),
      });

      const publishedDate = content.publishedDate
        ? new Date(content.publishedDate)
        : null;

      if (publishedDate && publishedDate < oneWeekAgo) {
        break;
      }

      console.log(`Content of "${post.title}":\n${content}\n---\n`);
    }

    // Go back for next post
    await page.goBack();

    // Wait for main page to load
    await page.waitForLoadState("networkidle");
  }
}

console.log("Finished processing recent blog posts");
