import fs from 'fs';
const file = 'src/lib/store.tsx';
let content = fs.readFileSync(file, 'utf8');

const editMessageImpl = `
  const editMessage = async (messageId: string, newText: string) => {
    if (!currentUserId) return;
    try {
      const now = Date.now();
      updateLocalChatMessage(messageId, { text: newText, editedAt: now });
      
      if (!hasQuotaError) {
        await updateDoc(doc(db, 'chat_messages', messageId), {
          text: newText,
          editedAt: now
        });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error editing message)");
        setHasQuotaError(true);
        localStorage.setItem('dateapp_quota_exceeded', 'true');
      } else {
        console.error("Error editing message:", error);
      }
    }
  };

`;

content = content.replace("  const sendMessage = async", editMessageImpl + "  const sendMessage = async");

// add to AppContext.Provider
content = content.replace("sendMessage,", "editMessage,\n      sendMessage,");

fs.writeFileSync(file, content);
