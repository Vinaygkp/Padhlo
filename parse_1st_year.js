const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9034/content.md', 'utf8');

const hRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis;
let m;
console.log('--- HEADINGS ---');
while ((m = hRegex.exec(content)) !== null) {
  const text = m[1].replace(/<[^>]+>/g, '').trim();
  if (text) console.log(text);
}

// Find table or download links
const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
const links = [];
while ((m = linkRegex.exec(content)) !== null) {
  const href = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim();
  if (text.length > 2 && !href.includes('#') && !href.includes('wp-admin')) {
    links.push({ href, text });
  }
}
console.log('--- LINKS SAMPLE ---');
console.log(JSON.stringify(links.filter(l => l.text.toLowerCase().includes('download') || l.text.toLowerCase().includes('notes') || l.text.toLowerCase().includes('math') || l.text.toLowerCase().includes('physics') || l.text.toLowerCase().includes('chemistry') || l.text.toLowerCase().includes('electrical') || l.text.toLowerCase().includes('pps')).slice(0, 30), null, 2));
