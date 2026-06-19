const fs = require('fs');
const path = require('path');

const MAPPING = {
  'AlertCircle': 'Alert01Icon',
  'ArrowLeft': 'ArrowLeft01Icon',
  'BookOpen': 'BookOpen01Icon',
  'Check': 'Tick01Icon',
  'CheckCircle2': 'CheckmarkCircle01Icon',
  'ChevronDown': 'ArrowDown01Icon',
  'Clock': 'Clock01Icon',
  'Coffee': 'Coffee01Icon',
  'Dumbbell': 'Dumbbell01Icon',
  'Eye': 'ViewIcon',
  'EyeOff': 'ViewOffIcon',
  'Flame': 'FireIcon',
  'LogOut': 'Logout01Icon',
  'MapPin': 'Location01Icon',
  'Moon': 'Moon01Icon',
  'MoreHorizontal': 'MoreHorizontalIcon',
  'Pencil': 'PencilEdit01Icon',
  'PlayCircle': 'PlayCircle01Icon',
  'Plus': 'PlusSignIcon',
  'RefreshCw': 'RefreshIcon',
  'Scale': 'WeightScale01Icon',
  'Send': 'SentIcon',
  'ShoppingBag': 'ShoppingBag01Icon',
  'SkipForward': 'SkipNextIcon',
  'Smile': 'SmileIcon',
  'Sparkles': 'SparklesIcon',
  'Sun': 'Sun01Icon',
  'Sunrise': 'Sun01Icon',
  'TrendingUp': 'TrendingUp01Icon',
  'UtensilsCrossed': 'Restaurant01Icon',
  'X': 'Cancel01Icon'
};

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
  if (!content.includes('lucide-react')) return;

  const importRegex = /import\s+{([^}]+)}\s+from\s+["']lucide-react["'];?/g;
  const match = importRegex.exec(content);
  if (!match) return;

  const originalIcons = match[1].split(',').map(s => s.trim()).filter(Boolean);
  const newIcons = new Set();
  
  for (const icon of originalIcons) {
    const mapped = MAPPING[icon] || icon + 'Icon';
    newIcons.add(mapped);
    
    // Replace <Icon ... /> tags
    const tagRegex = new RegExp(`<${icon}(\\s|>)`, 'g');
    content = content.replace(tagRegex, `<${mapped}$1`);
    
    // Replace </Icon> tags
    const closeTagRegex = new RegExp(`</${icon}>`, 'g');
    content = content.replace(closeTagRegex, `</${mapped}>`);
    
    // Replace <Icon> usage
    const exactTagRegex = new RegExp(`<${icon}>`, 'g');
    content = content.replace(exactTagRegex, `<${mapped}>`);
  }

  // Remove lucide-react import and add @hugeicons/core-free-icons
  content = content.replace(importRegex, `import { ${Array.from(newIcons).join(', ')} } from "@hugeicons/core-free-icons";`);
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

walk('apps/web/src', processFile);
