// One-off helper: extracts text from a PDF into a markdown file.
// Usage: node infrastructure/scripts/extract-pdf.mjs <input.pdf> <output.md>
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node infrastructure/scripts/extract-pdf.mjs <input.pdf> <output.md>');
  process.exit(1);
}

const buffer = fs.readFileSync(input);
const parser = new pdfParse.PDFParse({ data: buffer, verbosity: 0 });
const result = await parser.getText();
const text = result.text ?? '';

const md = `# ${input.split(/[\\/]/).pop()}\n\n> Auto-extracted text from the PDF for reference and searching.\n\n${text}\n`;
fs.writeFileSync(output, md, 'utf8');
console.log(`wrote ${output} (${result.pages?.length ?? '?'} pages, ${text.length} chars)`);
