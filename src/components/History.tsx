import React, { useState } from 'react';
import { useApp } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Clock, Send, Eye, EyeOff, X, History as HistoryIcon, Undo2, MessageSquareHeart } from 'lucide-react';
import { Mission } from '../lib/types';
import { toast } from 'sonner';
import { playSound } from '../lib/sounds';
import { renderTextWithLinks } from '../lib/linkify';

export function History() {
  const { currentUser, partner, missions, markMissionAsViewed, revertMissionCompletion } = useApp();
  const [viewingPhoto, setViewingPhoto] = useState<Mission | null>(null);

  // Combine sent and received history into one timeline, newest first
  const allHistory = missions.filter(m => 
    (m.receiver === currentUser?.id && ['completed', 'rejected'].includes(m.status)) ||
    (m.sender === currentUser?.id)
  ).sort((a, b) => b.createdAt - a.createdAt);

  const handleViewPhoto = async (mission: Mission) => {
    setViewingPhoto(mission);
    if (mission.isViewOnce && !mission.isViewed) {
      try {
        await markMissionAsViewed(mission.id);
        toast.info('זוהי צפייה חד-פעמית. התמונה תימחק בסגירה 🔒');
      } catch (error) {
        toast.error('שגיאה בעדכון מצב הצפייה');
      }
    }
  };

  const getStatusIcon = (status: Mission['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'rejected': return <XCircle className="text-red-500" size={16} />;
      case 'saved_for_later': return <Clock className="text-yellow-500" size={16} />;
      default: return <Send className="text-blue-500" size={16} />;
    }
  };

  const getStatusText = (status: Mission['status']) => {
    switch (status) {
      case 'completed': return 'בוצע';
      case 'rejected': return 'נדחה';
      case 'saved_for_later': return 'נשמר לאחר כך';
      case 'locked': return 'נעול';
      case 'pending': return 'ממתין';
      case 'opened': return 'נצפה';
      default: return status;
    }
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString('he-IL')} ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-4">
        {allHistory.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-200 border-dashed"
          >
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-300 mb-4">
              <HistoryIcon size={32} />
            </div>
            <h3 className="text-lg font-medium text-slate-600 mb-2">אין היסטוריה עדיין</h3>
            <p className="text-sm text-slate-400 max-w-[200px]">
              משימות שתשלחו או שתקבלו יופיעו כאן.
            </p>
          </motion.div>
        ) : (
          allHistory.map((mission, index) => {
            const isSentByMe = mission.sender === currentUser?.id;
            
            return (
              <motion.div 
                key={mission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex w-full ${isSentByMe ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`w-[90%] md:w-[85%] bg-white border ${isSentByMe ? 'border-[#FF6B6B]/20 shadow-[#FF6B6B]/5 rounded-2xl rounded-tr-sm' : 'border-slate-200 rounded-2xl rounded-tl-sm'} p-4 shadow-sm relative`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                      {getStatusIcon(mission.status)}
                      <span className="text-xs font-bold text-slate-600">
                        {isSentByMe ? 'נשלח: ' : 'התקבל: '}
                        {getStatusText(mission.status)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatDateTime(mission.createdAt)}
                    </span>
                  </div>
                  
                  <h3 className="font-serif italic text-lg mb-1 flex items-center gap-2 text-slate-800">
                    {mission.title}
                    {mission.tier && <span className="text-yellow-500 text-xs">{'⭐'.repeat(mission.tier)}</span>}
                  </h3>
                  
                  <p className="text-sm text-slate-600 mb-3 leading-relaxed whitespace-pre-wrap break-words">
                    {renderTextWithLinks(mission.fullText || mission.shortText)}
                  </p>

                  {/* Sent Mission details */}
                  {isSentByMe && mission.response && (
                    <div className="bg-[#FF6B6B]/5 rounded-xl p-3 mt-3 border border-[#FF6B6B]/10 relative">
                      <div className="absolute -top-3 -right-2 bg-white rounded-full p-1 shadow-sm border border-[#FF6B6B]/20">
                        <MessageSquareHeart size={14} className="text-[#FF6B6B]" />
                      </div>
                      <p className="text-xs font-bold text-[#FF6B6B] mb-1">תגובה מ{partner?.name || 'הפרטנר'}:</p>
                      <p className="text-sm text-slate-700 italic">"{mission.response}"</p>
                    </div>
                  )}

                  {/* Received Mission details */}
                  {!isSentByMe && mission.pointsValue ? (
                    <p className="text-xs text-[#FF6B6B] font-mono font-medium mb-2">+{mission.pointsValue} נקודות</p>
                  ) : null}
                  
                  {!isSentByMe && mission.status === 'rejected' && mission.isMandatory && mission.mandatoryPenalty && (
                    <p className="text-xs text-red-500 font-mono mb-2">-{mission.mandatoryPenalty} נקודות (קנס חובה)</p>
                  )}
                  
                  {!isSentByMe && mission.response && (
                    <div className="bg-slate-50 rounded-lg p-3 mt-2 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 mb-1">התגובה שלך:</p>
                      <p className="text-sm text-slate-600 italic">"{mission.response}"</p>
                    </div>
                  )}

                  {!isSentByMe && mission.imageUrl && (
                    <div className="mt-4">
                      {mission.isViewOnce && mission.isViewed ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-slate-400 italic text-sm">
                          <EyeOff size={16} />
                          התמונה נמחקה לאחר צפייה אחת.
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleViewPhoto(mission)}
                          className="w-full bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/20 border border-[#FF6B6B]/20 text-[#FF6B6B] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <Eye size={18} /> צפה בתמונה {mission.isViewOnce && '(חד-פעמית)'}
                        </button>
                      )}
                    </div>
                  )}
                  
                  {!isSentByMe && mission.status === 'completed' && (
                    <button
                      onClick={async () => {
                        if (navigator.vibrate) navigator.vibrate(50);
                        playSound('click');
                        await revertMissionCompletion(mission.id, mission.pointsValue || 0);
                        toast.success('ביצוע המשימה בוטל, היא חזרה להתראות');
                      }}
                      className="mt-4 w-full bg-slate-50 hover:bg-slate-100 text-slate-500 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-slate-200"
                    >
                      <Undo2 size={16} /> בטל ביצוע משימה (יוריד נקודות)
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Photo Viewer Modal */}
      <AnimatePresence>
        {viewingPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
            onClick={() => setViewingPhoto(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full aspect-[3/4] md:aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <img 
                src={viewingPhoto.imageUrl} 
                alt="Mission Photo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
              
              <div className="absolute top-0 left-0 w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-serif italic text-white">{viewingPhoto.title}</h2>
                  <p className="text-sm text-white/60">מאת {viewingPhoto.sender === 'boaz' ? 'התנתקות' : 'התחברות'}</p>
                </div>
                <button 
                  onClick={() => setViewingPhoto(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {viewingPhoto.isViewOnce && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/80 backdrop-blur-sm rounded-full text-white text-xs font-medium flex items-center gap-2">
                  <EyeOff size={14} /> צפייה חד-פעמית - התמונה תימחק בסגירה
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
