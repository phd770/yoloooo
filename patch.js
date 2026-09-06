import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "document.addEventListener(  const handleSaveToVault = useCallback(async (url: string, type: 'image' | 'video') => {",
  `document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handleSaveToVault = async (url: string, type: 'image' | 'video') => {`
);
fs.writeFileSync(file, content);
