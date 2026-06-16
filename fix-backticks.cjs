const fs = require('fs');
let content = fs.readFileSync('agents/planner/prompts/search.prompt.ts', 'utf8');

// Find the template literal content and escape backticks within it
// Replace unescaped ``` with \`\`\`
content = content.replace(/(?<!\\)`{3}/g, '\\`\\`\\`');

// But the opening export const SEARCH_PROMPT = ` and closing `; should remain unescaped
// Fix: the first backtick (opening template) and last backtick (closing template) must stay
// Let's do it differently - replace the whole file content properly

// Re-read original
content = fs.readFileSync('agents/planner/prompts/search.prompt.ts', 'utf8');

// Split at template literal boundaries
const startIdx = content.indexOf('= `\r\n') + 3; // after "= `"
const endIdx = content.lastIndexOf('\r\n`');      // before final "`"

if (startIdx < 3 || endIdx < 0) {
  console.error('Could not find template literal boundaries');
  process.exit(1);
}

const before = content.slice(0, startIdx);  // "export const SEARCH_PROMPT = `"
const body = content.slice(startIdx, endIdx + 1); // template body
const after = content.slice(endIdx + 1);    // "`" or "`;"

// Escape backticks in the body that aren't already escaped
const fixedBody = body.replace(/(?<!\\)`/g, '\\`');

const result = before + fixedBody + after;
fs.writeFileSync('agents/planner/prompts/search.prompt.ts', result);
console.log('Done - escaped backticks in template literal');
