const fs = require('fs');
const path = require('path');

const NEW_ICONS = [
  'Alert01Icon', 'ArrowLeft01Icon', 'BookOpen01Icon', 'Tick01Icon',
  'CheckmarkCircle01Icon', 'ArrowDown01Icon', 'Clock01Icon', 'Coffee01Icon',
  'Dumbbell01Icon', 'ViewIcon', 'ViewOffIcon', 'FireIcon', 'Logout01Icon',
  'Location01Icon', 'Moon01Icon', 'MoreHorizontalIcon', 'PencilEdit01Icon',
  'PlayCircle01Icon', 'PlusSignIcon', 'RefreshIcon', 'WeightScale01Icon',
  'SentIcon', 'ShoppingBag01Icon', 'SkipNextIcon', 'SmileIcon',
  'SparklesIcon', 'Sun01Icon', 'TrendingUp01Icon', 'Restaurant01Icon',
  'Cancel01Icon'
];

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p, callback);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      callback(p);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const icon of NEW_ICONS) {
    // Replace <IconName /> -> <HugeiconsIcon icon={IconName} />
    const tagRegex1 = new RegExp(`<${icon}\\s*/>`, 'g');
    if (tagRegex1.test(content)) {
      content = content.replace(tagRegex1, `<HugeiconsIcon icon={${icon}} />`);
      changed = true;
    }

    // Replace <IconName className="..." /> -> <HugeiconsIcon icon={IconName} className="..." />
    // This matches `<IconName ` and up to `/>` or `>`
    // Actually, simple regex to replace `<IconName ` with `<HugeiconsIcon icon={IconName} `
    // is safe because it's a component name.
    const tagRegex2 = new RegExp(`<${icon}(\\s+[^>]+)>`, 'g');
    if (tagRegex2.test(content)) {
      content = content.replace(tagRegex2, (match, props) => {
        // If it's self closing vs not
        // We just add `icon={IconName}` after the opening `<HugeiconsIcon `
        return `<HugeiconsIcon icon={${icon}}${props}>`;
      });
      changed = true;
    }
  }

  if (changed) {
    // Ensure HugeiconsIcon is imported
    if (!content.includes('HugeiconsIcon')) {
      content = 'import { HugeiconsIcon } from "@hugeicons/react";\n' + content;
    }
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  }
}

walk('apps/web/src', processFile);
