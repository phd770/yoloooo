import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /        \{\/\* Reply Indicator \*\/\}\n        \{replyingTo && \(/;

const replacement = `        {/* Edit Indicator */}
        {editingMessageId && (
          <div className="bg-[#f8fafc] border-t border-[#e2e8f0] p-3 flex justify-between items-center text-sm shadow-inner">
            <div className="flex flex-col border-r-4 border-blue-500 pr-3 opacity-80">
              <span className="text-xs font-bold text-blue-500">עריכת הודעה</span>
              <span className="line-clamp-3 text-[#4a5568]">{text || 'מדיה'}</span>
            </div>
            <button onClick={() => { setEditingMessageId(null); setText(''); }} className="p-2 text-[#a0aec0] hover:text-[#4a5568]">
              <X size={20} />
            </button>
          </div>
        )}
        {/* Reply Indicator */}
        {replyingTo && (`

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
