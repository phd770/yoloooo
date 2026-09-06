import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

const handleSendReplacement = `  const handleSend = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageUrl && !videoUrl) return;
    if (isSending) return;
    
    setIsSending(true);
    try {
      if (editingMessageId) {
        await editMessage(editingMessageId, text);
        setEditingMessageId(null);
      } else {
        await sendMessage(text, imageUrl, videoUrl, isViewOnce, isViewOnce ? viewDuration : undefined, replyingTo?.id, replyingTo?.text ? replyingTo.text : (replyingTo?.imageUrl || replyingTo?.videoUrl ? "מדיה" : undefined));
      }
      setText('');
      setImageUrl('');
      setVideoUrl('');
      setIsViewOnce(false);
      setShowDurationSelector(false);
      setTypingStatus(false);
      setReplyingTo(null);
      const ta = document.getElementById('chat-input-textarea');
      if (ta) ta.style.height = 'auto';
      playSound('send');
      setTimeout(() => {
        const chatContainer = document.getElementById('chat-scroll-container');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 50);
    } finally {
      setIsSending(false);
    }
  };`;

const regex = /  const handleSend = async \(e: React\.FormEvent \| React\.KeyboardEvent\) => \{[\s\S]*?    \} finally \{\n      setIsSending\(false\);\n    \}\n  \};/;
content = content.replace(regex, handleSendReplacement);

fs.writeFileSync(file, content);
