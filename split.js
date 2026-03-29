const fs = require('fs');
const path = require('path');

const infile = 'c:\\Users\\User\\nola-sms-pro\\src\\pages\\admin\\AdminLayout.tsx';
const outdir = 'c:\\Users\\User\\nola-sms-pro\\src\\pages\\admin\\components';

if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
}

const content = fs.readFileSync(infile, 'utf8');

// Use regex to find block headers: "// ─── Section Name ───"
// Some lines have multiple dashes. We'll capture the text between "─── " and " ───"
const blocks = content.split(/\/\/\s*───\s+([^─\n]+?)\s+───+/g);

// blocks[0] is the top of the file (imports)
// blocks[i] where i is odd is the header name
// blocks[i+1] where i is odd is the code block
const imports = blocks[0];

let mainLayoutBlock = '';
let headersFound = [];

for (let i = 1; i < blocks.length; i += 2) {
    let header = blocks[i].trim().replace(" View", "").replace(" Shell", "").replace(/\s+/g, "");
    headersFound.push(header);
    
    // Convert e.g. "AdminLogin"
    if (header === "AdminLayout") header = "AdminLayout";
    
    let blockContent = blocks[i+1];
    
    if (header === "AdminLayout") {
        mainLayoutBlock = blockContent;
        continue;
    }
    
    // For other components, prepend standard imports
    let outContent = imports + blockContent;
    
    // Add "export" if missing
    if (!outContent.includes(`export const ${header}`) && outContent.includes(`const ${header}`)) {
        outContent = outContent.replace(`const ${header}`, `export const ${header}`);
    }
    
    // Save component file
    fs.writeFileSync(path.join(outdir, `${header}.tsx`), outContent);
    console.log(`Created ${header}.tsx`);
}

// Rewrite AdminLayout.tsx
const newImports = `
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminSenderRequests } from './components/AdminSenderRequests';
import { AdminAccounts } from './components/AdminAccounts';
import { AdminTeamManagement } from './components/AdminTeamManagement';
import { AdminLogs } from './components/AdminLogs';
import { AdminSettings } from './components/AdminSettings';
`;

fs.writeFileSync(infile, imports + newImports + mainLayoutBlock);
console.log('Successfully updated AdminLayout.tsx');
console.log('Found headers:', headersFound);
