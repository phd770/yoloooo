import React, { useState, useEffect } from 'react';
import { useApp } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, Check, X, Clock, MessageCircle, Send, Camera, Image as ImageIcon, BellOff, Sparkles, Eye } from 'lucide-react';
import { Mission } from '../lib/types';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { playSound } from '../lib/sounds';
import { compressImage } from '../lib/utils';
import { renderTextWithLinks } from '../lib/linkify';
import { History } from './History';

export function Inbox() {
  const { currentUser, partner, missions, updateMissionStatus, revealMystery } = useApp();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [postponeHours, setPostponeHours] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [viewingTease, setViewingTease] = useState<string | null>(null);
  const [teaseTimeLeft, setTeaseTimeLeft] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const myMissions = missions.filter(m => m.receiver === currentUser?.id);
  
  const pending = myMissions.filter(m => 
    ((m.status === 'sent' || m.status === 'opened' || m.status === 'saved_for_later') && (!m.unlockAt || m.unlockAt <= Date.now()) && (!m.snoozeUntil || m.snoozeUntil <= Date.now())) ||
    (m.status === 'locked' && m.unlockAt && m.unlockAt <= Date.now())
  );

  // Check for expired mandatory missions
  useEffect(() => {
    pending.forEach(mission => {
      if (mission.isMandatory && mission.mandatoryTimeLimit && mission.mandatoryPenalty) {
        const timeLimitMs = mission.mandatoryTimeLimit * 60 * 60 * 1000;
        const timeElapsed = currentTime - mission.createdAt;
        if (timeElapsed > timeLimitMs) {
          // Mission expired, apply penalty and mark as rejected/failed
          updateMissionStatus(mission.id, 'rejected', -mission.mandatoryPenalty, 'זמן המשימה עבר (קנס הופעל)');
          playSound('error');
          toast.error(`זמן משימת החובה עבר! נקנסת ב-${mission.mandatoryPenalty} נקודות.`);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, pending]);

  const locked = myMissions.filter(m => m.status === 'locked' && m.unlockAt && m.unlockAt > Date.now());
  const postponed = myMissions.filter(m => m.status === 'saved_for_later' && m.snoozeUntil && m.snoozeUntil > Date.now());
  const rejected = myMissions.filter(m => m.status === 'rejected');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (viewingTease && teaseTimeLeft > 0) {
      timer = setTimeout(() => {
        setTeaseTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (viewingTease && teaseTimeLeft === 0) {
      // Timer finished
      handleTeaseFinished(viewingTease);
    }
    return () => clearTimeout(timer);
  }, [viewingTease, teaseTimeLeft]);

  const handleTeaseFinished = async (missionId: string) => {
    setViewingTease(null);
    try {
      // Mark as viewed by removing imageUrl or setting a flag
      await updateMissionStatus(missionId, 'opened', undefined, undefined, ''); // Clear imageUrl
      toast.info('הזמן עבר! התמונה נעלמה 🙈');
    } catch (error) {
      console.error("Error updating tease image", error);
    }
  };

  const startTease = (missionId: string, timer: number) => {
    setViewingTease(missionId);
    setTeaseTimeLeft(timer);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 800, 0.7);
        setSelectedImage(compressedBase64);
      } catch (error) {
        console.error('Error compressing image:', error);
        toast.error('שגיאה בהעלאת התמונה');
      }
    }
  };

  const handleAction = async (missionId: string, action: Mission['status'], points: number = 0, response?: string, imageUrl?: string, unlockAt?: number, snoozeUntil?: number) => {
    setIsProcessing(missionId);
    try {
      const mission = missions.find(m => m.id === missionId);
      
      if (action === 'completed' && mission?.isViewOnce && !selectedImage) {
        toast.error('חובה לצרף תמונה למשימה זו! 📸');
        return;
      }

      await updateMissionStatus(missionId, action, points, response, imageUrl, unlockAt, snoozeUntil);
      
      if (action === 'completed') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff4e00', '#ec4899', '#ffffff', '#fbbf24']
        });
        toast.success('המשימה הושלמה! כל הכבוד 🎉', {
          description: `צברת ${points} נקודות`
        });
      } else if (action === 'rejected') {
        toast.info('המשימה נדחתה');
      } else if (action === 'saved_for_later') {
        toast.info('המשימה נשמרה לאחר כך ⏳');
      }

      if (expandedMission === missionId) {
        setExpandedMission(null);
        setResponseText('');
        setSelectedImage(null);
      }
    } catch (error) {
      toast.error('שגיאה בעדכון המשימה');
    } finally {
      setIsProcessing(null);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString('he-IL')} ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="p-6 max-w-md mx-auto pt-8">
      <header className="mb-6 mt-4 relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B6B]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif italic mb-1 text-slate-800">התראות</h1>
            <p className="text-sm border-b-2 border-[#FF6B6B] inline-block font-medium uppercase tracking-widest text-[#FF6B6B]">כל מה שקורה</p>
          </div>
          <BellOff size={32} className="text-[#FF6B6B]/40" />
        </div>
      </header>

      <div className="flex bg-slate-100 p-1 rounded-xl mb-6 shadow-inner">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          משימות ממתינות
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          היסטוריה
        </button>
      </div>

      {activeTab === 'pending' && (
      <div className="space-y-6">
        {/* Locked Missions */}
        {locked.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
              <Lock size={16} className="text-[#FF6B6B]" /> משימות נעולות לערב
            </h2>
            <div className="space-y-3">
              {locked.map(mission => (
                <motion.div 
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                    <Lock size={20} className="text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-700">משימה סודית מ{mission.sender === 'system' ? 'המערכת' : mission.sender === 'boaz' ? 'התנתקות' : 'התחברות'}</h3>
                    <p className="text-sm text-slate-500">תיפתח בשעה {formatTime(mission.unlockAt!)}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                    {formatDateTime(mission.createdAt)}
                  </span>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Pending Missions */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
            <Unlock size={16} className="text-green-500" /> פתוחות לביצוע
          </h2>
          <AnimatePresence>
            {pending.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl"
              >
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-300 mb-4">
                  <BellOff size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-600 mb-2">הכל שקט בינתיים...</h3>
                <p className="text-sm text-slate-400 max-w-[200px]">
                  אין משימות שמחכות לך כרגע. אולי כדאי לשלוח משהו ל{partner?.name}?
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {pending.map(mission => (
                  <motion.div 
                    key={mission.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, height: 0 }}
                    onClick={() => {
                      if (expandedMission !== mission.id) {
                        setExpandedMission(mission.id);
                        if (mission.status === 'sent') {
                          handleAction(mission.id, 'opened', 0);
                        }
                      }
                    }}
                    className={`rounded-3xl p-6 border transition-all cursor-pointer shadow-sm ${mission.isSpecialRequest ? 'bg-[#FF6B6B]/5 border-[#FF6B6B]/20' : 'bg-white border-slate-200'} ${expandedMission === mission.id ? 'ring-2 ring-[#FF6B6B]/50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs uppercase tracking-widest text-[#FF6B6B] font-medium flex items-center gap-2">
                            {mission.sender === 'system' ? 'הודעת מערכת 🔔' : mission.isMystery && !mission.isMysteryRevealed ? 'משימת הפתעה 🎁' : mission.isMandatory ? 'משימת חובה 🔥' : mission.isSpecialRequest ? `בקשה מיוחדת רמה ${mission.specialRequestLevel}` : mission.status === 'saved_for_later' ? 'נשמר לאחר כך ⏳' : 'משימה חדשה'}
                            {mission.tier && <span className="text-yellow-500">{'⭐'.repeat(mission.tier)}</span>}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                            {formatDateTime(mission.createdAt)}
                          </span>
                        </div>
                        <h3 className="text-xl font-serif italic text-slate-800">
                          {mission.isMystery && !mission.isMysteryRevealed ? 'משימת הפתעה' : mission.title}
                        </h3>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {mission.pointsValue ? (
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-mono font-medium">
                            +{mission.pointsValue} נק'
                          </span>
                        ) : null}
                        {mission.isMandatory && mission.mandatoryTimeLimit && (
                          <span className="bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded-full text-[10px] font-mono whitespace-nowrap">
                            נותרו {Math.max(0, Math.ceil((mission.mandatoryTimeLimit * 60 * 60 * 1000 - (currentTime - mission.createdAt)) / (60 * 60 * 1000)))} שעות
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                      {mission.isMystery && !mission.isMysteryRevealed ? 'האם תסכים/י לקבל את המשימה בלי לדעת מהי?' : mission.shortText}
                    </p>

                    <AnimatePresence>
                      {expandedMission === mission.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto', transition: { duration: 0.3, ease: 'easeOut' } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
                          className="overflow-hidden"
                        >
                          {mission.isMystery && !mission.isMysteryRevealed ? (
                            <div className="flex gap-2 mt-4">
                              <button 
                                onClick={(e) => { e.stopPropagation(); revealMystery(mission.id); }}
                                className="flex-1 bg-purple-500 text-white hover:bg-purple-600 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                              >
                                <Sparkles size={18} /> קבל/י משימה
                              </button>
                              {!mission.isMandatory && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAction(mission.id, 'rejected', 0); }}
                                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                >
                                  <X size={18} /> דחה
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              {mission.fullText && (
                                <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {renderTextWithLinks(mission.fullText)}
                                  </p>
                                </div>
                              )}

                              {mission.imageUrl && (
                                <div className="mb-6">
                                  {mission.teaseTimer ? (
                                    viewingTease === mission.id ? (
                                      <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                        <img src={mission.imageUrl} alt="Tease" className="w-full h-full object-cover" />
                                        <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-1 rounded-full font-mono font-bold text-lg backdrop-blur-sm border border-white/20">
                                          {teaseTimeLeft}s
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); startTease(mission.id, mission.teaseTimer!); }}
                                        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed py-8 rounded-xl flex flex-col items-center justify-center gap-3 transition-colors shadow-sm"
                                      >
                                        <div className="w-12 h-12 rounded-full bg-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B]">
                                          <Eye size={24} />
                                        </div>
                                        <div className="text-center">
                                          <p className="font-medium text-slate-700">צפה בתמונת טיזינג</p>
                                          <p className="text-xs text-slate-500">התמונה תיעלם לאחר {mission.teaseTimer} שניות!</p>
                                        </div>
                                      </button>
                                    )
                                  ) : (
                                    <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                      <img src={mission.imageUrl} alt="Attached" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="space-y-4">
                            {mission.isViewOnce && (
                              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                                {selectedImage ? (
                                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200">
                                    <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                                      className="absolute top-2 right-2 p-1 bg-white/80 rounded-full text-slate-700 hover:bg-white shadow-sm"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="w-12 h-12 rounded-full bg-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B]">
                                      <Camera size={24} />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-sm font-medium text-slate-700">צלם/י או בחר/י תמונה</p>
                                      <p className="text-xs text-slate-500">התמונה תימחק לאחר צפייה אחת</p>
                                    </div>
                                    <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm text-slate-700">
                                      בחר קובץ
                                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} onClick={e => e.stopPropagation()} />
                                    </label>
                                  </>
                                )}
                              </div>
                            )}

                            {mission.sender !== 'system' && (
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={responseText}
                                  onChange={(e) => setResponseText(e.target.value)}
                                  placeholder="הוסף תגובה (אופציונלי)..."
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[16px] text-slate-800 focus:outline-none focus:border-[#FF6B6B] transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {responseText.trim() && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(mission.id, mission.status, 0, responseText);
                                      toast.success('תגובה נשלחה');
                                    }}
                                    className="bg-[#FF6B6B] text-white px-4 rounded-xl hover:bg-[#ff5252] transition-colors flex items-center justify-center shadow-sm"
                                  >
                                    <Send size={18} />
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="flex flex-col gap-2">
                              {mission.sender === 'system' ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAction(mission.id, 'completed', 0, ''); }}
                                  className="w-full bg-[#FF6B6B] text-white hover:bg-[#ff5252] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                >
                                  <Check size={18} /> הבנתי
                                </button>
                              ) : (
                                <>
                                  <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (navigator.vibrate) navigator.vibrate(50);
                                      playSound('success');
                                      handleAction(mission.id, 'completed', mission.pointsValue || 0, responseText); 
                                    }}
                                    className="w-full bg-[#FF6B6B] text-white hover:bg-[#ff5252] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                  >
                                    <Check size={18} /> בוצע
                                  </motion.button>
                                  
                                  <div className="flex gap-2">
                                    {mission.status !== 'saved_for_later' && (
                                      <>
                                        <button 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (navigator.vibrate) navigator.vibrate(30);
                                            playSound('click');
                                            const snoozeUntil = Date.now() + (postponeHours * 60 * 60 * 1000);
                                            handleAction(mission.id, 'saved_for_later', 0, responseText, undefined, undefined, snoozeUntil); 
                                          }}
                                          className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                        >
                                          <Clock size={18} /> לאחר {postponeHours} שעות
                                        </button>
                                        <div className="flex items-center gap-2 mt-2">
                                          <input 
                                            type="number" 
                                            value={postponeHours} 
                                            onChange={(e) => setPostponeHours(Number(e.target.value))}
                                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800"
                                          />
                                          <span className="text-sm text-slate-500">שעות</span>
                                        </div>
                                      </>
                                    )}
                                    {!mission.isMandatory && (
                                      <motion.button 
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                                          playSound('error');
                                          handleAction(mission.id, 'rejected', 0, responseText); 
                                        }}
                                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                      >
                                        <X size={18} /> דחה
                                      </motion.button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* Postponed Missions */}
        {postponed.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
              <Clock size={16} /> משימות שנדחו לאחר כך
            </h2>
            <div className="space-y-3">
              {postponed.map(mission => (
                <div 
                  key={mission.id}
                  className="bg-white border text-opacity-80 border-slate-200 rounded-2xl p-4 flex items-center gap-4 opacity-80"
                >
                  <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center border border-yellow-100">
                    <Clock size={20} className="text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-700">{mission.title}</h3>
                    <p className="text-sm text-slate-500">יחזור ב-{formatTime(mission.snoozeUntil!)}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                    {formatDateTime(mission.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rejected Missions */}
        {rejected.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
              <X size={16} /> משימות שנדחו
            </h2>
            <div className="space-y-3">
              {rejected.map(mission => (
                <div 
                  key={mission.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 opacity-70"
                >
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                    <X size={20} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-700">{mission.title}</h3>
                    <p className="text-sm text-slate-500">נדחתה</p>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                    {formatDateTime(mission.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}

      {activeTab === 'history' && (
        <div className="mt-4">
          <History />
        </div>
      )}
    </div>
  );
}
