import fs from 'fs';
import path from 'path';

const readFileText = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    // strip basic HTML if present
    return raw.replace(/<[^>]+>/g, ' ');
  } catch (e) {
    return '';
  }
};

const listTextFiles = (rootDir) => {
  const results = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const p = path.join(dir, item);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        walk(p);
      } else {
        const ext = path.extname(p).toLowerCase();
        if (['.md', '.txt', '.html', '.htm'].includes(ext) || /readme/i.test(path.basename(p))) {
          results.push(p);
        }
      }
    }
  };
  walk(rootDir);
  return results;
};

const chunkText = (text, size = 800) => {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + size);
    chunks.push(slice);
    i += size;
  }
  return chunks;
};

const scoreChunk = (chunk, tokens) => {
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    const regex = new RegExp(escapeRegExp(t), 'g');
    const matches = lower.match(regex);
    if (matches) score += matches.length;
  }
  return score;
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const retrieveRelevantDocs = (prompt, opts = {}) => {
  const root = path.resolve(process.cwd(), 'docs');
  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  const files = [...listTextFiles(root)];
  // also check uploads (receipts) if present
  if (fs.existsSync(uploadRoot)) {
    files.push(...listTextFiles(uploadRoot));
  }

  const tokens = (prompt || '').toLowerCase().split(/\W+/).filter(Boolean);
  const scored = [];

  for (const f of files) {
    const text = readFileText(f);
    if (!text) continue;
    const chunks = chunkText(text, opts.chunkSize || 800);
    for (const c of chunks) {
      const s = scoreChunk(c, tokens);
      if (s > 0) {
        scored.push({ score: s, text: c.trim(), source: path.relative(process.cwd(), f) });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topK = Number(opts.topK || 3);
  return scored.slice(0, topK);
};
