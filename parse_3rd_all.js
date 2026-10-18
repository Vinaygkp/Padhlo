const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9054/content.md', 'utf8');

const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
const links = [];
let m;
while ((m = linkRegex.exec(content)) !== null) {
  const href = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim();
  links.push({ href, text });
}
console.log('Total links in 3rd year page:', links.length);
console.log(JSON.stringify(links.filter(l => l.href.includes('drive.google') || l.href.includes('aktu') || l.text.length > 5).slice(0, 30), null, 2));
