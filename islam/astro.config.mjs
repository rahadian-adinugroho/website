import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'static',
  site: 'https://islam.raharoho.me',
  integrations: [tailwind()],
  vite: {
    build: {
      minify: process.env.MINIFY !== 'false',
    },
  },
});
