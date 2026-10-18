const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9054/content.md', 'utf8');

const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
const links = [];
let m;
while ((m = linkRegex.exec(content)) !== null) {
  const href = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim();
  if (href.includes('drive.google.com') || text.toLowerCase().includes('dbms') || text.toLowerCase().includes('network') || text.toLowerCase().includes('automata') || text.toLowerCase().includes('compiler') || text.toLowerCase().includes('web') || text.toLowerCase().includes('software')) {
    links.push({ href, text });
  }
}
console.log('--- 3RD YEAR MATCHED LINKS (' + links.length + ') ---');
console.log(JSON.stringify(links, null, 2));
