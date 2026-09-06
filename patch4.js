import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

const toReplace = `    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  };

  if (!currentUser || !partner) return null;`;

const replacement = `    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handleSaveToVault = async (url: string, type: 'image' | 'video') => {
    try {
      toast.loading('שומר בכספת...', { id: 'save-vault' });
      
      let ext = type === 'image' ? 'jpg' : 'mp4';
      
      if (url.startsWith('data:')) {
         let blob: Blob;
         const arr = url.split(',');
         const mimeMatch = arr[0].match(/:(.*?);/);
         const mime = mimeMatch ? mimeMatch[1] : (type === 'image' ? 'image/jpeg' : 'video/mp4');
         const bstr = atob(arr[1]);
         let n = bstr.length;
         const u8arr = new Uint8Array(n);
         while(n--){
           u8arr[n] = bstr.charCodeAt(n);
         }
         blob = new Blob([u8arr], {type:mime});
         ext = mime.split('/')[1] || ext;
         await addMediaToVault(type, \`chat-media-\${Date.now()}.\${ext}\`, blob);
      } else {
         const urlExt = url.split('.').pop()?.split('?')[0];
         if (urlExt && urlExt.length < 10) {
           ext = urlExt;
         }
         await addUrlToVault(type, \`chat-media-\${Date.now()}.\${ext}\`, url);
      }
      toast.success('נשמר בכספת בהצלחה! 🔒', { id: 'save-vault' });
      playSound('success');
    } catch (err) {
      console.error("Error saving to vault:", err);
      toast.error('שגיאה בשמירת הקובץ בכספת', { id: 'save-vault' });
    }
  };

  if (!currentUser || !partner) return null;`;

content = content.replace(toReplace, replacement);

fs.writeFileSync(file, content);
