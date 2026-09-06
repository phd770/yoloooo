const fs = require('fs');
let code = fs.readFileSync('src/lib/store.tsx', 'utf-8');

const regex1 = /console\.error\(\s*"([^"]+)"\s*,\s*([^)]+)\s*\);\s*if\s*\(isQuotaError\(([^)]+)\)\)\s*\{\s*setHasQuotaError\(true\);\s*\}/g;
code = code.replace(regex1, (match, msg, errVar1, errVar2) => {
  return `if (isQuotaError(${errVar2.trim()})) {\n        console.warn("Quota or connection error, working offline (${msg})");\n        setHasQuotaError(true);\n      } else {\n        console.error("${msg}", ${errVar1.trim()});\n      }`;
});

const regex2 = /console\.error\(\s*"([^"]+)"\s*,\s*([^)]+)\s*\);\s*if\s*\(isQuotaError\(([^)]+)\)\)\s*\{\s*setHasQuotaError\(true\);\s*localStorage\.setItem\('dateapp_quota_exceeded',\s*'true'\);\s*\}/g;
code = code.replace(regex2, (match, msg, errVar1, errVar2) => {
  return `if (isQuotaError(${errVar2.trim()})) {\n        console.warn("Quota or connection error, working offline (${msg})");\n        setHasQuotaError(true);\n        localStorage.setItem('dateapp_quota_exceeded', 'true');\n      } else {\n        console.error("${msg}", ${errVar1.trim()});\n      }`;
});

fs.writeFileSync('src/lib/store.tsx', code);
console.log("Done");
