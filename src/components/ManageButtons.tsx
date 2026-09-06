import React, { useState } from 'react';
import { useApp } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Settings, Edit2, Check, X } from 'lucide-react';
import { CustomButton } from '../lib/types';
import { toast } from 'sonner';

export function ManageButtons() {
  const { currentUser, addCustomButton, updateCustomButton, deleteCustomButton } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [label, setLabel] = useState('');
  const [actionText, setActionText] = useState('');
  const [maleActionText, setMaleActionText] = useState('');
  const [femaleActionText, setFemaleActionText] = useState('');
  const [fullText, setFullText] = useState('');
  const [maleFullText, setMaleFullText] = useState('');
  const [femaleFullText, setFemaleFullText] = useState('');
  const [points, setPoints] = useState(10);
  const [tier, setTier] = useState(1);

  const resetForm = () => {
    setLabel('');
    setActionText('');
    setMaleActionText('');
    setFemaleActionText('');
    setFullText('');
    setMaleFullText('');
    setFemaleFullText('');
    setPoints(10);
    setTier(1);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !actionText) return;
    
    try {
      await addCustomButton({
        label,
        actionText,
        maleActionText,
        femaleActionText,
        fullText,
        maleFullText,
        femaleFullText,
        pointsValue: points,
        tier
      });
      toast.success('הכפתור נוסף בהצלחה!');
      resetForm();
    } catch (error) {
      toast.error('שגיאה בהוספת הכפתור');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !label || !actionText) return;

    try {
      await updateCustomButton({
        id: editingId,
        label,
        actionText,
        maleActionText,
        femaleActionText,
        fullText,
        maleFullText,
        femaleFullText,
        pointsValue: points,
        tier
      });
      toast.success('הכפתור עודכן בהצלחה!');
      resetForm();
    } catch (error) {
      toast.error('שגיאה בעדכון הכפתור');
    }
  };

  const handleDelete = async (btn: CustomButton) => {
    try {
      await deleteCustomButton(btn);
      toast.success('הכפתור נמחק');
    } catch (error) {
      toast.error('שגיאה במחיקת הכפתור');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!currentUser?.buttons) return;
    const newButtons = [...currentUser.buttons];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newButtons.length) return;
    
    [newButtons[index], newButtons[targetIndex]] = [newButtons[targetIndex], newButtons[index]];
    
    try {
      const { db } = await import('../firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', currentUser.id), {
        buttons: newButtons
      });
      toast.success('הסדר עודכן');
    } catch (error) {
      toast.error('שגיאה בעדכון הסדר');
    }
  };

  const startEdit = (btn: CustomButton) => {
    setEditingId(btn.id);
    setLabel(btn.label);
    setActionText(btn.actionText);
    setMaleActionText(btn.maleActionText || '');
    setFemaleActionText(btn.femaleActionText || '');
    setFullText(btn.fullText || '');
    setMaleFullText(btn.maleFullText || '');
    setFemaleFullText(btn.femaleFullText || '');
    setPoints(btn.pointsValue);
    setTier(btn.tier || 1);
    setIsAdding(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <header className="mb-8 mt-4">
        <h1 className="text-3xl font-serif italic mb-2">ניהול משימות</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-widest">ערוך, מחק או סדר את כל המשימות</p>
      </header>

      <div className="space-y-6">
        {/* Add/Edit Form */}
        <section className="mb-8">
          <AnimatePresence mode="wait">
            {!isAdding && !editingId ? (
              <motion.button 
                key="add-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAdding(true)}
                className="w-full py-4 rounded-2xl border border-dashed border-white/20 text-white/50 hover:text-white hover:bg-white/5 hover:border-white/40 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={20} /> הוסף משימה חדשה
              </motion.button>
            ) : (
              <motion.form 
                key="form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={editingId ? handleUpdate : handleAdd}
                className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                
                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                  {editingId ? <Edit2 size={18} className="text-primary" /> : <Plus size={18} className="text-primary" />}
                  {editingId ? 'ערוך משימה' : 'משימה חדשה'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">שם המשימה (קצר)</label>
                    <input 
                      type="text" 
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder="לדוגמה: קפה"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">טקסט הפעולה (מה הצד השני יראה)</label>
                    <input 
                      type="text" 
                      value={actionText}
                      onChange={e => setActionText(e.target.value)}
                      placeholder="לדוגמה: תכין/י לי קפה בבקשה"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                      required
                    />
                    <p className="text-[10px] text-white/30 mt-1">טיפ: השתמש/י ב- תכין/י כדי שהמערכת תתאים אוטומטית, או מלא/י למטה:</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-blue-400/60 mb-1 font-bold">גרסה לזכר ♂️</label>
                      <input 
                        type="text" 
                        value={maleActionText}
                        onChange={e => setMaleActionText(e.target.value)}
                        placeholder="תכין לי קפה"
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-pink-400/60 mb-1 font-bold">גרסה לנקבה ♀️</label>
                      <input 
                        type="text" 
                        value={femaleActionText}
                        onChange={e => setFemaleActionText(e.target.value)}
                        placeholder="תכיני לי קפה"
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">פירוט המשימה (אופציונלי)</label>
                    <textarea 
                      value={fullText}
                      onChange={e => setFullText(e.target.value)}
                      placeholder="לדוגמה: קפה שחור חזק בלי סוכר, ותביא גם עוגייה."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors min-h-[80px] resize-none text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-blue-400/60 mb-1 font-bold">פירוט לזכר ♂️</label>
                      <textarea 
                        value={maleFullText}
                        onChange={e => setMaleFullText(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors min-h-[60px] resize-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-pink-400/60 mb-1 font-bold">פירוט לנקבה ♀️</label>
                      <textarea 
                        value={femaleFullText}
                        onChange={e => setFemaleFullText(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors min-h-[60px] resize-none text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">נקודות</label>
                      <input 
                        type="number" 
                        value={points}
                        onChange={e => setPoints(Number(e.target.value))}
                        min={1}
                        max={100}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">רמה (Tier)</label>
                      <select
                        value={tier}
                        onChange={e => setTier(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors text-sm appearance-none"
                      >
                        <option value={1}>⭐ רמה 1</option>
                        <option value={2}>⭐⭐ רמה 2</option>
                        <option value={3}>⭐⭐⭐ רמה 3</option>
                        <option value={4}>⭐⭐⭐⭐ רמה 4</option>
                        <option value={5}>⭐⭐⭐⭐⭐ רמה 5</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-black hover:bg-primary/90 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Check size={18} />
                    {editingId ? 'עדכן' : 'שמור'}
                  </button>
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <X size={18} />
                    ביטול
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </section>

        {/* Existing Buttons */}
        <section>
          <h2 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
            <Settings size={16} /> רשימת כל המשימות ({currentUser?.buttons?.length || 0})
          </h2>
          
          <div className="space-y-3">
            {currentUser?.buttons?.map((btn, index) => (
              <motion.div 
                key={btn.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-white flex items-center gap-2">
                    {btn.label}
                    {btn.tier && <span className="text-yellow-500 text-xs">{'⭐'.repeat(btn.tier)}</span>}
                  </h3>
                  <p className="text-xs text-white/50 line-clamp-1">{btn.actionText}</p>
                  <span className="text-[10px] text-primary font-mono mt-1 block">{btn.pointsValue} נק'</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <div className="flex flex-col gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-white/30 hover:text-white disabled:opacity-0"
                    >
                      <Plus size={14} className="rotate-180" />
                    </button>
                    <button 
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === (currentUser.buttons?.length || 0) - 1}
                      className="p-1 text-white/30 hover:text-white disabled:opacity-0"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => startEdit(btn)}
                      className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(btn)}
                      className="p-2 text-red-400/40 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
