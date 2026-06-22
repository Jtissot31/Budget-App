import fs from 'fs';
import path from 'path';

const root = 'C:/Users/emime/projects/BudgetTracker';
const transcriptPath =
  'C:/Users/emime/.cursor/projects/c-Users-emime-projects-BudgetTracker-apps-mobile/agent-transcripts/76a4aa88-1d8e-4a76-a4bd-9b763d8b5b01/76a4aa88-1d8e-4a76-a4bd-9b763d8b5b01.jsonl';

const patterns =
  /plans|HomeAvailable|CheckingBalance|homeChecking|buildChecking|chartStock|ContactMerchant|FynAvatar|planFinanceKit|availableCash|AIChatPlanSuggestions|dashboardPlansMock|dashboardPlanPresentation|PlanUi/;

const files = new Map();
const transcript = fs.readFileSync(transcriptPath, 'utf8');

for (const line of transcript.split('\n')) {
  if (!line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  const content = obj.message?.content;
  if (!Array.isArray(content)) continue;
  for (const item of content) {
    if (item.type !== 'tool_use' || item.name !== 'Write') continue;
    const raw = item.input?.path;
    if (!raw || !patterns.test(raw)) continue;
    files.set(raw, item.input.contents);
  }
}

/** Revert container color audit — keep current app palette (#111111 surfaces). */
function revertContainerColors(text) {
  return text
    .replace(/#28282E/g, '#111111')
    .replace(/#29282E/g, '#111111')
    .replace(/#323238/g, '#1F1F23')
    .replace(/#171717/g, '#333439');
}

let written = 0;
for (const [rawPath, contents] of files) {
  const rel = rawPath
    .replace(/^C:\\Users\\emime\\projects\\BudgetTracker\\/i, '')
    .replace(/\\/g, '/');
  const outPath = path.join(root, rel);
  const text = revertContainerColors(contents);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text, 'utf8');
  written++;
  console.log('wrote', rel);
}

console.log(`\nDone: ${written} files`);
