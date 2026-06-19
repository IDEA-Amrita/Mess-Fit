import os, re
icons = set()
for root, _, files in os.walk('apps/web/src'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as f_in:
                content = f_in.read()
                imports = re.findall(r'import\s+{([^}]+)}\s+from\s+[\'\"]lucide-react[\'\"]', content)
                for i in imports:
                    icons.update(x.strip() for x in i.split(','))
print(sorted([i for i in icons if i]))
