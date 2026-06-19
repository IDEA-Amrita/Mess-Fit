import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    if 'HugeiconsIcon' in content and 'import { HugeiconsIcon } from "@hugeicons/react"' not in content:
        # We need to add the import. Wait, it might be `import { HugeiconsIcon } from '@hugeicons/react'`
        if not re.search(r'import\s+{.*HugeiconsIcon.*}\s+from\s+["\']@hugeicons/react["\']', content):
            # Put it after the first import or use client
            if '"use client";' in content:
                content = content.replace('"use client";', '"use client";\nimport { HugeiconsIcon } from "@hugeicons/react";')
            else:
                content = 'import { HugeiconsIcon } from "@hugeicons/react";\n' + content
            changed = True

    # Fix typos
    replacements = {
        'SkipNextIcon': 'NextIcon',
        'TrendingUp01Icon': 'TrendingUpDownIcon',
        'PlayCircle01Icon': 'PlayCircle02Icon'
    }

    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
            changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")

for root, dirs, files in os.walk('apps/web/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
