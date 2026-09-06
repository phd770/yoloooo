const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const replacements = [
  { p: /bg-white\/5( |"|'|`|\})/g, r: 'bg-[#f8fafc]$1' },
  { p: /bg-white\/10( |"|'|`|\})/g, r: 'bg-[#f1f5f9]$1' },
  { p: /bg-white\/20( |"|'|`|\})/g, r: 'bg-[#e2e8f0]$1' },
  { p: /border-white\/10( |"|'|`|\})/g, r: 'border-[#e2e8f0]$1' },
  { p: /border-white\/20( |"|'|`|\})/g, r: 'border-[#cbd5e1]$1' },
  { p: /text-white\/20( |"|'|`|\})/g, r: 'text-[#cbd5e1]$1' },
  { p: /text-white\/30( |"|'|`|\})/g, r: 'text-[#94a3b8]$1' },
  { p: /text-white\/40( |"|'|`|\})/g, r: 'text-[#94a3b8]$1' },
  { p: /text-white\/50( |"|'|`|\})/g, r: 'text-[#64748b]$1' },
  { p: /text-white\/60( |"|'|`|\})/g, r: 'text-[#64748b]$1' },
  { p: /text-white\/70( |"|'|`|\})/g, r: 'text-[#475569]$1' },
  { p: /text-white\/80( |"|'|`|\})/g, r: 'text-[#334155]$1' },
  // Be careful with text-white! We won't globally replace it unless it's in a standalone class that seems dark mode
  // The User didn't want black backgrounds, so let's also remove bg-zinc-900 etc
  { p: /bg-zinc-900/g, r: 'bg-white' },
  { p: /bg-black\/40( |"|'|`|\})/g, r: 'bg-white/40$1' },
  { p: /bg-black\/50( |"|'|`|\})/g, r: 'bg-white/50$1' },
  { p: /bg-black\/80( |"|'|`|\})/g, r: 'bg-white/80$1' },
  // Wait, I shouldn't universally replace text-white because there are white texts on red buttons
];

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (file === 'Home.tsx' || file === 'SendMissions.tsx' || file === 'Layout.tsx') {
      continue;
  }
  
  // Replace text-white to text-slate-800 generally, BUT NOT if it specifies bg-primary or bg-red
  // A simpler way is to just do a smart regex or just replace background colors and text-gray
  const original = content;
  for (const { p, r } of replacements) {
    content = content.replace(p, r);
  }
  
  if(original !== content) {
    fs.writeFileSync(filePath, content);
  }
}
console.log('Done replacing colors in components.');