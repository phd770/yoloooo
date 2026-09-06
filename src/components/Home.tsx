import React from 'react';
import { useApp } from '../lib/store';
import { Search, Menu, User, Gift, Tag, Activity } from 'lucide-react';

export function Home({ onNavigate }: { onNavigate?: (tab: 'home' | 'inbox' | 'history' | 'settings' | 'chat') => void }) {
  const { currentUser } = useApp();

  return (
    <div className="flex flex-col min-h-full bg-[#f8fafc] overflow-y-auto scroll-smooth w-full">
      {/* Top Header */}
      <div className="bg-white px-4 pt-6 pb-3 sticky top-0 z-20 shadow-sm rounded-b-3xl">
        <div className="flex items-center justify-between mb-4 mt-2">
          <Menu className="text-gray-600" size={26} />
          <div className="flex flex-col items-center">
            <div className="text-2xl tracking-tight leading-none">
              <span className="text-[#FF6B6B] italic font-serif opacity-90 pr-1">my</span>
              <span className="font-bold text-[#4a5568]">baby</span>
              <span className="font-light text-[#4a5568]"> Land</span>
            </div>
            <div className="bg-[#FF6B6B] text-white text-[9px] px-2 py-[2px] rounded-sm mt-1">
              איתך מהרגע הראשון
            </div>
          </div>
          <User className="text-gray-600" size={26} />
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="נותני שירות, פעילויות, קטגוריות..."
            className="w-full bg-[#f8fafc] border border-gray-200 rounded-[20px] py-2.5 px-5 pr-4 text-[16px] focus:outline-none focus:ring-1 focus:ring-[#FF6B6B]"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF6B6B]" size={20} />
        </div>
      </div>

      {/* Main Content Area with Image Background */}
      <div className="relative flex-1 bg-[#dcbca1]">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1518049362265-d5b2a6467637?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
            alt="Pregnancy"
            className="w-full h-full object-cover opacity-90 mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
        </div>

        <div className="relative z-10 px-4 pt-4 flex flex-col h-[50dvh]">
          {/* Tabs */}
          <div className="flex justify-between items-center gap-2 mb-12">
            <button className="flex-grow bg-white/30 backdrop-blur-md border border-white/40 text-white font-medium py-1.5 rounded-lg text-sm text-center shadow-sm">
              הריון שלי
            </button>
            <button className="flex-grow bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium py-1.5 rounded-lg text-sm text-center">
              אליה
            </button>
            <button className="flex-grow bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium py-1.5 rounded-lg text-sm text-center">
              לביא
            </button>
            <button className="bg-white/10 backdrop-blur-sm border border-white/20 text-white w-10 py-1.5 rounded-lg text-sm flex justify-center items-center">
              +
            </button>
          </div>

          {/* User Progress */}
          <div className="text-center mt-auto mb-20">
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md">
              היי {currentUser?.name || ''}, צהריים טובים
            </h1>
            <p className="text-white drop-shadow-md mb-4 text-lg">
              התקדמות ההריון שלך
            </p>
            
            <div className="bg-white/20 backdrop-blur-md rounded-full h-10 w-full max-w-sm mx-auto mb-2 border border-white/30 overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 w-[40%] bg-[#FF6B6B] rounded-r-full rounded-l-full shadow-[0_0_15px_rgba(255,107,107,0.5)]" />
              <div className="absolute inset-0 flex items-center justify-center font-bold text-white z-10 drop-shadow-md text-lg">
                40%
              </div>
            </div>
            
            <p className="text-white drop-shadow-md text-sm mt-3 font-medium">
              נשארו 5.6 חודשים - 25 שבועות (כולל השבוע)
            </p>
          </div>

          {/* Floating Action Circles at bottom overlapping the bottom white section */}
          <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-4 px-4 z-20">
            <div className="bg-white rounded-3xl shadow-xl w-[28%] aspect-square flex flex-col items-center justify-center gap-2 p-2">
              <div className="w-12 h-12 bg-[#f0f4f8] rounded-full flex items-center justify-center text-[#4a5568]">
                <Activity size={24} />
              </div>
              <span className="text-[11px] font-bold text-[#4a5568] text-center leading-tight">מידע<br/>מקצועי</span>
            </div>
            <div className="bg-white rounded-3xl shadow-xl w-[28%] aspect-square flex flex-col items-center justify-center gap-2 p-2">
              <div className="w-12 h-12 bg-[#f0f4f8] rounded-full flex items-center justify-center text-[#4a5568]">
                <Gift size={24} />
              </div>
              <span className="text-[11px] font-bold text-[#4a5568] text-center leading-tight">הטבות<br/>&nbsp;</span>
            </div>
            <div className="bg-white rounded-3xl shadow-xl w-[28%] aspect-square flex flex-col items-center justify-center gap-2 p-2">
              <div className="w-12 h-12 bg-[#f0f4f8] rounded-full flex items-center justify-center text-[#4a5568]">
                <Tag size={24} />
              </div>
              <span className="text-[11px] font-bold text-[#4a5568] text-center leading-tight">קופונים<br/>&nbsp;</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Banner below circles */}
      <div className="bg-white flex-1 px-4 pt-[60px] pb-6 w-full">
        <div className="bg-[#e2e8f0] h-20 rounded-xl w-full flex items-center justify-center text-gray-500 text-sm overflow-hidden relative">
           <img src="https://images.unsplash.com/photo-1522771930-78848d9293e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="baby clothes" className="w-full h-full object-cover opacity-50" />
           <div className="absolute bg-white/90 px-4 py-1.5 font-bold text-[#1e3a8a] flex items-center gap-1 rounded shadow-sm backdrop-blur-sm shadow-blue-900/10 text-sm">
             <div className="bg-[#1e3a8a] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] italic">life</div>
             BABY'S
           </div>
        </div>
      </div>
    </div>
  );
}
