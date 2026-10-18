const fs = require('fs');
const content = fs.readFileSync('C:/Users/dell/.gemini/antigravity/brain/e59c9f86-5251-4448-a1cd-6347c2953b4a/.system_generated/steps/9054/content.md', 'utf8');

const hRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis;
let m;
console.log('--- 3RD YEAR HEADINGS ---');
while ((m = hRegex.exec(content)) !== null) {
  const text = m[1].replace(/<[^>]+>/g, '').trim();
  console.log(text);
}

const articleStart = content.indexOf('<article');
const articleEnd = content.indexOf('</article>');
if (articleStart !== -1 && articleEnd !== -1) {
  const article = content.substring(articleStart, articleEnd);
  console.log('--- ARTICLE TEXT ---');
  console.log(article.replace(/<[^>]+>/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 100).join('\n'));
} else {
  console.log('No article tag found');
}
