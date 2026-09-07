import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Clock, Send, Image as ImageIcon, X, Trash2, Shield, EyeOff, Eye, Flame, Camera, Check, CheckCheck, HelpCircle, Reply, FolderLock, Baby , Edit2, MapPin, Mic, Square, Smile, ChevronRight, Video, Phone, Info, Gamepad2, BellRing } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { playSound } from '../lib/sounds';
import { PrivacyMode, ChatMessage } from '../lib/types';
import { compressImage } from '../lib/utils';
import { addMediaToVault, addUrlToVault } from '../lib/vaultStore';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { renderTextWithLinks } from '../lib/linkify';

export function DiscreteChat({ onBack, onNavigate }: { onBack?: () => void; onNavigate?: (tab: any) => void }) {
  const { 
    currentUser, 
    partner, 
    chatSession, 
    chatMessages, 
    editMessage,
    sendMessage,
    reactToMessage, 
    panicDeleteChat, 
    softDeleteChat, 
    restoreChat,
    updatePrivacyMode,
    updateAutoExpire,
    markMessageAsViewed,
    markMessagesAsViewed,
    setTypingStatus
  } = useApp();

  const [text, setText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [viewDuration, setViewDuration] = useState<number>(5);
  const [showDurationSelector, setShowDurationSelector] = useState(false);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);

  const [viewingMessageId, setViewingMessageId] = useState<string | null>(null);

  const lastNewestMessageIdRef = useRef<string | null>(null);
  const hasInitialScrolledRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);



  const [myTurnGames, setMyTurnGames] = useState<{id: string, name: string}[]>([]);
  useEffect(() => {
    const gameId = currentUser?.id && partner?.id ? [currentUser.id, partner.id].sort().join("_") : null;
    if (!gameId || !currentUser) return;

    const gamesList = [
      { id: `tictactoe_${gameId}`, name: 'איקס עיגול' },
      { id: `connect4_${gameId}`, name: 'ארבע בשורה' },
      { id: `dotsandboxes_${gameId}`, name: 'קווים וריבועים' },
      { id: `backgammon_${gameId}`, name: 'שש בש' }
    ];

    const unsubs = gamesList.map(g => 
      onSnapshot(doc(db, "games", g.id), (snap) => {
        const data = snap.data();
        let isMyTurn = false;
        if (data) {
          if (g.name === 'ארבע בשורה') {
            const myColor = data?.players?.R === currentUser.id ? "R" : data?.players?.Y === currentUser.id ? "Y" : null;
            isMyTurn = data.status === 'active' && data.currentTurn === myColor;
          } else {
            isMyTurn = (data.status === 'playing' || data.status === 'active') && data.turn === currentUser.id;
          }
        }
        setMyTurnGames(prev => {
          const others = prev.filter(p => p.name !== g.name);
          if (isMyTurn) return [...others, g];
          return others;
        });
      }, () => {})
    );
    return () => unsubs.forEach(u => u());
  }, [currentUser, partner]);

  const lastScrollTopRef = useRef(0);
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    
    const currentScroll = el.scrollTop;
    const prevScroll = lastScrollTopRef.current;
    const scrollingDown = currentScroll > prevScroll;
    lastScrollTopRef.current = currentScroll;
    
    const distanceToBottom = el.scrollHeight - currentScroll - el.clientHeight;
    const atBottom = distanceToBottom < 120;
    
    isAtBottomRef.current = atBottom;
    
    // Use scrolling direction for menu visibility (isAtBottom state)
    if (scrollingDown || atBottom) {
      setIsAtBottom(true);
    } else if (currentScroll < prevScroll - 10) {
      setIsAtBottom(false);
    }
  };
  
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom } }));
    return () => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom: true } }));
  }, [isAtBottom]);

  // Initial scroll and new message handling
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el || chatMessages.length === 0) return;

    const newestMessage = chatMessages[0];
    const isInitial = !hasInitialScrolledRef.current;

    if (isInitial) {
      hasInitialScrolledRef.current = true;
      lastNewestMessageIdRef.current = newestMessage?.id || null;
      el.scrollTop = el.scrollHeight;
      return;
    }

    if (newestMessage && newestMessage.id !== lastNewestMessageIdRef.current) {
      lastNewestMessageIdRef.current = newestMessage.id;
      const isMyMessage = newestMessage.senderId === currentUser?.id;

      if (isMyMessage || isAtBottomRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [chatMessages, currentUser?.id]);

  // Handle container resizing (e.g. keyboard open/close) smoothly without jumping
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    let prevHeight = el.clientHeight;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        if (newHeight !== prevHeight) {
          if (isAtBottomRef.current) {
            el.scrollTop = el.scrollHeight;
          }
          prevHeight = newHeight;
        }
      }
    });

    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const unreadIds: string[] = [];
    chatMessages.forEach(msg => {
      if (msg.receiverId === currentUser?.id && !msg.viewedAt && !msg.isViewOnce) {
        unreadIds.push(msg.id);
      }
    });
    if (unreadIds.length > 0) {
      markMessagesAsViewed(unreadIds);
    }
  }, [chatMessages, currentUser?.id]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    if (el) {
      el.style.height = '44px';
      if (el.scrollHeight > 44) {
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      }
    }

    const now = Date.now();
    if (now - lastTypingUpdateRef.current > 2000) {
      lastTypingUpdateRef.current = now;
      setTypingStatus(true);
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      lastTypingUpdateRef.current = 0;
      setTypingStatus(false);
    }, 2500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = async (e: React.FormEvent | React.KeyboardEvent) => {
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
      if (ta) ta.style.height = '44px';
      playSound('send');
    } finally {
      setIsSending(false);
    }
  };

  const handlePing = async () => {
    if (isSending || isUploading || !partner) return;

    setIsSending(true);
    try {
      await sendMessage(`🔔 ${currentUser?.name || 'השותף/ה'} קורא/ת לך`, undefined, undefined, false, undefined, undefined, undefined, true);
      toast.success(`התראה נשלחה ל${partner.name}`);
      playSound('send');
    } catch (error) {
      console.error('Ping failed:', error);
      toast.error('לא הצלחנו לשלוח התראה');
    } finally {
      setIsSending(false);
    }
  };



  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsUploading(true);
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            await sendMessage(undefined, undefined, undefined, false, undefined, undefined, undefined, false, base64data);
            toast.success('הודעה קולית נשלחה');
            setIsUploading(false);
          };
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          console.error("Audio conversion failed", err);
          toast.error('שגיאה בשליחת הודעה קולית');
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      playSound('click');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error('אין גישה למיקרופון');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      playSound('send');
    }
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('שירותי מיקום אינם נתמכים בדפדפן זה');
      return;
    }
    
    setIsUploading(true);
    toast.loading('מאתר מיקום...', { id: 'location-toast' });
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        await sendMessage(undefined, undefined, undefined, false, undefined, undefined, undefined, false, undefined, { lat: latitude, lng: longitude });
        toast.success('מיקום נשלח!', { id: 'location-toast' });
      } catch (err) {
        toast.error('שגיאה בשליחת מיקום', { id: 'location-toast' });
      } finally {
        setIsUploading(false);
      }
    }, (err) => {
      toast.error('שגיאה בקבלת מיקום: יש לאשר הרשאת מיקום', { id: 'location-toast' });
      setIsUploading(false);
    }, { timeout: 10000 });
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const isOffline = false;

        if (file.type.startsWith('video/')) {
          if (isOffline) {
            if (file.size > 700 * 1024) {
              toast.error('הוידאו גדול מדי למצב אופליין (מקסימום 700KB)');
              setIsUploading(false);
              return;
            }
            const reader = new FileReader();
            reader.onload = (event) => setVideoUrl(event.target?.result as string);
            reader.readAsDataURL(file);
          } else {
            if (file.size > 50 * 1024 * 1024) {
               toast.error('הוידאו גדול מדי (מקסימום 50MB)');
               setIsUploading(false);
               return;
            }
            const storagePath = `chat-media/${crypto.randomUUID()}-${file.name}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const uploadUrl = await getDownloadURL(storageRef);
            setVideoUrl(uploadUrl);
          }
        } else {
          const compressedBase64 = await compressImage(file, 800, 0.7);
          if (isOffline) {
            setImageUrl(compressedBase64);
          } else {
            const arr = compressedBase64.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while(n--) { u8arr[n] = bstr.charCodeAt(n); }
            const blob = new Blob([u8arr], {type: mime});
            
            const storagePath = `chat-media/${crypto.randomUUID()}-image.jpg`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, blob);
            const uploadUrl = await getDownloadURL(storageRef);
            setImageUrl(uploadUrl);
          }
        }
      } catch (error) {
        toast.error('שגיאה בהעלאת המדיה');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handlePanicDelete = (forBoth: boolean) => {
    const msg = forBoth 
      ? 'אזהרה: פעולה זו תמחק את כל השיחה לצמיתות לשני הצדדים. האם אתה בטוח?'
      : 'השיחה תימחק רק עבורך. האם אתה בטוח?';
      
    if (window.confirm(msg)) {
      panicDeleteChat(forBoth);
      toast.success(forBoth ? 'השיחה נמחקה לצמיתות' : 'השיחה נמחקה עבורך');
      playSound('error');
      setShowDeleteOptions(false);
    }
  };

  const handleSoftDelete = () => {
    if (confirm("האם להסתיר את כל היסטוריית השיחה שלך?")) {
      softDeleteChat();
      toast.success('השיחה הוסתרה.');
      playSound('click');
    }
  };

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardOpen(true);

      }
    };
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          if (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
            setIsKeyboardOpen(false);
          }
        }, 50);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handleSaveToVault = async (url: string, type: 'image' | 'video') => {
    try {
      toast.loading('שומר בכספת...', { id: 'save-vault' });
      
      let ext = type === 'image' ? 'jpg' : 'mp4';
      
      if (url.startsWith('data:')) {
         let blob: Blob;
         const arr = url.split(',');
         const mimeMatch = arr[0].match(/:(.*?);/);
         const mime = mimeMatch ? mimeMatch[1] : (type === 'image' ? 'image/jpeg' : 'video/mp4');
         const bstr = atob(arr[1]);
         let n = bstr.length;
         const u8arr = new Uint8Array(n);
         while(n--){
           u8arr[n] = bstr.charCodeAt(n);
         }
         blob = new Blob([u8arr], {type:mime});
         ext = mime.split('/')[1] || ext;
         await addMediaToVault(type, `chat-media-${Date.now()}.${ext}`, blob);
      } else {
         const urlExt = url.split('.').pop()?.split('?')[0];
         if (urlExt && urlExt.length < 10) {
           ext = urlExt;
         }
         await addUrlToVault(type, `chat-media-${Date.now()}.${ext}`, url);
      }
      toast.success('נשמר בכספת בהצלחה! 🔒', { id: 'save-vault' });
      playSound('success');
    } catch (err) {
      console.error("Error saving to vault:", err);
      toast.error('שגיאה בשמירת הקובץ בכספת', { id: 'save-vault' });
    }
  };

  if (!currentUser || !partner) return null;

  const isPartnerTyping = !!(chatSession?.typingUsers?.[partner.id] && (Date.now() - chatSession.typingUsers[partner.id] < 3000));
  
  const isOnline = partner.isOnline && partner.lastSeen && (Date.now() - partner.lastSeen < 120000);
  const formattedLastSeen = partner.lastSeen 
    ? new Date(partner.lastSeen).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex flex-col h-full w-full bg-slate-50 relative overflow-x-hidden pb-0`}>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto relative overflow-hidden bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#dbdbdb] bg-white z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button 
                onClick={onBack} 
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-800 font-bold text-xs shadow-xs cursor-pointer shrink-0"
                title="חזרה לבית"
              >
                <ChevronRight size={18} strokeWidth={2.5} />
                <span>בית</span>
              </button>
            )}
            {onNavigate && (
              <button 
                onClick={() => onNavigate('games')} 
                className="flex items-center gap-1 py-1.5 px-2 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-800 font-bold text-xs shadow-xs cursor-pointer shrink-0"
                title="משחקים"
              >
                <Gamepad2 size={16} strokeWidth={2} />
                <span>משחקים</span>
              </button>
            )}
            <div className="flex items-center gap-2 cursor-pointer min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm relative shrink-0">
                {partner.name[0]}
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-[#4a5568] leading-tight text-sm truncate">{partner.name}</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  {chatSession?.privacyMode === 'super_discreet' && <Shield size={10} className="text-[#3797f0] shrink-0" />}
                  <span className="text-[10px] text-[#a0aec0] leading-none whitespace-nowrap">
                    {chatSession?.privacyMode === 'super_discreet' ? 'סופר דיסקרטי' : chatSession?.privacyMode === 'discreet' ? 'דיסקרטי' : 'רגיל'}
                  </span>
                  <span className="text-[#cbd5e1] text-[10px] leading-none">•</span>
                  {isOnline ? (
                     <span className="text-[10px] text-green-500 font-medium leading-none whitespace-nowrap">מחובר/ת</span>
                  ) : partner.lastSeen ? (
                     <span className="text-[10px] text-[#a0aec0] leading-none whitespace-nowrap">ב-{formattedLastSeen}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-black px-2">
            <button className="hover:opacity-60 transition-opacity">
              <Phone size={24} strokeWidth={1.5} />
            </button>
            <button className="hover:opacity-60 transition-opacity">
              <Video size={24} strokeWidth={1.5} />
            </button>
            <div className="relative">
              <button onClick={() => setShowSettings(!showSettings)} className="hover:opacity-60 transition-opacity">
                <Info size={24} strokeWidth={1.5} />
              </button>
              
              {showSettings && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-[#dbdbdb] rounded-xl shadow-lg overflow-hidden w-48 z-50">
                  <div onClick={handleSoftDelete} className="px-4 py-3 text-sm text-black hover:bg-gray-50 cursor-pointer text-right flex items-center justify-between">
                    <span>הסתר צ'אט</span>
                    <EyeOff size={16} />
                  </div>
                  <div onClick={() => handlePanicDelete(false)} className="px-4 py-3 text-sm text-red-500 hover:bg-red-50 cursor-pointer text-right border-t border-[#dbdbdb]">מחק עבורי</div>
                  <div onClick={() => handlePanicDelete(true)} className="px-4 py-3 text-sm text-red-500 hover:bg-red-50 cursor-pointer text-right border-t border-[#dbdbdb]">מחק לכולם</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#f8fafc] border-b border-[#e2e8f0] overflow-hidden"
            >
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs text-[#718096] mb-2">מחיקה אוטומטית (Auto Expire)</label>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    {[
                      { label: 'כבוי', value: undefined },
                      { label: 'שעה', value: 60 * 60 * 1000 },
                      { label: '24 שעות', value: 24 * 60 * 60 * 1000 },
                      { label: 'שבוע', value: 7 * 24 * 60 * 60 * 1000 },
                    ].map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => updateAutoExpire(opt.value)}
                        className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                          chatSession?.autoExpireTimer === opt.value 
                            ? 'bg-[#3797f0] text-white' 
                            : 'bg-white border border-[#e2e8f0] text-[#718096] hover:bg-[#f1f5f9]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-[#718096]">רמת דיסקרטיות</label>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { id: 'normal', label: 'רגיל', icon: Eye },
                      { id: 'discreet', label: 'דיסקרטי', icon: EyeOff },
                      { id: 'super_discreet', label: 'סופר דיסקרטי', icon: ShieldAlert },
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => updatePrivacyMode(mode.id as PrivacyMode)}
                        className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-xs transition-colors border ${
                          chatSession?.privacyMode === mode.id
                            ? 'bg-[#ffe4e4] border-[#3797f0] text-[#3797f0]'
                            : 'bg-white border-[#e2e8f0] text-[#718096] hover:bg-[#f1f5f9]'
                        }`}
                      >
                        <mode.icon size={16} />
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Background */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}></div>
        {/* Messages */}
        <div 
          ref={chatContainerRef}
          id="chat-scroll-container" 
          onScroll={handleScroll}
          style={{ overflowAnchor: 'none' }}
          className="touch-pan-y flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 flex flex-col items-stretch bg-transparent overscroll-contain relative z-10"
        >
          {!!(chatSession?.deletedAtByUser?.[currentUser?.id || ''] || chatSession?.isDeleted) && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <ShieldAlert size={48} className="text-[#cbd5e1]" />
              <div className="flex flex-col items-center">
                <h2 className="text-lg font-bold text-[#4a5568] mb-1">השיחה הוסתרה</h2>
                <p className="text-[#a0aec0] text-xs mb-4">תוכן השיחה הקודם הוסתר.</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      playSound('click');
                      await restoreChat();
                      toast.success('השיחה שוחזרה בהצלחה!');
                    } catch (e) {
                      toast.error('שגיאה בשחזור השיחה');
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#3797f0] hover:bg-[#ff5252] text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  שחזר שיחה דיסקרטית 🔄
                </button>
              </div>
            </div>
          )}
          
          {[...chatMessages].reverse().map((msg) => {
            const isMe = currentUser ? msg.senderId === currentUser.id : false;
            const isFresh = Math.abs(Date.now() - msg.createdAt) < 60000; // 60 seconds grace period for clock-skew/fresh messages
            const isUnreadToMe = msg.receiverId === currentUser?.id && !msg.viewedAt;

            const myDeletedAt = chatSession?.deletedAtByUser?.[currentUser?.id || ''] || (chatSession?.isDeleted && chatSession?.deletedAt ? chatSession.deletedAt : 0);

            if (myDeletedAt && msg.createdAt <= myDeletedAt && !isFresh && !isUnreadToMe) {
              return null;
            }

            const isExpired = !!(msg.expiresAt && Date.now() > msg.expiresAt);
            if (isExpired) return null;
            if (msg.isPing) return null;

            return (
              <motion.div 
                key={msg.id}
                id={`msg-${msg.id}`}
                initial={isFresh ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} transition-colors duration-500`}
              >
                <div className="group relative flex items-center gap-2 max-w-[85%]">
                  {!isMe && (
                    <>
                    <button onClick={() => setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 sm:p-3 -mx-2 text-[#a0aec0] hover:text-yellow-500 active:bg-gray-100 rounded-full transition-all" title="הגב באימוג'י">
                      <Smile size={16} />
                    </button>
                    <button onClick={() => setReplyingTo(msg)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 sm:p-3 -mx-2 text-[#a0aec0] hover:text-[#3797f0] active:bg-gray-100 rounded-full transition-all">
                      <Reply size={16} />
                    </button>
                    </>
                  )}
                  
                  
                  {/* Emojis selector popup */}
                  <AnimatePresence>
                    {activeMessageMenu === msg.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className={`absolute z-50 ${isMe ? 'right-0' : 'left-0'} -top-12 bg-white shadow-lg border border-slate-200 rounded-full py-1.5 px-2 flex gap-1`}
                      >
                        {['❤️', '😂', '😮', '😢', '🔥', '👍'].map(emoji => (
                          <button 
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              reactToMessage(msg.id, emoji);
                              setActiveMessageMenu(null);
                            }}
                            className="text-xl hover:scale-125 transition-transform active:scale-95 px-1"
                          >
                            {emoji}
                          </button>
                        ))}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); }}
                          className="text-slate-400 hover:text-slate-600 px-1 ml-1"
                        >
                          <X size={16} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div 
                    onDoubleClick={(e) => { e.stopPropagation(); reactToMessage(msg.id, '❤️'); }}
                    className={`rounded-3xl px-4 py-2.5 flex flex-col relative max-w-full ${
                    isMe 
                      ? 'bg-[#3797f0] text-white' 
                      : 'bg-[#efefef] text-black'
                  }`}>
                    
                    {msg.replyToId && (
                      <div 
                        className={`text-xs p-2 rounded-lg mb-2 border-r-4 cursor-pointer hover:opacity-80 transition-opacity ${isMe ? 'bg-black/10 border-white/40' : 'bg-[#f1f5f9] border-[#3797f0]'}`}
                        onClick={() => {
                          const el = document.getElementById(`msg-${msg.replyToId}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('bg-black/5');
                            setTimeout(() => el.classList.remove('bg-black/5'), 1500);
                          }
                        }}
                      >
                        <span className="opacity-80 block line-clamp-3">{msg.replyToText || 'הודעה'}</span>
                      </div>
                    )}

                    {msg.isViewOnce && !isMe && !msg.viewedAt && viewingMessageId !== msg.id ? (
                      <button 
                        onClick={() => {
                          setViewingMessageId(msg.id);
                          setTimeout(() => {
                            markMessageAsViewed(msg.id);
                            setViewingMessageId(null);
                          }, (msg.viewDuration || 5) * 1000);
                        }}
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <Flame size={16} className={`${isMe ? 'text-white' : 'text-[#3797f0]'} animate-pulse`} />
                        לחץ לצפייה ({msg.viewDuration || 5}s)
                      </button>
                    ) : (
                      <div className="space-y-1">
                        {msg.imageUrl && (
                          <div className="relative group">
                            <img 
                              src={msg.imageUrl} 
                              alt="Media" 
                              className="rounded-xl max-w-[240px] h-auto mb-2 min-h-[100px] object-cover bg-slate-100" 
                              onLoad={() => {
                                const chatContainer = chatContainerRef.current;
                                if (chatContainer && isAtBottomRef.current) {
                                  chatContainer.scrollTop = chatContainer.scrollHeight;
                                }
                              }}
                            />
                            {msg.isViewOnce && viewingMessageId === msg.id && (
                              <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1">
                                <Flame size={12} className="text-orange-500" /> מתכלה...
                              </div>
                            )}
                            {!msg.isViewOnce && (
                              <button
                                onClick={() => handleSaveToVault(msg.imageUrl!, 'image')}
                                className="absolute bottom-4 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-all z-10 shadow-sm"
                                title="שמור בכספת"
                              >
                                <FolderLock size={16} />
                              </button>
                            )}
                          </div>
                        )}
                        {msg.audioUrl && (
                          <div className={`relative group mb-2 p-2 rounded-xl ${isMe ? 'bg-white/20' : 'bg-[#f1f5f9]'} max-w-[240px] flex items-center gap-2`}>
                            <audio 
                              src={msg.audioUrl} 
                              controls 
                              className="h-[40px] max-w-[200px]" 
                              onPlay={() => {
                                // optional: pause others
                              }}
                            />
                          </div>
                        )}
                        {msg.location && (
                          <div className="relative group mb-2 overflow-hidden rounded-xl bg-blue-50 border border-blue-100 max-w-[240px]">
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${msg.location.lat},${msg.location.lng}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block p-3 hover:bg-blue-100 transition-colors"
                            >
                              <div className="flex items-center gap-2 text-blue-600 font-bold mb-1">
                                <MapPin size={18} className="shrink-0" />
                                <span>מיקום שותף</span>
                              </div>
                              <div className="w-full h-[100px] bg-slate-200 rounded-lg relative overflow-hidden">
                                <img 
                                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${msg.location.lat},${msg.location.lng}&zoom=15&size=400x200&markers=color:red%7Clabel:%7C${msg.location.lat},${msg.location.lng}&key=`} 
                                  alt="Map"
                                  className="w-full h-full object-cover opacity-60"
                                  onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-slate-700 shadow-sm">פתח בגוגל מפות</span>
                                </div>
                              </div>
                            </a>
                          </div>
                        )}
                        {msg.videoUrl && (
                          <div className="relative group">
                            <video 
                              src={msg.videoUrl} 
                              controls 
                              playsInline 
                              className="rounded-xl max-w-[240px] h-auto mb-2 min-h-[100px] bg-slate-100" 
                              onLoadedData={() => {
                                const chatContainer = document.getElementById('chat-scroll-container');
                                if (chatContainer && chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 250) {
                                  chatContainer.scrollTop = chatContainer.scrollHeight;
                                }
                              }}
                            />
                            {msg.isViewOnce && viewingMessageId === msg.id && (
                              <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1">
                                <Flame size={12} className="text-orange-500" /> מתכלה...
                              </div>
                            )}
                            {!msg.isViewOnce && (
                              <button
                                onClick={() => handleSaveToVault(msg.videoUrl!, 'video')}
                                className="absolute bottom-4 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-all z-10 shadow-sm"
                                title="שמור בכספת"
                              >
                                <FolderLock size={16} />
                              </button>
                            )}
                          </div>
                        )}
                        {msg.text && (
                          <p className={`text-[15px] whitespace-pre-wrap break-words ${msg.isViewOnce ? 'italic opacity-70' : ''}`}>
                            {renderTextWithLinks(msg.text)}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className={`text-[10px] mt-1 flex items-center gap-1 self-end ${isMe ? 'text-white/70' : 'text-[#a0aec0]'}`}>
                      {msg.editedAt ? "(נערך) " : ""}{formatTime(msg.createdAt)}
                      {!!msg.isViewOnce && <Flame size={10} />}
                      {!!msg.expiresAt && <Clock size={10} />}
                      {isMe && (
                        <span className="ml-1">
                          {msg.viewedAt ? <CheckCheck size={14} className="text-white" /> : <Check size={14} />}
                        </span>
                      )}
                    </div>
                    {/* Render active reactions */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`absolute -bottom-3 ${isMe ? 'left-2' : 'right-2'} flex items-center gap-0.5 z-10`}>
                        {Object.entries(
                          Object.entries(msg.reactions).reduce((acc: Record<string, number>, [, emoji]) => {
                            const emojiStr = String(emoji);
                            acc[emojiStr] = (acc[emojiStr] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <div 
                            key={emoji} 
                            className="bg-white text-xs border border-slate-200 shadow-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5 cursor-pointer hover:bg-slate-50 transition-colors text-slate-800"
                            onClick={(e) => {
                               e.stopPropagation();
                               reactToMessage(msg.id, emoji as string);
                            }}
                          >
                            <span>{emoji as string}</span>
                            {(count as number) > 1 && <span className="text-[10px] text-slate-500 font-bold">{count as number}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            );
          })}
          
          {isPartnerTyping && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className="bg-white border border-[#e2e8f0] text-[#718096] rounded-2xl rounded-bl-md p-3 text-xs flex items-center gap-1 shadow-sm">
                <span className="animate-bounce">.</span><span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span><span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
              </div>
            </motion.div>
          )}
        </div>

        
        {/* Scroll to bottom button */}
        {!isAtBottom && chatMessages.length > 0 && (
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

        {/* Edit Indicator */}
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
        {replyingTo && (
          <div className="bg-[#f8fafc] border-t border-[#e2e8f0] p-3 flex justify-between items-center text-sm shadow-inner">
            <div className="flex flex-col border-r-4 border-[#3797f0] pr-3 opacity-80">
              <span className="text-xs font-bold text-[#3797f0]">תגובה להודעה</span>
              <span className="line-clamp-3 text-[#4a5568]">{replyingTo.text || 'מדיה'}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-2 text-[#a0aec0] hover:text-[#4a5568]">
              <X size={20} />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-2 bg-white relative">
          {showDurationSelector && isViewOnce && (
            <div className="absolute bottom-full right-4 mb-2 bg-white border border-[#dbdbdb] rounded-xl shadow-lg flex flex-wrap gap-1 p-2 w-64 z-50">
              <div className="w-full text-xs text-[#718096] mb-1 text-center">זמן צפייה:</div>
              {[{ label: '5s', value: 5 }, { label: '10s', value: 10 }, { label: '30s', value: 30 }].map(opt => (
                <button
                  key={opt.value} type="button"
                  onClick={() => { setViewDuration(opt.value); setShowDurationSelector(false); }}
                  className={`px-3 py-1 rounded-lg text-xs ${viewDuration === opt.value ? 'bg-[#3797f0] text-white font-bold' : 'bg-[#f1f5f9] text-[#718096]'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {imageUrl && (
            <div className="mb-3 relative inline-block">
              <img src={imageUrl} alt="Preview" className="h-20 rounded-xl border border-[#dbdbdb]" />
              <button type="button" onClick={() => setImageUrl('')} className="absolute -top-2 -right-2 bg-[#3797f0] text-white rounded-full p-1 shadow-md">
                <X size={14} />
              </button>
            </div>
          )}
          {videoUrl && (
            <div className="mb-3 relative inline-block">
              <video src={videoUrl} playsInline className="h-20 rounded-xl border border-[#dbdbdb]" />
              <button type="button" onClick={() => setVideoUrl('')} className="absolute -top-2 -right-2 bg-[#3797f0] text-white rounded-full p-1 shadow-md">
                <X size={14} />
              </button>
            </div>
          )}
          

          <form onSubmit={handleSend} className="flex items-end gap-2 bg-white p-1 pb-6 md:pb-4">
            <button
              type="button"
              onClick={handlePing}
              disabled={isSending || isUploading}
              className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full text-[#f59e0b] transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="שלח התראה לשותף/ה"
              aria-label="שלח התראה לשותף/ה"
            >
              <BellRing size={21} />
            </button>
            <div className="bg-[#3797f0] text-white rounded-full cursor-pointer self-end mb-0.5 shrink-0 flex items-center justify-center relative w-10 h-10 overflow-hidden">
              <input type="file" accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={handleMediaUpload} disabled={isUploading} />
              <Camera size={22} className={`fill-current text-white relative z-10 ${isUploading ? 'animate-pulse' : ''}`} />
            </div>

            <div className="flex-1 flex items-end bg-[#efefef] rounded-3xl relative min-h-[44px]">
              <textarea
                id="chat-input-textarea"
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                className="flex-1 bg-transparent text-black px-4 py-3 focus:outline-none text-[15px] resize-none max-h-32"
                rows={1}
                dir="auto"
                style={{ minHeight: '44px' }}
              />
              <div className="flex items-center shrink-0 pb-1 pl-2">
                {!text.trim() && !imageUrl && !videoUrl ? (
                  <>
                    <button 
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
                      onPointerUp={(e) => { e.preventDefault(); stopRecording(); }}
                      onPointerLeave={(e) => { if (isRecording) stopRecording(); }}
                      className={`p-2 cursor-pointer transition-colors ${isRecording ? 'text-red-500 animate-pulse bg-red-50 rounded-full' : 'text-black'}`}
                    >
                      <Mic size={24} strokeWidth={1.5} />
                    </button>
                    <label className="p-2 text-black cursor-pointer transition-colors relative">
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} disabled={isUploading} />
                      <ImageIcon size={24} strokeWidth={1.5} />
                    </label>
                  </>
                ) : (
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="p-2 px-3 text-[#3797f0] font-bold text-[15px]"
                  >
                    Send
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
