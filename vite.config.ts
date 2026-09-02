import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Serve the app through `netlify dev` (port 8889) — it owns the /api redirects
// and injects the function environment. Hitting the bare Vite port has no API.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5190 },
});
