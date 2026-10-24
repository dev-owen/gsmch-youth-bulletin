import { defineConfig } from 'vite';

export default defineConfig({
  server: { proxy: { '/v1': 'http://localhost:8787', '/api/auth': 'http://localhost:8787' } },
});
