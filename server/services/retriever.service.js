import fs from 'fs';
import path from 'path';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were',
  'to', 'of', 'for', 'in', 'on', 'at', 'with',
  'and', 'or', 'but', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'you', 'your',
  'give', 'tell', 'show', 'how', 'what', 'why'
]);

const readFileText = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');

    return raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
};

const listTextFiles = (rootDir) => {
  const files = [];

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;

    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const ext = path.extname(fullPath).toLowerCase();

      if (
        ['.md', '.txt', '.html', '.htm'].includes(ext) ||
        /readme/i.test(path.basename(fullPath))
      ) {
        files.push(fullPath);
      }
    }
  };

  walk(rootDir);

  return files;
};

const chunkText = (text, chunkSize = 1000, overlap = 150) => {
  const chunks = [];

  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;

    chunks.push(text.slice(start, end));

    start += chunkSize - overlap;
  }

  return chunks;
};

const tokenize = (text) => {
  return String(text || '')
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
};

const scoreChunk = (chunk, queryTokens) => {
  const chunkTokens = tokenize(chunk);

  if (!chunkTokens.length) {
    return 0;
  }

  const tokenSet = new Set(chunkTokens);

  let score = 0;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      score += 10;
    }

    const occurrences = chunkTokens.filter(
      (t) => t === token
    ).length;

    score += occurrences;
  }

  return score;
};

export const retrieveRelevantDocs = (
  prompt,
  opts = {}
) => {
  const docsDir = path.resolve(
    process.cwd(),
    'docs'
  );

  const uploadsDir = path.resolve(
    process.cwd(),
    'uploads'
  );

  const files = [
    ...listTextFiles(docsDir),
    ...(fs.existsSync(uploadsDir)
      ? listTextFiles(uploadsDir)
      : [])
  ];

  const queryTokens = tokenize(prompt);

  const scoredChunks = [];

  for (const file of files) {
    const text = readFileText(file);

    if (!text) continue;

    const chunks = chunkText(
      text,
      opts.chunkSize || 1000,
      opts.overlap || 150
    );

    for (const chunk of chunks) {
      const score = scoreChunk(
        chunk,
        queryTokens
      );

      if (score > 0) {
        scoredChunks.push({
          score,
          text: chunk.trim(),
          source: path.relative(
            process.cwd(),
            file
          )
        });
      }
    }
  }

  scoredChunks.sort(
    (a, b) => b.score - a.score
  );

  return scoredChunks.slice(
    0,
    Number(opts.topK || 5)
  );
};