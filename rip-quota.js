import fs from 'fs';

const files = [
  'src/components/DiscreteChat.tsx',
  'src/components/Games.tsx',
  'src/components/ConnectFour.tsx',
  'src/components/Vault.tsx',
  'src/lib/store.tsx',
  'src/lib/vaultStore.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Remove setting and getting the flag
  content = content.replace(/localStorage\.setItem\('dateapp_quota_exceeded',\s*'true'\);/g, '');
  content = content.replace(/try\s*\{\s*localStorage\.removeItem\('dateapp_quota_exceeded'\);\s*\}\s*catch\s*\{?\s*\}?/g, '');
  content = content.replace(/localStorage\.removeItem\('dateapp_quota_exceeded'\);/g, '');
  
  if (file === 'src/components/DiscreteChat.tsx') {
    content = content.replace(/const isOffline = localStorage\.getItem\('dateapp_quota_exceeded'\) === 'true';/g, 'const isOffline = false;');
  }
  
  if (file === 'src/components/Vault.tsx') {
    content = content.replace(/const isOffline = localStorage\.getItem\('dateapp_quota_exceeded'\) === 'true';/g, 'const isOffline = false;');
  }
  
  if (file === 'src/lib/vaultStore.ts') {
    content = content.replace(/const isOffline = localStorage\.getItem\('dateapp_quota_exceeded'\) === 'true';/g, 'const isOffline = false;');
  }

  fs.writeFileSync(file, content);
}
