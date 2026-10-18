const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9048/content.md', 'utf8');

const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
const links = [];
let m;
while ((m = linkRegex.exec(content)) !== null) {
  const href = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim();
  if (text.length > 2 && (href.includes('drive.google.com') || href.includes('notesgallery.com') || text.toLowerCase().includes('dsa') || text.toLowerCase().includes('coa') || text.toLowerCase().includes('discrete') || text.toLowerCase().includes('operating') || text.toLowerCase().includes('python') || text.toLowerCase().includes('technical') || text.toLowerCase().includes('data structure'))) {
    links.push({ href, text });
  }
}
console.log('--- 2ND YEAR MATCHED LINKS (' + links.length + ') ---');
console.log(JSON.stringify(links, null, 2));
