import { defineCollection, z } from 'astro:content';

export const collections = {
  posts: defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      date: z.date(),
      draft: z.boolean().default(false),
      category: z.enum([
        'engineering-web-apps',
        'engineering-networking',
        'traveling',
        'automotive',
      ]).optional(),
    }),
  }),
};
