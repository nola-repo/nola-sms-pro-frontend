const fs = require('fs');
const content = fs.readFileSync('src/pages/admin/AdminLayout.tsx', 'utf8');

const regex = /^(export\s+)?const\s+(Admin\w+|StatusBadge)[\s\S]*?(?=\n^(export\s+)?const\s+(Admin\w+|StatusBadge)|$)/gm;

let match;
while ((match = regex.exec(content)) !== null) {
    const componentCode = match[0];
    const componentName = match[2];
    console.log('Found ' + componentName + ' length: ' + componentCode.length);
}
