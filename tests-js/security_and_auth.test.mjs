import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('security audit: no service_role key in any source file', () => {
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (['node_modules', '.next', '.git'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scan(full);
      } else if (/\.(ts|tsx|js|mjs|json|py)$/.test(e.name)) {
        const content = fs.readFileSync(full, 'utf8');
        assert.ok(
          !content.includes('service_role') || full.includes('security_and_auth.test'),
          `Found forbidden service_role reference in ${full}`
        );
      }
    }
  }
  scan('src');
});

test('security audit: .env.local is ignored in .gitignore', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  assert.ok(gitignore.includes('.env*.local') || gitignore.includes('.env.local'), '.env.local must be in .gitignore');
});

test('security audit: .env.example contains only non-secret placeholders', () => {
  assert.ok(fs.existsSync('.env.example'), '.env.example must exist');
  const envExample = fs.readFileSync('.env.example', 'utf8');
  assert.ok(envExample.includes('NEXT_PUBLIC_SUPABASE_URL='));
  assert.ok(envExample.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='));
  assert.ok(!envExample.includes('eyJhbGciOi'), '.env.example must not contain real JWT tokens');
});

test('navigation audit: WhatsApp NLP is excluded from sidebar navigation', () => {
  const sidebarContent = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
  assert.ok(!sidebarContent.toLowerCase().includes('whatsapp'), 'Sidebar must not contain WhatsApp NLP');
  assert.ok(sidebarContent.includes('Segmentasi Pelanggan'), 'Sidebar must contain Segmentasi');
  assert.ok(sidebarContent.includes('Analisis Media Sosial'), 'Sidebar must contain Medsos');
});

test('route protection audit: middleware guards protected pages', () => {
  const middlewareContent = fs.readFileSync('src/lib/supabase/middleware.ts', 'utf8');
  assert.ok(middlewareContent.includes('/login'));
  assert.ok(middlewareContent.includes('/segmentasi'));
  assert.ok(middlewareContent.includes('/medsos'));
});