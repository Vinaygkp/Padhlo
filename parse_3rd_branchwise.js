const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9054/content.md', 'utf8');

const idx = content.indexOf('Branch-Wise Notes Subjects');
if (idx !== -1) {
  const slice = content.substring(idx, idx + 4000);
  console.log(slice.replace(/<[^>]+>/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 100).join('\n'));

  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let m;
  const links = [];
  while ((m = linkRegex.exec(slice)) !== null) {
    links.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  console.log('--- LINKS IN SECTION ---', JSON.stringify(links, null, 2));
} else {
  console.log('Not found');
}
