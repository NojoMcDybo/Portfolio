import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  // Kein Unterstrich: manche Hoster (z. B. claude.ai-Artifacts) reservieren _-Namen
  build: { assets: 'assets' },
});
