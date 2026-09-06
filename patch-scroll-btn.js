import fs from 'fs';
let content = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

const scrollBtnJSX = `
        {/* Scroll to bottom button */}
        {!isAtBottomRef.current && chatMessages.length > 0 && (
          <button
            onClick={() => {
              const el = chatContainerRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }}
            className="absolute bottom-20 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 z-40 transition-all"
          >
            <ChevronRight size={20} className="rotate-90" />
          </button>
        )}

        {/* Edit Indicator */}`;

content = content.replace(
  "{/* Edit Indicator */}",
  scrollBtnJSX
);

fs.writeFileSync('src/components/DiscreteChat.tsx', content);
console.log("Success patching scroll to bottom button");
