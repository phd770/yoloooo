import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `  }, []);צלחה! 🔒', { id: 'save-vault' });
      playSound('success');
    } catch (err) {
      console.error("Error saving to vault:", err);
      toast.error('שגיאה בשמירת הקובץ בכספת', { id: 'save-vault' });
    }
  };`,
  `  };`
);
fs.writeFileSync(file, content);
