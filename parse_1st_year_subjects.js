const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9040/content.md', 'utf8');

// Find headings
const hRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis;
let m;
console.log('--- HEADINGS ---');
while ((m = hRegex.exec(content)) !== null) {
  const text = m[1].replace(/<[^>]+>/g, '').trim();
  if (text) console.log(text);
}

// Find all subject links / download links in the main content
const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
const links = [];
while ((m = linkRegex.exec(content)) !== null) {
  const href = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim();
  if (text.length > 2 && !href.includes('#') && !href.includes('wp-admin') && !href.includes('category') && !href.includes('tag')) {
    links.push({ href, text });
  }
}
console.log('--- SUBJECT LINKS ---');
console.log(JSON.stringify(links.filter(l => !l.text.includes('Menu') && !l.text.includes('Sign') && !l.text.includes('Login') && !l.text.includes('Register')), null, 2));
