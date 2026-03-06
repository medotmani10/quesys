const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
        }
    });
    return results;
}
const files = walk('./src');
let changed = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('min-h-screen')) {
        content = content.replace(/min-h-screen/g, 'min-h-[100dvh]');
        fs.writeFileSync(f, content);
        changed++;
        console.log('Updated', f);
    }
});
console.log('Total files changed:', changed);
