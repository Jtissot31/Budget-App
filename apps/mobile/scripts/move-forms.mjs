import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function stripRouteStub(content) {
  return content
    .replace(/\r?\n\/\*\* expo-router requires a default export[\s\S]*$/m, '')
    .replace(/\r?\nexport default function (RecurringPaymentsRoute|SavingsGoalsRoute)\(\) \{[\s\S]*?\}\s*$/m, '')
    .replace(/\r?\nimport \{ View \} from 'react-native';\r?\n\r?\n\/\*\* Temporary expo-router stub[\s\S]*$/m, '')
    .trimEnd() + '\n';
}

function moveForm(srcName, dstName) {
  const src = path.join(root, 'app', srcName);
  const dst = path.join(root, 'components', dstName);
  if (!fs.existsSync(src)) {
    console.log('SKIP missing', srcName);
    return;
  }
  const content = stripRouteStub(fs.readFileSync(src, 'utf8'));
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content, 'utf8');
  fs.unlinkSync(src);
  console.log('OK', srcName, '->', 'components/' + dstName);
}

moveForm('recurring-payments.tsx', 'RecurringPaymentsForm.tsx');
moveForm('savings-goals.tsx', 'SavingsGoalsForm.tsx');
console.log('DONE');
