import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /                  \{isMe && \(\n                    <button onClick=\{[^}]+\} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-3 -mx-2 text-\\[#a0aec0\\] hover:text-\\[#FF6B6B\\] active:bg-gray-100 rounded-full transition-all">\n                      <Reply size=\{16\} \/>\n                    <\/button>\n                  \)\}/;

const replacement = `                  {isMe && (
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex flex-col sm:flex-row -mx-2">
                      <button onClick={() => setReplyingTo(msg)} className="p-2 sm:p-3 text-[#a0aec0] hover:text-[#FF6B6B] active:bg-gray-100 rounded-full transition-all" title="הגב">
                        <Reply size={16} />
                      </button>
                      {Date.now() - msg.createdAt <= 30 * 60 * 1000 && !msg.imageUrl && !msg.videoUrl && (
                        <button onClick={() => {
                          setEditingMessageId(msg.id);
                          setText(msg.text || '');
                          setReplyingTo(null);
                        }} className="p-2 sm:p-3 text-[#a0aec0] hover:text-[#FF6B6B] active:bg-gray-100 rounded-full transition-all" title="ערוך">
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  )}`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
