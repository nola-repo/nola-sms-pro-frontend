import fs from 'fs';
import path from 'path';

const infile = 'c:\\Users\\User\\nola-sms-pro\\src\\pages\\admin\\AdminLayout.tsx';
const outdir = 'c:\\Users\\User\\nola-sms-pro\\src\\pages\\admin\\components';

if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
}

const content = fs.readFileSync(infile, 'utf8');

const blocks = content.split(/\/\/\s*───\s+([^─\n]+?)\s+───+/g);

const imports = blocks[0];

let mainLayoutBlock = '';
let headersFound = [];

for (let i = 1; i < blocks.length; i += 2) {
    let header = blocks[i].trim().replace(" View", "").replace(" Shell", "").replace(/\s+/g, "");
    headersFound.push(header);
    
    if (header === "AdminLayout") header = "AdminLayout";
    
    let blockContent = blocks[i+1];
    
    if (header === "AdminLayout") {
        mainLayoutBlock = blockContent;
        continue;
    }
    
    let outContent = imports + blockContent;
    
    if (!outContent.includes(`export const ${header}`) && outContent.includes(`const ${header}`)) {
        outContent = outContent.replace(`const ${header}`, `export const ${header}`);
    }
    
    fs.writeFileSync(path.join(outdir, `${header}.tsx`), outContent);
    console.log(`Created ${header}.tsx`);
}

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
