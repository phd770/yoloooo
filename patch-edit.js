import fs from 'fs';
let content = fs.readFileSync('src/lib/store.tsx', 'utf8');

const oldEdit = `    try {
      const now = Date.now();
      updateLocalChatMessage(messageId, { text: newText, editedAt: now });
      
      if (!hasQuotaError) {
        await updateDoc(doc(db, 'chat_messages', messageId), {
          text: newText,
          editedAt: now
        });
      }
    } catch (error) {`;

const newEdit = `    try {
      const now = Date.now();
      updateLocalChatMessage(messageId, { text: newText, editedAt: now });
      
      if (!hasQuotaError) {
        updateDoc(doc(db, 'chat_messages', messageId), {
          text: newText,
          editedAt: now
        }).catch(err => {
          console.error("Edit offline / failed:", err);
        });
      }
    } catch (error) {`;

content = content.replace(oldEdit, newEdit);
fs.writeFileSync('src/lib/store.tsx', content);
console.log("Success patching editMessage");
