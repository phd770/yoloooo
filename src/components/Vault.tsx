import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, Image as ImageIcon, Video, Plus, X, Trash2, ShieldCheck, Play } from 'lucide-react';
import { toast } from 'sonner';
import { addMediaToVault, getVaultMedia, deleteVaultMedia, getMediaBlobUrl } from '../lib/vaultStore';

type AuthStep = 'locked' | 'step1' | 'step2' | 'unlocked';

export function Vault() {
  const [authStep, setAuthStep] = useState<AuthStep>('step1');
  const [pin, setPin] = useState('');
  const [media, setMedia] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingMediaId, setViewingMediaId] = useState<string | null>(null);
  const [viewingBlobUrl, setViewingBlobUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus effect isn't strictly necessary for custom keypad, but good to have
  useEffect(() => {
    if (authStep === 'unlocked') {
      loadMedia();
    }
  }, [authStep]);

  const loadMedia = async () => {
    try {
      const items = await getVaultMedia();
      setMedia(items);
    } catch (e: any) {
      console.error("loadMedia error:", e);
      toast.error('שגיאה בטעינת הקבצים: ' + (e?.message || 'לא ידוע'));
    }
  };

  const handlePinInput = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDeletePin = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const verifyPin = (currentPin: string) => {
    setTimeout(() => {
      if (authStep === 'step1') {
        if (currentPin === '0510') {
          setPin('');
          setAuthStep('step2');
        } else {
          setPin('');
          toast.error('קוד שגוי');
        }
      } else if (authStep === 'step2') {
        if (currentPin === '1004') {
          setPin('');
          setAuthStep('unlocked');
          toast.success('הכספת נפתחה בהצלחה');
        } else {
          setPin('');
          setAuthStep('step1'); // Reset completely on fail
          toast.error('קוד שגוי, מתחיל מחדש');
        }
      }
    }, 200);
  };

  const lockVault = () => {
    setAuthStep('step1');
    setPin('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isOffline = false;
    if (isOffline) {
      // 1MB offline to prevent localStorage quota crash
      if (file.size > 1 * 1024 * 1024) {
        toast.error(`הקובץ גדול מדי במצב לא מקוון. הגבלת התוכן היא 1MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);
    const toastId = toast.loading('מעלה קובץ לכספת, ייתכן שזה ייקח כמה רגעים עבור סרטונים...');

    try {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      
      // For video thumbnails, we'd theoretically need a complex process, 
      // but for simplicity we rely on the object URL when rendering, or a generic icon
      await addMediaToVault(type, file.name, file);
      
      await loadMedia();
      toast.success('הקובץ נשמר בהצלחה בכספת הסודית', { id: toastId });
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'storage/unauthorized') {
        toast.error('יש לשנות את ההרשאות ב-Firebase Storage (rules)', { id: toastId, duration: 8000 });
      } else {
        toast.error('שגיאה: ' + (error?.message || 'לא ידועה'), { id: toastId, duration: 8000 });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('האם אתה בטוח שברצונך למחוק קובץ זה לצמיתות?')) {
      await deleteVaultMedia(id);
      await loadMedia();
      toast.success('הקובץ נמחק');
    }
  };

  const handleViewMedia = async (id: string) => {
    const url = await getMediaBlobUrl(id);
    if (url) {
      setViewingMediaId(id);
      setViewingBlobUrl(url);
    }
  };

  const closeViewer = () => {
    setViewingMediaId(null);
    setViewingBlobUrl(null);
  };

  // --- RENDERING ---

  if (authStep !== 'unlocked') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto h-[calc(100vh-80px)] bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200 rounded-3xl p-8 w-full shadow-sm flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
            {authStep === 'step1' ? <Lock size={32} className="text-slate-400" /> : <ShieldCheck size={32} className="text-[#FF6B6B]" />}
          </div>
          
          <h2 className="text-xl font-bold mb-2 text-slate-800">
            {authStep === 'step1' ? 'אימות שלב 1' : 'אימות שלב 2'}
          </h2>
          <p className="text-sm text-slate-500 mb-8 text-center">
            {authStep === 'step1' ? 'הזן את הקוד הראשוני לכספת' : 'הזן את קוד האבטחה הסופי'}
          </p>

          <div className="flex gap-4 mb-8">
            {[0, 1, 2, 3].map(i => (
              <div 
                key={i}
                className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? 'bg-[#FF6B6B]' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handlePinInput(num.toString())}
                className="h-16 rounded-2xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors text-2xl font-semibold text-slate-800"
              >
                {num}
              </button>
            ))}
            <div className="h-16"></div>
            <button
              onClick={() => handlePinInput('0')}
              className="h-16 rounded-2xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors text-2xl font-semibold text-slate-800"
            >
              0
            </button>
            <button
              onClick={handleDeletePin}
              className="h-16 rounded-2xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-center text-slate-500"
            >
              <X size={24} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden w-full max-w-md mx-auto relative bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B6B]/20 to-purple-400/20 flex items-center justify-center text-[#FF6B6B] shadow-sm">
            <Unlock size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">הכספת הסודית</h2>
            <p className="text-xs text-slate-500">{media.length} קבצים נשמרו בענן</p>
          </div>
        </div>
        <button 
          onClick={lockVault}
          className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <Lock size={20} />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar pb-[100px]">
        {media.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <ShieldCheck size={48} className="mb-4 opacity-50 text-slate-300" />
            <p>הכספת ריקה.</p>
            <p className="text-sm mt-2 max-w-[200px] text-center">
              העלה תמונות וסרטונים שנשמרים באופן פרטי ומשותפים לשניכם.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {media.map((item) => (
              <div 
                key={item.id} 
                onClick={() => handleViewMedia(item.id)}
                className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group cursor-pointer shadow-sm"
              >
                {item.type === 'image' && item.url ? (
                  <img src={item.url} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="" loading="lazy" />
                ) : item.type === 'video' && item.url ? (
                  <div className="absolute inset-0 w-full h-full">
                    <video src={item.url} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" muted preload="metadata" playsInline />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Play size={24} className="text-white drop-shadow-md" fill="currentColor" />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 group-hover:text-slate-500 transition-colors bg-slate-200">
                    {item.type === 'video' ? <Video size={32} /> : <ImageIcon size={32} />}
                  </div>
                )}
                
                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex justify-between items-end">
                  <span className="text-[10px] font-mono truncate px-1 text-white">
                    {new Date(item.createdAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
                
                <button 
                  onClick={(e) => handleDelete(item.id, e)}
                  className="absolute top-2 right-2 p-1.5 bg-white/80 text-slate-500 hover:text-red-500 hover:bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10 backdrop-blur-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-20 right-6 z-20">
        <label className="flex items-center justify-center w-14 h-14 bg-[#FF6B6B] text-white rounded-full shadow-lg shadow-[#FF6B6B]/20 cursor-pointer hover:scale-105 active:scale-95 transition-transform">
          <Plus size={24} className={isUploading ? 'animate-spin' : ''} />
          <input 
            type="file" 
            accept="image/*,video/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Fullscreen Media Viewer */}
      <AnimatePresence>
        {viewingMediaId && viewingBlobUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black flex flex-col"
          >
            <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10">
              <button onClick={closeViewer} className="p-2 bg-black/50 rounded-full text-white/80 hover:text-white">
                <X size={24} />
              </button>
              <button 
                onClick={(e) => {
                  handleDelete(viewingMediaId, e as any);
                  closeViewer();
                }} 
                className="p-2 bg-black/50 rounded-full text-white/80 hover:text-red-400"
              >
                <Trash2 size={24} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden">
              {media.find(m => m.id === viewingMediaId)?.type === 'video' ? (
                <video src={viewingBlobUrl} controls autoPlay className="max-w-full max-h-full" />
              ) : (
                <img src={viewingBlobUrl} alt="Vault Media" className="max-w-full max-h-full object-contain" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
