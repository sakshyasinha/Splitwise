import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/splitwise/', // Ensure the base path is set for GitHub Pages
  plugins: [react()],
  server: {
    port: 5173
  }
});