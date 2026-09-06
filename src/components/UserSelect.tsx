import React, { useState } from 'react';
import { useApp } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';

export function UserSelect() {
  const { setCurrentUser } = useApp();
  const [step, setStep] = useState<'welcome' | 'select' | 'pin'>('welcome');
  const [selectedId, setSelectedId] = useState<'mishel' | 'boaz' | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId === 'boaz' && pin === '9999') {
      setCurrentUser({ id: 'boaz', name: 'התנתקות', gender: 'male' });
    } else if (selectedId === 'mishel' && pin === '7777') {
      setCurrentUser({ id: 'mishel', name: 'התחברות', gender: 'female' });
    } else {
      setError('קוד שגוי, נסה שוב');
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden bg-[#f9f5f0]">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1519689680058-324335c77eba?q=80&w=1000&auto=format&fit=crop")' }}
      >
        <div className="absolute inset-0 bg-white/20" />
      </div>

      {/* Top Section - Logo & Branding */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-12 pb-8">
        
        {/* Back Button (dummy like in image) */}
        <div className="absolute top-12 right-6">
          <button className="w-10 h-10 rounded-xl border border-white/60 flex items-center justify-center text-white backdrop-blur-sm" onClick={() => setStep('welcome')}>
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Text Logo Area */}
        <div className="relative text-center mt-20 flex flex-col items-center justify-center">
          {/* Cursive pink "my" */}
          <div style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive" }} className="absolute -top-6 left-[20%] text-[#FF6B6B] text-5xl z-20 transform -rotate-[15deg]">
            my
          </div>
          {/* Main big text */}
          <div className="text-[5.5rem] leading-[0.8] font-serif text-[#546A76] tracking-tighter relative z-10 lowercase flex flex-col items-center justify-center" style={{ fontFamily: 'Georgia, serif' }}>
            <span>baby</span>
            <span>land</span>
          </div>
          {/* Small heart icon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#FF6B6B] text-2xl z-20 mt-1">
            ♥
          </div>
        </div>

        {/* Coral badge */}
        <div className="mt-8 bg-[#FF6B6B] text-white px-6 py-1.5 rounded-lg text-xl font-medium tracking-wide shadow-md">
          איתך מהרגע הראשון
        </div>
      </div>

      {/* Bottom White Card */}
      <div className="relative z-20 bg-white w-full rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.06)] px-8 pt-10 pb-12 flex flex-col text-center min-h-[45vh]">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center w-full"
            >
              <h1 className="text-3xl font-bold text-[#4a5568] mb-6">
                הבית החדש שלך ושל הבייבי
              </h1>
              <p className="text-[#718096] mb-10 leading-relaxed text-sm max-w-[280px]">
                מהצעד הראשון בהיריון ועד רגעי ההורות המרגשים, אנחנו כאן כדי לעטוף אותך. סדנאות, יועצות, הטבות והפעילויות הכי שוות מחכות בפנים.
              </p>
              
              <button 
                onClick={() => setStep('select')}
                className="w-full bg-[#FF6B6B] hover:bg-[#ff5252] text-white text-xl font-medium py-4 rounded-xl transition-colors mb-4 shadow-sm"
              >
                התחברות או הרשמה
              </button>
              
              <button className="text-[#a0aec0] text-lg font-medium py-2">
                מאוחר יותר
              </button>
            </motion.div>
          )}

          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center w-full h-full justify-center"
            >
              <h2 className="text-2xl font-bold text-[#4a5568] mb-2">התחברות והתנתקות</h2>
              <p className="text-[#718096] mb-8">אנא בחרו פרופיל להתחברות</p>
              <div className="space-y-4 w-full">
                <button
                  onClick={() => { setSelectedId('mishel'); setStep('pin'); }}
                  className="w-full py-4 px-6 rounded-xl border border-[#e2e8f0] text-[#4a5568] bg-[#f8fafc] transition-all text-xl font-medium hover:border-[#FF6B6B]"
                >
                  התחברות 
                </button>
                <button
                  onClick={() => { setSelectedId('boaz'); setStep('pin'); }}
                  className="w-full py-4 px-6 rounded-xl border border-[#e2e8f0] text-[#4a5568] bg-[#f8fafc] transition-all text-xl font-medium hover:border-[#FF6B6B]"
                >
                 התנתקות 
                </button>
              </div>
              <button 
                onClick={() => setStep('welcome')}
                className="mt-8 text-[#a0aec0] text-lg underline"
              >
                חזור אחורה
              </button>
            </motion.div>
          )}

          {step === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center w-full"
            >
              <h2 className="text-2xl font-bold text-[#4a5568] mb-2">
                היי 👋
              </h2>
              <p className="text-[#a0aec0] mb-6">{selectedId === 'mishel' ? 'הזיני את הקוד הסודי שלך' : 'הזן את הקוד הסודי שלך'}</p>
              
              <form onSubmit={(e) => {
                handleLogin(e);
                try {
                  (document.activeElement as HTMLElement)?.blur();
                } catch {}
              }} className="w-full">
                <div className="relative w-full flex items-center">
                  <input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => { 
                      const val = e.target.value.replace(/\D/g, '');
                      setPin(val); 
                      setError(''); 
                      if (val.length === 4) {
                        setTimeout(() => {
                          if (selectedId === 'boaz' && val === '9999') {
                            localStorage.setItem('last_activity', Date.now().toString());
                            setCurrentUser({ id: 'boaz', name: 'התנתקות', gender: 'male' });
                            try {
                              (document.activeElement as HTMLElement)?.blur();
                            } catch {}
                          } else if (selectedId === 'mishel' && val === '7777') {
                            localStorage.setItem('last_activity', Date.now().toString());
                            setCurrentUser({ id: 'mishel', name: 'התחברות', gender: 'female' });
                            try {
                              (document.activeElement as HTMLElement)?.blur();
                            } catch {}
                          } else {
                            setError('קוד שגוי');
                          }
                        }, 100);
                      }
                    }}
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] text-center text-[36px] tracking-[0.4em] py-4 pl-12 pr-12 rounded-xl focus:outline-none focus:border-[#FF6B6B] transition-colors text-[#4a5568]"
                    autoFocus
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute left-4 text-[#a0aec0] hover:text-[#FF6B6B] p-2 focus:outline-none cursor-pointer"
                    title={showPin ? "הסתר קוד" : "הצג קוד"}
                  >
                    {showPin ? <EyeOff size={24} /> : <Eye size={24} />}
                  </button>
                </div>
                
                <div className="h-8 mt-2 flex items-center justify-center">
                  {error && <p className="text-[#FF6B6B] font-medium">{error}</p>}
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 rounded-xl bg-[#FF6B6B] text-white hover:bg-[#ff5252] transition-colors text-xl font-medium shadow-sm mt-4 cursor-pointer font-bold"
                >
                  היכנס
                </button>

                <button 
                  type="button" 
                  onClick={() => { setStep('select'); setPin(''); setError(''); setShowPin(false); }} 
                  className="mt-6 text-[#a0aec0] text-lg underline cursor-pointer"
                >
                  שינוי משתמש
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
