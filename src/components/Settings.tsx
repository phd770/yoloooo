import React, { useState } from 'react';
import { useApp } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { Settings as SettingsIcon, User, ChevronRight, RefreshCw, AlertTriangle, List, Undo2, Lock } from 'lucide-react';
import { ManageButtons } from './ManageButtons';
import { toast } from 'sonner';
import { playSound } from '../lib/sounds';

export function Settings() {
  const { currentUser, resetAllMissions, setCurrentUser, chatSession, restoreChat } = useApp();
  const [view, setView] = useState<'main' | 'manage-buttons' | 'restore-chat'>('main');
  const [isResetting, setIsResetting] = useState(false);
  const [pinCode, setPinCode] = useState('');

  const handleReset = async (target: 'boaz' | 'mishel' | 'all') => {
    setIsResetting(true);
    try {
      await resetAllMissions(target);
      const targetName = target === 'all' ? 'כולם' : (target === 'boaz' ? 'התנתקות' : 'התחברות');
      toast.success(`הנתונים של ${targetName} אופסו בהצלחה! 🔄`);
    } catch (error) {
      toast.error('שגיאה באיפוס הנתונים');
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    toast.success('התנתקת בהצלחה');
  };

  return (
    <div className="p-6 max-w-md mx-auto pt-8">
      <AnimatePresence mode="wait">
        {view === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <header className="mb-8 mt-4 relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B6B]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="relative z-10">
                <h1 className="text-3xl font-serif italic mb-1 text-slate-800">הגדרות</h1>
                <p className="text-sm border-b-2 border-[#FF6B6B] inline-block font-medium uppercase tracking-widest text-[#FF6B6B]">נהל את החשבון והמשחק שלך</p>
              </div>
            </header>

            {/* Profile Section */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B] border border-[#FF6B6B]/20">
                  <User size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-serif italic text-slate-800">{currentUser?.name}</h2>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{currentUser?.points || 0} נקודות שנצברו</p>
                </div>
              </div>
            </section>

            {/* Menu Section */}
            <section className="space-y-3">
              <button 
                onClick={() => {
                  playSound('click');
                  setView('manage-buttons');
                }}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between transition-all shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-500 group-hover:text-[#FF6B6B] transition-colors">
                    <List size={20} />
                  </div>
                  <span className="font-medium text-slate-700">ניהול משימות</span>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>

              <button 
                onClick={async () => {
                  playSound('click');
                  if ('Notification' in window) {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                      toast.success('התראות מופעלות בהצלחה');
                    } else if (permission === 'denied') {
                      toast.error('התראות נחסמו. אנא יאשרו בהגדרות הדפדפן.');
                    }
                  } else {
                    toast.error('התראות לא נתמכות בדפדפן זה');
                  }
                }}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between transition-all shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-500 group-hover:text-amber-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  </div>
                  <span className="font-medium text-slate-700">הפעלת התראות מחוץ לאפליקציה</span>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>

              <button 
                onClick={() => {
                  playSound('click');
                  handleLogout();
                }}
                className="w-full bg-white hover:bg-red-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between transition-all shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-500 group-hover:text-red-500 transition-colors">
                    <AlertTriangle size={20} />
                  </div>
                  <span className="font-medium text-slate-700">התנתקות</span>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>

              {currentUser?.id === 'boaz' && (chatSession?.isDeleted || chatSession?.deletedAtByUser?.['boaz']) && (
                <button 
                  onClick={() => {
                    playSound('click');
                    setView('restore-chat');
                  }}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-4 flex items-center justify-between transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-200 text-slate-600 transition-colors">
                      <Undo2 size={20} />
                    </div>
                    <span className="font-medium text-slate-700">שחזור שיחה דיסקרטית</span>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
              )}
            </section>
          </motion.div>
        )}

        {view === 'manage-buttons' && (
          <motion.div
            key="manage"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <button 
                onClick={() => {
                  playSound('click');
                  setView('main');
                }}
                className="p-2 rounded-full bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 transition-all"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <span className="text-sm font-medium text-slate-500">חזרה להגדרות</span>
            </div>
            <ManageButtons />
          </motion.div>
        )}

        {view === 'restore-chat' && (
          <motion.div
            key="restore-chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full flex flex-col"
          >
            <div className="flex items-center gap-2 mb-6">
              <button 
                onClick={() => {
                  playSound('click');
                  setView('main');
                  setPinCode('');
                }}
                className="p-2 rounded-full bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 transition-all"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <span className="text-sm font-medium text-slate-500">חזרה להגדרות</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 mt-12">
              <div className="w-20 h-20 rounded-full bg-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B] mb-4 shadow-inner">
                <Lock size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 text-center">שחזור שיחה</h2>
              <p className="text-slate-500 text-center text-sm max-w-[250px]">
                הזן את קוד האבטחה כדי לשחזר את השיחה הדיסקרטית שנמחקה.
              </p>
              
              <div className="w-full max-w-[250px] space-y-4 mt-8">
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="קוד אבטחה"
                  className="w-full bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-3 text-center text-slate-800 focus:outline-none focus:border-[#FF6B6B] transition-colors tracking-widest text-xl"
                  maxLength={4}
                />
                <button
                  onClick={() => {
                    if (pinCode === '1004') {
                      restoreChat();
                      toast.success('השיחה שוחזרה בהצלחה!');
                      playSound('success');
                      setView('main');
                      setPinCode('');
                    } else {
                      toast.error('קוד שגוי');
                      playSound('error');
                      setPinCode('');
                    }
                  }}
                  disabled={pinCode.length !== 4}
                  className="w-full bg-[#FF6B6B] text-white py-3 shadow-md rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-[#ff5252]"
                >
                  שחזר
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Danger Zone - Always at the bottom of Settings tab */}
      {currentUser?.id === 'boaz' && view === 'main' && (
        <section className="mt-12 pt-8 border-t border-slate-200">
          <h2 className="text-sm font-medium text-red-500 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> אזור מסוכן
          </h2>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs text-red-600 mb-6 leading-relaxed">
              איפוס ימחק את היסטוריית המשימות ויאפס את הנקודות של המשתמש הנבחר. פעולה זו היא סופית.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleReset('boaz')}
                disabled={isResetting}
                className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-500 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw size={16} className={isResetting ? 'animate-spin' : ''} />
                {isResetting ? 'מאפס...' : 'איפוס התנתקות'}
              </button>
              <button
                onClick={() => handleReset('mishel')}
                disabled={isResetting}
                className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-500 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw size={16} className={isResetting ? 'animate-spin' : ''} />
                {isResetting ? 'מאפס...' : 'איפוס התחברות'}
              </button>
              <button
                onClick={() => handleReset('all')}
                disabled={isResetting}
                className="w-full bg-red-100 hover:bg-red-200 border border-red-300 text-red-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2 shadow-sm"
              >
                <RefreshCw size={16} className={isResetting ? 'animate-spin' : ''} />
                {isResetting ? 'מאפס...' : 'איפוס כולם'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
