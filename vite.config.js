import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the React app on :5173 and forwards API calls and
// uploaded photos to the Node server (`npm run dev:server`, port 3000).
const backend = `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': backend, '/uploads': backend },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
