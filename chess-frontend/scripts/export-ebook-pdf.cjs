const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '../..');
const reviewRoot = path.resolve(repoRoot, 'docs/ebook-review-packs');
const pdfRoot = path.resolve(repoRoot, 'docs/ebook-pdfs');
const ebookRoot = path.resolve(__dirname, '../src/data/ebooks/v2');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findManifestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findManifestFiles(fullPath);
    return entry.name === 'manifest.json' ? [fullPath] : [];
  });
}

function posixRelative(fromFile, targetFile) {
  return path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, '/');
}

function numberedBookStem(manifest) {
  const position = Number(manifest.seriesPosition || 0);
  const prefix = position > 0 ? String(position).padStart(2, '0') : '00';
  return `${prefix}_${manifest.bookId}`;
}

function extractMain(html) {
  const match = html.match(/<main>([\s\S]*?)<\/main>/i);
  return match ? match[1] : html;
}

function rewriteImageSources(html, sourceFile) {
  return html.replace(/src="([^"]+)"/g, (_match, src) => {
    if (/^(https?:|file:|data:)/i.test(src)) {
      return `src="${src}"`;
    }
    const resolved = path.resolve(path.dirname(sourceFile), src);
    return `src="${pathToFileURL(resolved).href}"`;
  });
}

function renderCombinedHtml({ manifest, chapters, outputHtmlPath }) {
  const chapterSections = chapters.map((chapter) => {
    const printPath = path.join(reviewRoot, manifest.bookId, `${chapter.chapterId}.print.html`);
    if (!fs.existsSync(printPath)) {
      throw new Error(`Missing print HTML for ${chapter.chapterId}: ${printPath}`);
    }

    const html = fs.readFileSync(printPath, 'utf8');
    return `<section class="chapter-print">${rewriteImageSources(extractMain(html), printPath)}</section>`;
  });

  const title = `${manifest.title} - Chess99 Ebook`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; }
  body {
    font-family: Arial, sans-serif;
    color: #172018;
    font-size: 15.5px;
    margin: 0;
    background: #ffffff;
    line-height: 1.58;
  }
  .cover {
    min-height: 250mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    break-after: page;
  }
  .cover h1 {
    font-size: 42px;
    line-height: 1.08;
    margin: 0 0 12px;
  }
  .cover .subtitle {
    font-size: 18px;
    color: #536257;
    max-width: 620px;
  }
  .cover .meta {
    margin-top: 28px;
    font-size: 13px;
    color: #536257;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .toc {
    break-after: page;
  }
  .toc h2 {
    font-size: 26px;
    margin: 0 0 16px;
  }
  .toc ol {
    padding-left: 22px;
  }
  .toc li {
    margin: 8px 0;
  }
  .chapter-print {
    break-after: page;
  }
  .chapter-print:last-child {
    break-after: auto;
  }
  h1, h2, h3 {
    color: #172018;
    line-height: 1.2;
  }
  h1 {
    font-size: 30px;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 22px;
    margin-top: 30px;
    border-top: 1px solid #d8ddcf;
    padding-top: 18px;
  }
  h3 {
    font-size: 18px;
    margin-bottom: 8px;
  }
  .meta {
    color: #536257;
    margin-bottom: 20px;
  }
  .objectives {
    background: #eef4e7;
    border-left: 4px solid #81b64c;
    padding: 12px 16px;
  }
  .block {
    break-inside: avoid;
    margin: 20px 0;
  }
  .diagram {
    width: min(100%, 138mm);
    display: block;
    margin: 10px auto;
    border: 1px solid #d4dcc8;
  }
  .caption {
    color: #536257;
    font-size: 13px;
    line-height: 1.45;
    margin-top: 6px;
  }
  .review {
    display: none;
    font-size: 11px;
    color: #536257;
    background: #f5f7f0;
    padding: 8px 10px;
    border-radius: 6px;
  }
  .quiz-option {
    margin: 4px 0;
  }
  code {
    font-family: Consolas, monospace;
  }
</style>
</head>
<body>
  <section class="cover">
    <div class="meta">Chess99 Book ${escapeHtml(manifest.seriesPosition || '')} | ELO ${escapeHtml(manifest.eloStart)}-${escapeHtml(manifest.eloEnd)} | ${escapeHtml(manifest.requiredTier)}</div>
    <h1>${escapeHtml(manifest.title)}</h1>
    <div class="subtitle">${escapeHtml(manifest.subtitle)}</div>
  </section>
  <section class="toc">
    <h2>Contents</h2>
    <ol>
      ${chapters.map((chapter) => `<li>${escapeHtml(chapter.title)} <span class="meta">${escapeHtml(chapter.estimatedMinutes)} min</span></li>`).join('\n')}
    </ol>
  </section>
  ${chapterSections.join('\n')}
</body>
</html>`;
}

async function exportBook(manifestPath) {
  const manifest = readJson(manifestPath);
  const outputDir = path.join(pdfRoot, manifest.bookId);
  ensureDir(outputDir);

  const outputStem = numberedBookStem(manifest);
  const outputHtmlPath = path.join(outputDir, `${outputStem}.print.html`);
  const outputPdfPath = path.join(outputDir, `${outputStem}.pdf`);
  const html = renderCombinedHtml({
    manifest,
    chapters: manifest.chapterOrder || [],
    outputHtmlPath,
  });
  fs.writeFileSync(outputHtmlPath, html, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(outputHtmlPath).href, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();

  return {
    bookId: manifest.bookId,
    title: manifest.title,
    seriesPosition: manifest.seriesPosition,
    outputHtmlPath,
    outputPdfPath,
  };
}

function writePdfIndex(results) {
  ensureDir(pdfRoot);
  const indexPath = path.join(pdfRoot, 'index.md');
  const sortedResults = [...results].sort((a, b) => Number(a.seriesPosition || 0) - Number(b.seriesPosition || 0));
  const lines = [
    '# Chess99 E-Book PDFs',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Book | PDF | Combined Print HTML |',
    '| --- | --- | --- |',
    ...sortedResults.map((result) => (
      `| ${String(result.seriesPosition || 0).padStart(2, '0')}. ${result.title || result.bookId} | [PDF](${posixRelative(indexPath, result.outputPdfPath)}) | [HTML](${posixRelative(indexPath, result.outputHtmlPath)}) |`
    )),
    '',
  ];
  fs.writeFileSync(indexPath, lines.join('\n'), 'utf8');
  return indexPath;
}

async function main() {
  const manifestFiles = findManifestFiles(ebookRoot);
  if (!manifestFiles.length) {
    throw new Error(`No ebook manifests found under ${ebookRoot}`);
  }

  const results = [];
  for (const manifestPath of manifestFiles) {
    results.push(await exportBook(manifestPath));
  }
  const indexPath = writePdfIndex(results);

  results.forEach((result) => {
    console.log(`Exported PDF for ${result.bookId}: ${result.outputPdfPath}`);
    console.log(`Combined print HTML: ${result.outputHtmlPath}`);
  });
  console.log(`PDF index: ${indexPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
