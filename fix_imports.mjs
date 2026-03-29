import fs from 'fs';
import path from 'path';

const componentsDir = 'c:\\Users\\User\\nola-sms-pro\\src\\pages\\admin\\components';

// 1. Export types in Types.tsx
const typesFile = path.join(componentsDir, 'Types.tsx');
let typesContent = fs.readFileSync(typesFile, 'utf8');
typesContent = typesContent.replace(/interface SenderRequest/g, 'export interface SenderRequest');
typesContent = typesContent.replace(/interface Account/g, 'export interface Account');
typesContent = typesContent.replace(/interface AdminLayoutProps/g, 'export interface AdminLayoutProps');
fs.writeFileSync(typesFile, typesContent);

// 2. Fix paths and add type imports in all component files
const files = fs.readdirSync(componentsDir);

const typeImports = `\nimport { SenderRequest, Account, AdminLayoutProps } from './Types';\n`;

for (const file of files) {
    if (file === 'Types.tsx') continue;
    
    const filePath = path.join(componentsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix image and component paths
    content = content.replace(/import logoUrl from '\.\.\/\.\.\/assets/g, "import logoUrl from '../../../assets");
    content = content.replace(/import Antigravity from '\.\.\/\.\.\/components/g, "import Antigravity from '../../../components");
    
    // Insert type imports after the first few imports
    if (!content.includes("from './Types'")) {
        content = content.replace(/import Antigravity[^;]+;\n/g, match => match + typeImports);
    }
    
    fs.writeFileSync(filePath, content);
}

// 3. Fix AdminLayout.tsx
const adminLayoutFile = 'c:\\Users\\User\\nola-sms-pro\\src\\pages\\admin\\AdminLayout.tsx';
let adminLayoutContent = fs.readFileSync(adminLayoutFile, 'utf8');
if (!adminLayoutContent.includes("from './components/Types'")) {
    adminLayoutContent = adminLayoutContent.replace(/import Antigravity[^;]+;\n/g, match => match + `\nimport { SenderRequest, Account, AdminLayoutProps } from './components/Types';\n`);
}
fs.writeFileSync(adminLayoutFile, adminLayoutContent);

console.log('Fixed imports and relative paths.');
