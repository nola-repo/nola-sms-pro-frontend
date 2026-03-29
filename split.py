import os
import re

infile = r"c:\Users\User\nola-sms-pro\src\pages\admin\AdminLayout.tsx"
outdir = r"c:\Users\User\nola-sms-pro\src\pages\admin\components"
os.makedirs(outdir, exist_ok=True)

with open(infile, "r", encoding="utf-8") as f:
    text = f.read()

# We look for component definitions. It looks like the file uses:
# // ─── Admin Login ─────────────────────────────────────────────────────────────
# const AdminLogin: React.FC...
# We can split by // ───
blocks = re.split(r"// ───+[ \w]+───+\n", text)
headers = re.findall(r"// ───+([ \w]+)───+\n", text)

print(f"Found {len(blocks)} blocks and {len(headers)} headers.")

# Block 0 is the imports and types
imports_block = blocks[0]

# Write out the pieces
for i, header in enumerate(headers):
    name = header.strip().replace(" View", "").replace(" ", "")
    if name == "AdminLayoutShell":
        name = "AdminLayout"
    
    content = blocks[i+1]
    
    # Custom fix for AdminLayout which is the shell
    if name == "AdminLayout":
        filepath = r"c:\Users\User\nola-sms-pro\src\pages\admin\AdminLayout.tsx"
        # We need to import the new components in AdminLayout
        new_imports = "import { AdminLogin } from './components/AdminLogin';\n"
        new_imports += "import { AdminDashboard } from './components/AdminDashboard';\n"
        new_imports += "import { AdminSenderRequests } from './components/AdminSenderRequests';\n"
        new_imports += "import { AdminAccounts } from './components/AdminAccounts';\n"
        new_imports += "import { AdminTeamManagement } from './components/AdminTeamManagement';\n"
        new_imports += "import { AdminLogs } from './components/AdminLogs';\n"
        new_imports += "import { AdminSettings } from './components/AdminSettings';\n"
        
        full_content = imports_block + new_imports + "\n" + content
        # We will write this separately to avoid overwriting ourselves during the loop
    else:
        filepath = os.path.join(outdir, f"{name}.tsx")
        # We need to add imports to each file
        local_imports = imports_block
        full_content = local_imports + "\n" + content
        
        # Add export if missing
        if "export const " not in full_content and "export default" not in full_content:
            full_content = full_content.replace(f"const {name}", f"export const {name}")
            
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(full_content)
        print(f"Created {filepath}")

# Finally rewrite AdminLayout
filepath = r"c:\Users\User\nola-sms-pro\src\pages\admin\AdminLayout.tsx"
new_imports = "import { AdminLogin } from './components/AdminLogin';\n"
new_imports += "import { AdminDashboard } from './components/AdminDashboard';\n"
new_imports += "import { AdminSenderRequests } from './components/AdminSenderRequests';\n"
new_imports += "import { AdminAccounts } from './components/AdminAccounts';\n"
new_imports += "import { AdminTeamManagement } from './components/AdminTeamManagement';\n"
new_imports += "import { AdminLogs } from './components/AdminLogs';\n"
new_imports += "import { AdminSettings } from './components/AdminSettings';\n"

# we need the AdminLayout block
layout_content = blocks[headers.index(" Admin Layout Shell ") + 1]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(imports_block + new_imports + "\n" + layout_content)
print("Updated AdminLayout.tsx")
