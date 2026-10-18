const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9020/content.md', 'utf8');

const start = content.indexOf('1. B.Tech Handwritten Notes');
const end = content.indexOf('2. B.Pharmacy Notes');

if (start !== -1 && end !== -1) {
  const btechSection = content.substring(start, end);
  console.log('--- B.TECH SECTION ---');
  console.log(btechSection.replace(/<[^>]+>/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 100).join('\n'));

  // Also extract all links in that section
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let m;
  const btechLinks = [];
  while ((m = linkRegex.exec(btechSection)) !== null) {
    btechLinks.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  console.log('--- B.TECH LINKS ---');
  console.log(JSON.stringify(btechLinks, null, 2));
} else {
  console.log('Could not find start or end');
}
