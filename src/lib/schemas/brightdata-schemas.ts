import { z } from "zod";

// Schema for individual LinkedIn post data
export const LinkedInPostSchema = z.object({
  url: z.string(),
  id: z.string(),
  user_id: z.string().optional(),
  title: z.string().optional(),
  headline: z.string().optional(),
  post_text: z.string().optional(),
  hashtags: z.array(z.string()).nullable(),
  embedded_links: z.array(z.string()).nullable(),
  images: z.array(z.string()).nullable(),
  videos: z.array(z.string()).nullable(),
  num_likes: z.number(),
  num_comments: z.number(),
  top_visible_comments: z
    .array(
      z.object({
        user_name: z.string(),
        user_id: z.string().optional(),
        user_title: z.string().nullable(),
        comment: z.string(),
        comment_date: z.string().describe("ISO 8601 formatted date string"),
        num_reactions: z.number(),
      })
    )
    .optional(),
  date_posted: z.string().describe("ISO 8601 formatted date string"),
  tagged_companies: z
    .array(
      z.object({
        name: z.string(),
        link: z.string(),
      })
    )
    .optional(),
  tagged_people: z.array(z.any()).optional(),
  post_type: z.string(),
  account_type: z.string(),
});
