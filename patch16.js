import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `        setTimeout(() => {
          const chatContainer = document.getElementById('chat-scroll-container');
          if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);`,
  ``
);

fs.writeFileSync(file, content);
