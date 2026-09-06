import fs from 'fs';

const files = [
  'src/components/Games.tsx',
  'src/components/ConnectFour.tsx',
  'src/components/Backgammon.tsx',
  'src/components/Layout.tsx',
  'src/lib/store.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Games.tsx
  if (file === 'src/components/Games.tsx') {
    content = content.replace(/, hasQuotaError/g, '');
    content = content.replace(/hasQuotaError/g, 'false');
  }
  
  // ConnectFour.tsx
  if (file === 'src/components/ConnectFour.tsx') {
    content = content.replace(/, hasQuotaError/g, '');
    content = content.replace(/hasQuotaError/g, 'false');
  }

  // Backgammon.tsx
  if (file === 'src/components/Backgammon.tsx') {
    content = content.replace(/, hasQuotaError/g, '');
    content = content.replace(/hasQuotaError/g, 'false');
  }
  
  // Layout.tsx
  if (file === 'src/components/Layout.tsx') {
    content = content.replace(/, hasQuotaError/g, '');
    content = content.replace(/hasQuotaError/g, 'false');
  }

  // store.tsx
  if (file === 'src/lib/store.tsx') {
    // We'll do a simpler replace. Anywhere it says `hasQuotaError` we can replace with `false` except in declarations.
    // Let's actually remove it from AppContextType
    content = content.replace(/hasQuotaError: boolean;/g, '');
    content = content.replace(/const \[hasQuotaError, setHasQuotaError\] = useState\(false\);/g, 'const hasQuotaError = false;');
    content = content.replace(/setHasQuotaError\(true\);/g, '');
    content = content.replace(/setHasQuotaError\(false\);/g, '');
  }

  fs.writeFileSync(file, content);
}
