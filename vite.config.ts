import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

/** A second copy of robot-heads whose downward look keeps growing past the stock clamp. */
function gazeHead(): Plugin {
  const pitch = /a\s*=\s*-z\(w\.y\s*\/\s*260,\s*-1,\s*1\)\s*\*\s*0\.32/;
  const eyes = /f\s*=\s*z\(w\.y\s*\/\s*160,\s*-1\.4,\s*1\.4\)/;
  const range = /Math\.hypot\(Y,\s*N\)\s*<\s*700/;
  return {
    name: 'gaze-head',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('robot-heads') || !id.includes('gaze=1')) return null;
      if (!pitch.test(code) || !eyes.test(code) || !range.test(code)) {
        throw new Error('robot-heads look formula changed; the favicon gaze patch did not match');
      }
      return code
        .replace(pitch, 'a = -Math.atan2(Math.max(w.y, 0), 300) * 0.9')
        .replace(eyes, 'f = z(w.y / 240, -1.4, 2.2)')
        .replace(range, 'Math.hypot(Y, N) < 1200');
    },
  };
}

export default defineConfig({ plugins: [gazeHead(), react(), cloudflare()], server: { port: 5187, strictPort: true } });
