import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the imports from core-free-icons
    match = re.search(r'import\s+{([^}]+)}\s+from\s+["\']@hugeicons/core-free-icons["\']', content)
    if not match:
        return

    icons_str = match.group(1)
    # Extract just the icon names (handling possible newlines/spaces)
    icons = [i.strip() for i in icons_str.replace('\n', ' ').split(',') if i.strip()]

    changed = False
    for icon in icons:
        # Check if the icon is used as a JSX element: <IconName
        # Exclude <HugeiconsIcon icon={IconName} ...> usages that might already exist
        
        # Replace `<IconName />`
        pattern_self_closing = r'<' + icon + r'\s*/>'
        if re.search(pattern_self_closing, content):
            content = re.sub(pattern_self_closing, f'<HugeiconsIcon icon={{{icon}}} />', content)
            changed = True
            
        # Replace `<IconName className="..." />`
        pattern_with_props = r'<' + icon + r'(\s+[^>]+?)\s*/>'
        if re.search(pattern_with_props, content):
            content = re.sub(pattern_with_props, rf'<HugeiconsIcon icon={{{icon}}}\1 />', content)
            changed = True

    if changed:
        if 'HugeiconsIcon' not in content:
            # add import at the top
            content = 'import { HugeiconsIcon } from "@hugeicons/react";\n' + content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")

for root, dirs, files in os.walk('apps/web/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
