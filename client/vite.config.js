import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubBase = repoName ? `/${repoName}/` : '/';

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/.
  // Always derive base from GITHUB_REPOSITORY.
  // Additionally, force absolute asset URLs so routes like /<repo>/auth don't 404.
  base: githubBase,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/index.css';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.DEV_API_ORIGIN || 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.DEV_API_ORIGIN || 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  }
});