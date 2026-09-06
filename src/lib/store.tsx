import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  query, 
  orderBy, 
  limit, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs,
  arrayUnion, 
  arrayRemove, 
  increment,
  writeBatch,
  where
} from 'firebase/firestore';
import { User, Mission, Session, CustomButton, ChatSession, ChatMessage, PrivacyMode } from './types';
import { DEFAULT_MISSIONS } from './defaultMissions';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  partner: User | null;
  missions: Mission[];
  session: Session | null;
  sendMission: (mission: Omit<Mission, 'id' | 'createdAt'>) => Promise<void>;
  updateMissionStatus: (missionId: string, status: Mission['status'], pointsValue?: number, response?: string, imageUrl?: string, unlockAt?: number, snoozeUntil?: number) => Promise<void>;
  revealMystery: (missionId: string) => Promise<void>;
  revertMissionCompletion: (missionId: string, pointsToSubtract: number) => Promise<void>;
  updateSessionMode: (mode: 'together' | 'remote') => Promise<void>;
  addCustomButton: (button: Omit<CustomButton, 'id'>) => Promise<void>;
  updateCustomButton: (button: CustomButton) => Promise<void>;
  deleteCustomButton: (button: CustomButton) => Promise<void>;
  redeemSpecialRequest: (level: number, pointsCost: number, title: string, shortText: string) => Promise<void>;
  redeemReward: (rewardName: string, cost: number) => Promise<void>;
  markMissionAsViewed: (missionId: string) => Promise<void>;
  resetAllMissions: (target: 'boaz' | 'mishel' | 'all') => Promise<void>;
  
  // Chat Features
  chatSession: ChatSession | null;
  chatMessages: ChatMessage[];
  editMessage: (messageId: string, newText: string) => Promise<void>;
  sendMessage: (text?: string, imageUrl?: string, videoUrl?: string, isViewOnce?: boolean, viewDuration?: number, replyToId?: string, replyToText?: string, isPing?: boolean, audioUrl?: string, location?: { lat: number; lng: number; address?: string }) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  panicDeleteChat: (forBoth: boolean) => Promise<void>;
  softDeleteChat: () => Promise<void>;
  restoreChat: () => Promise<void>;
  updatePrivacyMode: (mode: PrivacyMode) => Promise<void>;
  updateAutoExpire: (timerMs?: number) => Promise<void>;
  markMessageAsViewed: (messageId: string) => Promise<void>;
  markMessagesAsViewed: (messageIds: string[]) => Promise<void>;
  setTypingStatus: (isTyping: boolean) => Promise<void>;
  
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const deduplicateButtons = (buttons: any[]) => {
  const seen = new Set();
  return buttons.filter(btn => {
    if (!btn || !btn.id) return false;
    if (seen.has(btn.id)) return false;
    seen.add(btn.id);
    return true;
  });
};

const cleanLegacyButtons = (buttons: any[]) => {
  return buttons.filter(btn => !btn.id || !btn.id.startsWith('default-'));
};

const getLocalData = (key: string, defaultValue: any) => {
  try {
    const val = localStorage.getItem(`dateapp_${key}`);
    if (!val || val === "undefined" || val === "null") return defaultValue;
    const parsed = JSON.parse(val);
    return parsed !== null && parsed !== undefined ? parsed : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const setLocalData = (key: string, data: any) => {
  try {
    localStorage.setItem(`dateapp_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error("Local storage error:", e);
  }
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      if (!sessionStorage.getItem('dateapp_session_active')) {
        sessionStorage.setItem('dateapp_session_active', 'true');
        localStorage.removeItem('dateapp_current_user_id');
        return null;
      }
      
      const storedId = localStorage.getItem('dateapp_current_user_id') || null;
      if (storedId) {
         const lastActivity = parseInt(localStorage.getItem('last_activity') || '0', 10);
         const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
         if (Date.now() - lastActivity > SESSION_TIMEOUT) {
            localStorage.removeItem('dateapp_current_user_id');
            return null;
         }
      }
      return storedId;
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [partner, setPartner] = useState<User | null>(null);
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[] | null>(null);

  const hasQuotaError = false;

  useEffect(() => {
    
  }, []);

  const isQuotaError = (error: any) => {
    if (!error) return false;
    const errMsg = String(error.message || error).toLowerCase();
    return errMsg.includes('quota') || 
           errMsg.includes('exhausted') || 
           error.code === 'resource-exhausted';
  };

  // Local state fallbacks
  const [localUsers, setLocalUsers] = useState<Record<string, User>>(() => {
    const initialButtons = DEFAULT_MISSIONS;
    return getLocalData('users', {
      mishel: { id: 'mishel', name: 'התחברות', gender: 'female', points: 0, buttons: initialButtons } as User,
      boaz: { id: 'boaz', name: 'התנתקות', gender: 'male', points: 0, buttons: initialButtons } as User,
    });
  });

  const [localMissions, setLocalMissions] = useState<Mission[]>(() => {
    return getLocalData('missions', []);
  });

  const [localSession, setLocalSession] = useState<Session>(() => {
    return getLocalData('session', {
      id: 'current',
      mode: 'together',
      chemistryScore: 0,
      streak: 0,
      updatedAt: Date.now()
    } as Session);
  });

  const [localChatSession, setLocalChatSession] = useState<ChatSession>(() => {
    return getLocalData('chat_session', {
      id: 'current',
      participants: ['boaz', 'mishel'],
      privacyMode: 'normal',
      lastMessageAt: Date.now()
    } as ChatSession);
  });

  const [localChatMessages, setLocalChatMessages] = useState<ChatMessage[]>(() => {
    return getLocalData('chat_messages', []);
  });

  const updateLocalUser = (userId: string, partial: Partial<User>) => {
    setLocalUsers(prev => {
      const current = prev || {};
      const user = current[userId] || {};
      const updated = {
        ...current,
        [userId]: {
          ...user,
          ...partial
        } as User
      };
      setLocalData('users', updated);
      return updated;
    });
  };

  const addLocalMission = (mission: Mission) => {
    setLocalMissions(prev => {
      const updated = [mission, ...prev].slice(0, 100);
      setLocalData('missions', updated);
      return updated;
    });
  };

  const updateLocalMission = (missionId: string, partial: Partial<Mission>) => {
    setLocalMissions(prev => {
      const updated = prev.map(m => m.id === missionId ? ({ ...m, ...partial } as Mission) : m);
      setLocalData('missions', updated);
      return updated;
    });
  };

  const updateLocalSession = (partial: Partial<Session>) => {
    setLocalSession(prev => {
      const updated = { ...prev, ...partial } as Session;
      setLocalData('session', updated);
      return updated;
    });
  };

  const updateLocalChatSession = (partial: Partial<ChatSession>) => {
    setLocalChatSession(prev => {
      const updated = { ...prev, ...partial } as ChatSession;
      setLocalData('chat_session', updated);
      return updated;
    });
  };

  const addLocalChatMessage = (msg: ChatMessage) => {
    setLocalChatMessages(prev => {
      const updated = [msg, ...prev].slice(0, 100);
      setLocalData('chat_messages', updated);
      return updated;
    });
  };

  const updateLocalChatMessage = (msgId: string, partial: Partial<ChatMessage>) => {
    setLocalChatMessages(prev => {
      const updated = prev.map(m => m.id === msgId ? ({ ...m, ...partial } as ChatMessage) : m);
      setLocalData('chat_messages', updated);
      return updated;
    });
  };

  const transformGenderText = (text: string, gender: 'male' | 'female'): string => {
    if (!text) return text;
    
    // Pattern: (Hebrew word)/(Hebrew suffix)
    return text.replace(/([\u0590-\u05FF]+)\/([\u0590-\u05FF]+)/g, (match, p1, p2) => {
      // Special cases
      if (match === 'את/ה') return gender === 'male' ? 'אתה' : 'את';
      if (match === 'אותך/ה') return 'אותך';
      if (match === 'שלך/ה') return 'שלך';
      if (match === 'אדון/גברת') return gender === 'male' ? 'אדון' : 'גברת';
      if (match === 'עבד/ה') return gender === 'male' ? 'עבד' : 'שפחה';
      if (match === 'שולט/ת') return gender === 'male' ? 'שולט' : 'שולטת';
      if (match === 'חופשי/ת') return gender === 'male' ? 'חופשי' : 'חופשיה';
      
      if (gender === 'male') {
        return p1;
      } else {
        // Female form
        if (p2 === 'י') {
          // Handle verbs like תכתוב/י -> תכתבי
          if (p1.endsWith('וב')) return p1.slice(0, -2) + 'בי';
          if (p1.endsWith('וד')) return p1.slice(0, -2) + 'די';
          if (p1.endsWith('וש')) return p1.slice(0, -2) + 'שי';
          if (p1.endsWith('וט')) return p1.slice(0, -2) + 'טי';
          if (p1.endsWith('ול')) return p1.slice(0, -2) + 'לי';
          if (p1.endsWith('וק')) return p1.slice(0, -2) + 'קי';
          if (p1.endsWith('ור')) return p1.slice(0, -2) + 'רי';
          if (p1.endsWith('וח')) return p1.slice(0, -2) + 'חי';
          if (p1.endsWith('וף')) return p1.slice(0, -2) + 'פי';
          if (p1.endsWith('וץ')) return p1.slice(0, -2) + 'צי';
        }
        return p1 + p2;
      }
    });
  };

  useEffect(() => {
    if (hasQuotaError) return;
    // Seed users if they don't exist
    const seedUsers = async () => {
      try {
        const mishelRef = doc(db, 'users', 'mishel');
        const boazRef = doc(db, 'users', 'boaz');
        
        const mishelSnap = await getDoc(mishelRef);
        const initialButtons = DEFAULT_MISSIONS;

        if (!mishelSnap.exists()) {
          const initUser = { name: 'התחברות', gender: 'female' as const, points: 0, buttons: initialButtons };
          await setDoc(mishelRef, initUser);
          updateLocalUser('mishel', initUser);
        } else {
          const data = mishelSnap.data();
          if (!data.gender) {
            await updateDoc(mishelRef, { gender: 'female' });
          }
          
          const currentButtons = data.buttons || data.customButtons || [];
          const uniqueButtons = deduplicateButtons([...initialButtons, ...cleanLegacyButtons(currentButtons)]);
          
          if (!data.buttons || uniqueButtons.length !== currentButtons.length || currentButtons.some((b: any) => b.id?.startsWith('default-'))) {
            await updateDoc(mishelRef, { buttons: uniqueButtons });
          }
          updateLocalUser('mishel', { ...data, gender: 'female', buttons: uniqueButtons });
        }
        
        const boazSnap = await getDoc(boazRef);
        if (!boazSnap.exists()) {
          const initUser = { name: 'התנתקות', gender: 'male' as const, points: 0, buttons: initialButtons };
          await setDoc(boazRef, initUser);
          updateLocalUser('boaz', initUser);
        } else {
          const data = boazSnap.data();
          if (!data.gender) {
            await updateDoc(boazRef, { gender: 'male' });
          }
          
          const currentButtons = data.buttons || data.customButtons || [];
          const uniqueButtons = deduplicateButtons([...initialButtons, ...cleanLegacyButtons(currentButtons)]);
          
          if (!data.buttons || uniqueButtons.length !== currentButtons.length || currentButtons.some((b: any) => b.id?.startsWith('default-'))) {
            await updateDoc(boazRef, { buttons: uniqueButtons });
          }
          updateLocalUser('boaz', { ...data, gender: 'male', buttons: uniqueButtons });
        }

        const initialSession = {
          mode: 'together' as const,
          chemistryScore: 0,
          streak: 0,
          updatedAt: Date.now()
        };
        await setDoc(doc(db, 'sessions', 'current'), initialSession, { merge: true });
        updateLocalSession(initialSession);
      } catch (e) {
        if (isQuotaError(e)) {
          console.warn("Quota or connection error, working offline (Error seeding users)");
          
          
        } else {
          console.error("Error seeding users", e);
        }
      }
    };
    seedUsers();

    const qMissions = query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(50));
    const unsubMissions = onSnapshot(qMissions, (snapshot) => {
      const ms: Mission[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        ms.push({ id: doc.id, ...data } as Mission);
      });
      console.log(`Fetched ${ms.length} missions`);
      setMissions(ms);
      setLocalMissions(ms);
      setLocalData('missions', ms);
    });

    const unsubSession = onSnapshot(doc(db, 'sessions', 'current'), (docSnap) => {
      if (docSnap.exists()) {
        const s = { id: docSnap.id, ...docSnap.data() } as Session;
        setSession(s);
        setLocalSession(s);
        setLocalData('session', s);
      }
    });

    const unsubChatSession = onSnapshot(doc(db, 'chat_sessions', 'current'), (docSnap) => {
      if (docSnap.exists()) {
        const cs = { id: docSnap.id, ...docSnap.data() } as ChatSession;
        setChatSession(cs);
        setLocalChatSession(cs);
        setLocalData('chat_session', cs);
      } else {
        const initialChatSession = {
          participants: ['boaz', 'mishel'],
          privacyMode: 'normal' as const,
          lastMessageAt: Date.now()
        };
        setDoc(doc(db, 'chat_sessions', 'current'), initialChatSession).catch(err => {
          if (isQuotaError(err)) {
            
            
          }
        });
        updateLocalChatSession(initialChatSession);
      }
    });

    const qChatMessages = query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'), limit(300));
    const unsubChatMessages = onSnapshot(qChatMessages, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        msgs.push({ id: doc.id, ...data } as ChatMessage);
      });
      setChatMessages(msgs);
      setLocalChatMessages(msgs);
      setLocalData('chat_messages', msgs);
      
      if (hasQuotaError) {
        
        
      }
    });

    return () => {
      unsubMissions();
      unsubSession();
      unsubChatSession();
      unsubChatMessages();
    };
  }, [hasQuotaError]);

  useEffect(() => {
    if (!currentUserId) {
      setCurrentUser(null);
      setPartner(null);
      return;
    }

    try {
      localStorage.setItem('dateapp_current_user_id', currentUserId);
    } catch {}

    if (hasQuotaError) return;

    const unsubUser = onSnapshot(doc(db, 'users', currentUserId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const buttons = data.buttons || [];
        const uniqueButtons = deduplicateButtons(buttons);
        const u = { id: docSnap.id, ...data, buttons: uniqueButtons } as User;
        setCurrentUser(u);
        updateLocalUser(currentUserId, u);
      }
    });

    const partnerId = currentUserId === 'mishel' ? 'boaz' : 'mishel';
    const unsubPartner = onSnapshot(doc(db, 'users', partnerId), (docSnap) => {
      if (docSnap.exists()) {
        const p = { id: docSnap.id, ...docSnap.data() } as User;
        setPartner(p);
        updateLocalUser(partnerId, p);
      }
    });

    return () => {
      unsubUser();
      unsubPartner();
    };
  }, [currentUserId, hasQuotaError]);

  useEffect(() => {
    if (!currentUserId || hasQuotaError) return;
    
    const userRef = doc(db, 'users', currentUserId);
    setDoc(userRef, { lastSeen: Date.now(), isOnline: true }, { merge: true }).catch(err => {
      if (isQuotaError(err)) {
        
        
      }
    });

    const interval = setInterval(() => {
      setDoc(userRef, { lastSeen: Date.now(), isOnline: true }, { merge: true }).catch(err => {
        if (isQuotaError(err)) {
          
          
        }
      });
    }, 60000);

    const handleUnload = () => {
      setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true }).catch(() => {});
      localStorage.removeItem('dateapp_current_user_id');
      sessionStorage.removeItem('dateapp_session_active');
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true }).catch(() => {});
    };
  }, [currentUserId]);

  const handleSetCurrentUser = async (user: User | null) => {
    if (user) {
      

      // 1. Log the user in locally right away so the UI transitions instantly and does not block on mobile/slow networks
      setCurrentUserId(user.id);
      setCurrentUser(user);
      
      updateLocalUser(user.id, {
        name: user.name,
        gender: user.gender,
        points: user.points || 0,
        buttons: user.buttons || DEFAULT_MISSIONS,
      });

      // 2. Perform Firestore check in the background without holding up the user's login experience
      if (!hasQuotaError) {
        (async () => {
          try {
            const userRef = doc(db, 'users', user.id);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                name: user.name,
                gender: user.gender,
                points: 0,
                buttons: DEFAULT_MISSIONS
              });
            } else {
              const data = userSnap.data();
              if (data.gender !== user.gender) {
                await updateDoc(userRef, { gender: user.gender });
              }
            }
          } catch (err) {
            if (isQuotaError(err)) {
        console.warn("Quota or connection error, working offline (Error check/create user in Firestore (async background):)");
        
        
      } else {
        console.error("Error check/create user in Firestore (async background):", err);
      }
          }
        })();
      }
    } else {
      setCurrentUserId(null);
      try {
        localStorage.removeItem('dateapp_current_user_id');
      } catch {}
    }
  };

  const sendMission = async (mission: Omit<Mission, 'id' | 'createdAt'>) => {
    const sender = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    const rcvr = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null) : partner;
    
    if (!sender || !rcvr) {
      console.error("Cannot send mission: sender or receiver is missing", { sender, rcvr });
      return;
    }

    try {
      console.log("Sending mission to:", rcvr.name, mission);
      const receiverGender = rcvr.gender;
      
      let finalTitle = mission.title;
      let finalShortText = mission.shortText;
      let finalFullText = mission.fullText;

      if (receiverGender === 'male') {
        finalShortText = mission.maleShortText || transformGenderText(mission.shortText, 'male');
        finalFullText = mission.maleFullText || (mission.fullText ? transformGenderText(mission.fullText, 'male') : undefined);
      } else {
        finalShortText = mission.femaleShortText || transformGenderText(mission.shortText, 'female');
        finalFullText = mission.femaleFullText || (mission.fullText ? transformGenderText(mission.fullText, 'female') : undefined);
      }

      const mId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const missionData: Mission = {
        ...mission,
        id: mId,
        title: finalTitle,
        shortText: finalShortText,
        createdAt: Date.now()
      } as Mission;

      if (finalFullText !== undefined) missionData.fullText = finalFullText;
      
      Object.keys(missionData).forEach(key => {
        if ((missionData as any)[key] === undefined) {
          delete (missionData as any)[key];
        }
      });

      addLocalMission(missionData);

      if (!hasQuotaError) {
        const newMissionRef = doc(db, 'missions', mId);
        await setDoc(newMissionRef, missionData);
        console.log("Mission sent successfully to Firestore with ID:", mId);
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error sending mission:)");
        
        
      } else {
        console.error("Error sending mission:", error);
      }
    }
  };

  const updateMissionStatus = async (missionId: string, status: Mission['status'], pointsValue: number = 0, response?: string, imageUrl?: string, unlockAt?: number, snoozeUntil?: number) => {
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    const p = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null) : partner;
    const s = hasQuotaError ? localSession : session;

    try {
      const updateData: any = { status };
      if (status === 'completed') {
        updateData.completedAt = Date.now();
      }
      if (response !== undefined) {
        updateData.response = response;
      }
      if (imageUrl !== undefined) {
        updateData.imageUrl = imageUrl;
      }
      if (unlockAt !== undefined) {
        updateData.unlockAt = unlockAt;
      }
      if (snoozeUntil !== undefined) {
        updateData.snoozeUntil = snoozeUntil;
      }

      updateLocalMission(missionId, updateData);

      if (status === 'completed' && currentUserId && u) {
        const totalPoints = pointsValue + 5;
        const newPoints = (u.points || 0) + totalPoints;
        
        const TIERS = [
          { level: 1, pointsNeeded: 0 },
          { level: 2, pointsNeeded: 65 },
          { level: 3, pointsNeeded: 130 },
          { level: 4, pointsNeeded: 250 },
          { level: 5, pointsNeeded: 400 },
        ];
        const newTier = TIERS.slice().reverse().find(t => newPoints >= t.pointsNeeded)?.level || 1;
        const currentHighestTier = u.highestTierReached || 1;
        
        const uUpdate: Partial<User> = { points: newPoints };
        if (newTier > currentHighestTier) {
          uUpdate.highestTierReached = newTier;
          if (p) {
            const systemMissionId = 'sys_' + Date.now();
            const sysMission = {
              id: systemMissionId,
              sender: 'system',
              receiver: p.id,
              title: `רמה ${newTier} נפתחה! 🎉`,
              shortText: `${u.name} הגיע/ה לרמה ${newTier}. עכשיו אפשר משימות חריגות יותר!`,
              status: 'sent',
              createdAt: Date.now(),
              isSpecialRequest: false,
              tier: newTier
            } as Mission;
            addLocalMission(sysMission);
            setDoc(doc(db, 'missions', systemMissionId), sysMission).catch(() => {});
          }
        }
        updateLocalUser(currentUserId, uUpdate);

        if (s) {
          updateLocalSession({
            chemistryScore: s.chemistryScore + 10,
            streak: s.streak + 1,
            updatedAt: Date.now()
          });
        }
      } else if (status === 'rejected' && pointsValue < 0 && currentUserId && u) {
        updateLocalUser(currentUserId, {
          points: Math.max(0, (u.points || 0) + pointsValue)
        });
        if (s) {
          updateLocalSession({
            chemistryScore: Math.max(0, s.chemistryScore - 5),
            updatedAt: Date.now()
          });
        }
      }

      if (!hasQuotaError) {
        await updateDoc(doc(db, 'missions', missionId), updateData);
        
        if (status === 'completed' && currentUserId && u) {
          const totalPoints = pointsValue + 5;
          const newPoints = (u.points || 0) + totalPoints;
          const TIERS = [
            { level: 1, pointsNeeded: 0 },
            { level: 2, pointsNeeded: 65 },
            { level: 3, pointsNeeded: 130 },
            { level: 4, pointsNeeded: 250 },
            { level: 5, pointsNeeded: 400 },
          ];
          const newTier = TIERS.slice().reverse().find(t => newPoints >= t.pointsNeeded)?.level || 1;
          const currentHighestTier = u.highestTierReached || 1;

          const userUpdate: any = {
            points: increment(totalPoints)
          };
          if (newTier > currentHighestTier) {
            userUpdate.highestTierReached = newTier;
          }
          await updateDoc(doc(db, 'users', currentUserId), userUpdate);
          
          if (s) {
            await updateDoc(doc(db, 'sessions', 'current'), {
              chemistryScore: s.chemistryScore + 10,
              streak: s.streak + 1,
              updatedAt: Date.now()
            });
          }
        } else if (status === 'rejected' && pointsValue < 0 && currentUserId && u) {
          await updateDoc(doc(db, 'users', currentUserId), {
            points: increment(pointsValue)
          });
          if (s) {
            await updateDoc(doc(db, 'sessions', 'current'), {
              chemistryScore: Math.max(0, s.chemistryScore - 5),
              updatedAt: Date.now()
            });
          }
        }
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error updating mission:)");
        
        
      } else {
        console.error("Error updating mission:", error);
      }
    }
  };

   const revealMystery = async (missionId: string) => {
    try {
      updateLocalMission(missionId, { isMysteryRevealed: true });
      if (!hasQuotaError) {
        await updateDoc(doc(db, 'missions', missionId), { isMysteryRevealed: true });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error revealing mystery mission:)");
        
        
      } else {
        console.error("Error revealing mystery mission:", error);
      }
    }
  };

  const revertMissionCompletion = async (missionId: string, pointsToSubtract: number) => {
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    try {
      updateLocalMission(missionId, { status: 'opened' });
      if (currentUserId && u) {
        updateLocalUser(currentUserId, {
          points: Math.max(0, (u.points || 0) - pointsToSubtract)
        });
      }

      if (!hasQuotaError) {
        await updateDoc(doc(db, 'missions', missionId), { status: 'opened' });
        if (currentUserId && u) {
          const userUpdate: any = {
            points: increment(-pointsToSubtract)
          };
          await updateDoc(doc(db, 'users', currentUserId), userUpdate);
        }
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error reverting mission:)");
        
        
      } else {
        console.error("Error reverting mission:", error);
      }
    }
  };

  const updateSessionMode = async (mode: 'together' | 'remote') => {
    try {
      updateLocalSession({ mode, updatedAt: Date.now() });
      if (!hasQuotaError) {
        await updateDoc(doc(db, 'sessions', 'current'), { mode, updatedAt: Date.now() });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error updating session:)");
        
        
      } else {
        console.error("Error updating session:", error);
      }
    }
  };

  const addCustomButton = async (button: Omit<CustomButton, 'id'>) => {
    if (!currentUserId) return;
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    if (!u) return;
    try {
      const newButton = { ...button, id: Date.now().toString() };
      const nextButtons = [...(u.buttons || []), newButton];
      updateLocalUser(currentUserId, { buttons: nextButtons });

      if (!hasQuotaError) {
        await updateDoc(doc(db, 'users', currentUserId), {
          buttons: arrayUnion(newButton)
        });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error adding custom button:)");
        
        
      } else {
        console.error("Error adding custom button:", error);
      }
    }
  };

  const updateCustomButton = async (updatedButton: CustomButton) => {
    if (!currentUserId) return;
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    if (!u) return;
    try {
      const updatedButtons = u.buttons?.map(btn => 
        btn.id === updatedButton.id ? updatedButton : btn
      ) || [];
      updateLocalUser(currentUserId, { buttons: updatedButtons });
      
      if (!hasQuotaError) {
        await updateDoc(doc(db, 'users', currentUserId), {
          buttons: updatedButtons
        });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error updating custom button:)");
        
        
      } else {
        console.error("Error updating custom button:", error);
      }
    }
  };

  const deleteCustomButton = async (button: CustomButton) => {
    if (!currentUserId) return;
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    if (!u) return;
    try {
      const updatedButtons = u.buttons?.filter(btn => btn.id !== button.id) || [];
      updateLocalUser(currentUserId, { buttons: updatedButtons });

      if (!hasQuotaError) {
        await updateDoc(doc(db, 'users', currentUserId), {
          buttons: updatedButtons
        });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error deleting custom button:)");
        
        
      } else {
        console.error("Error deleting custom button:", error);
      }
    }
  };

  const redeemSpecialRequest = async (level: number, pointsCost: number, title: string, shortText: string) => {
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    const p = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null) : partner;
    if (!currentUserId || !u || (u.points || 0) < pointsCost) return;
    
    try {
      updateLocalUser(currentUserId, { points: Math.max(0, (u.points || 0) - pointsCost) });

      const mId = 'spec_' + Date.now();
      const specMission = {
        id: mId,
        sender: currentUserId,
        receiver: p?.id || '',
        title,
        shortText,
        status: 'sent',
        createdAt: Date.now(),
        pointsValue: 0,
        isSpecialRequest: true,
        specialRequestLevel: level
      } as Mission;
      addLocalMission(specMission);

      if (!hasQuotaError) {
        await updateDoc(doc(db, 'users', currentUserId), {
          points: increment(-pointsCost)
        });

        await setDoc(doc(db, 'missions', mId), specMission);
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error redeeming special request:)");
        
        
      } else {
        console.error("Error redeeming special request:", error);
      }
    }
  };

  const redeemReward = async (rewardName: string, cost: number) => {
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    const p = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null) : partner;
    if (!currentUserId || !u || (u.points || 0) < cost) return;
    
    try {
      updateLocalUser(currentUserId, { points: Math.max(0, (u.points || 0) - cost) });

      const mId = 'reward_' + Date.now();
      const rewardNotification = {
        id: mId,
        sender: 'system',
        receiver: p?.id || '',
        title: `פרס מומש! 🎁`,
        shortText: `${u.name} קנה/תה את הפרס: ${rewardName}`,
        status: 'sent',
        createdAt: Date.now(),
        pointsValue: 0,
        isSpecialRequest: false
      } as Mission;
      addLocalMission(rewardNotification);

      if (!hasQuotaError) {
        await updateDoc(doc(db, 'users', currentUserId), {
          points: increment(-cost)
        });

        await setDoc(doc(db, 'missions', mId), rewardNotification);
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error redeeming reward:)");
        
        
      } else {
        console.error("Error redeeming reward:", error);
      }
    }
  };
  
  const markMissionAsViewed = async (missionId: string) => {
    try {
      updateLocalMission(missionId, { isViewed: true });
      if (!hasQuotaError) {
        const missionRef = doc(db, 'missions', missionId);
        const missionSnap = await getDoc(missionRef);
        if (missionSnap.exists()) {
          const missionData = missionSnap.data() as Mission;
          const updateData: any = { isViewed: true };
          if (missionData.isViewOnce) {
            updateData.imageUrl = '';
            updateLocalMission(missionId, { imageUrl: '' });
          }
          await updateDoc(missionRef, updateData);
        }
      } else {
        const localCopy = localMissions.find(m => m.id === missionId);
        if (localCopy?.isViewOnce) {
          updateLocalMission(missionId, { imageUrl: '' });
        }
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error marking mission as viewed:)");
        
        
      } else {
        console.error("Error marking mission as viewed:", error);
      }
    }
  };


  const editMessage = async (messageId: string, newText: string) => {
    if (!currentUserId) return;
    try {
      const now = Date.now();
      updateLocalChatMessage(messageId, { text: newText, editedAt: now });
      
      if (!hasQuotaError) {
        updateDoc(doc(db, 'chat_messages', messageId), {
          text: newText,
          editedAt: now
        }).catch(err => {
          console.error("Edit offline / failed:", err);
        });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error editing message)");
        
        
      } else {
        console.error("Error editing message:", error);
      }
    }
  };

  const sendMessage = async (text?: string, imageUrl?: string, videoUrl?: string, isViewOnce?: boolean, viewDuration?: number, replyToId?: string, replyToText?: string, isPing?: boolean, audioUrl?: string, location?: { lat: number; lng: number; address?: string }) => {
    const u = currentUser || (currentUserId ? (localUsers || {})[currentUserId] : null);
    const p = partner || (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null);
    const cs = chatSession || localChatSession;
    if (!u || !p) return;
    
    try {
      const now = Date.now();
      let expiresAt: number | undefined;
      
      if (cs?.autoExpireTimer) {
        expiresAt = now + cs.autoExpireTimer;
      }

      const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const msgData: ChatMessage = {
        id: msgId,
        sessionId: 'current',
        senderId: u.id,
        receiverId: p.id,
        createdAt: now,
      } as ChatMessage;

      if (text) msgData.text = text;
      if (imageUrl) {
        msgData.imageUrl = imageUrl;
        msgData.mediaType = 'image';
      }
      if (videoUrl) {
        msgData.videoUrl = videoUrl;
        msgData.mediaType = 'video';
      }
      if (isViewOnce) {
        msgData.isViewOnce = isViewOnce;
        if (viewDuration) msgData.viewDuration = viewDuration;
      }
      if (expiresAt) msgData.expiresAt = expiresAt;
      if (replyToId) msgData.replyToId = replyToId;
      if (replyToText) msgData.replyToText = replyToText;
      if (isPing) msgData.isPing = isPing;
      if (audioUrl) {
        msgData.audioUrl = audioUrl;
        msgData.mediaType = 'audio';
      }
      if (location) msgData.location = location;

      const currentMap = { ...cs?.deletedAtByUser };
      delete currentMap[u.id];

      addLocalChatMessage(msgData);
      updateLocalChatSession({ 
        lastMessageAt: now,
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
        deletedAtByUser: currentMap
      });

      // Optimistic update for chatMessages state so it gets shown immediately!
      setChatMessages(prev => {
        const safePrev = prev || [];
        if (safePrev.some(m => m.id === msgId)) return safePrev;
        return [msgData, ...safePrev];
      });

      // Always attempt to write to Firestore, auto-recovering if we hit an offline error
      setDoc(doc(db, 'chat_messages', msgId), msgData).then(() => {
        if (hasQuotaError) {
          
          
        }
      }).catch(error => {
        if (isQuotaError(error)) {
          console.warn("Quota or connection error, working offline (Error sending message to remote db:)");
          
          try {
            
          } catch {}
        } else {
          console.error("Error sending message to remote db:", error);
        }
      });
      setDoc(doc(db, 'chat_sessions', 'current'), { 
        lastMessageAt: now,
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
        deletedAtByUser: currentMap
      }, { merge: true }).catch(() => {});
    } catch (error) {
      console.error("Error formatting message:", error);
    }
  };

  const setTypingStatus = async (isTyping: boolean) => {
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    if (!u) return;
    try {
      const updateData: any = {};
      updateData[`typingUsers.${u.id}`] = isTyping ? Date.now() : 0;
      updateLocalChatSession({
        typingUsers: {
          ...(localChatSession?.typingUsers || {}),
          [u.id]: isTyping ? Date.now() : 0
        }
      });
      if (!hasQuotaError) {
        updateDoc(doc(db, 'chat_sessions', 'current'), updateData).catch(e => console.error(e));
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error setting typing status:)");
        
        
      } else {
        console.error("Error setting typing status:", error);
      }
    }
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    const u = currentUser || (currentUserId ? (localUsers || {})[currentUserId] : null);
    if (!u) return;
    try {
      const msgRef = doc(db, 'chat_messages', messageId);
      
      // Update local state immediately
      setLocalChatMessages(prev => {
        const updated = prev.map(m => {
          if (m.id === messageId) {
            const reactions = { ...(m.reactions || {}) };
            if (reactions[u.id] === emoji) {
              delete reactions[u.id]; // Toggle off
            } else {
              reactions[u.id] = emoji;
            }
            return { ...m, reactions };
          }
          return m;
        });
        setLocalData('chat_messages', updated);
        return updated;
      });

      // We need to read the document first to update the reactions map correctly in Firestore
      // Or we can just use setLocalChatMessages and a merge update if we structure it right, but since we are replacing the whole reactions object we might want to do it cleanly.
      // Actually, since we update local state, let's just push it. But it's safer to use updateDoc with a nested field like 'reactions.' + u.id, but emoji can be empty string for delete.
      
      // We will do this: if emoji exists, we set reactions.${u.id} = emoji. If we want to remove, we deleteField()
      // To simplify, we will just merge the whole object based on local state since it's already computed.
      const currentMsg = chatMessages?.find(m => m.id === messageId) || localChatMessages.find(m => m.id === messageId);
      if (currentMsg) {
        const reactions = { ...(currentMsg.reactions || {}) };
        if (reactions[u.id] === emoji) {
          delete reactions[u.id];
        } else {
          reactions[u.id] = emoji;
        }
        await updateDoc(msgRef, { reactions });
      }
    } catch (error) {
      console.error("Error reacting to message:", error);
    }
  };

  const panicDeleteChat = async (forBoth: boolean) => {
    try {
      if (forBoth) {
        setLocalChatMessages([]);
        setLocalData('chat_messages', []);
        updateLocalChatSession({
          lastMessageAt: Date.now(),
          isDeleted: false,
          deletedBy: null,
          deletedAt: null
        });

        if (!hasQuotaError) {
          const msgsSnap = await getDocs(collection(db, 'chat_messages'));
          const batch = writeBatch(db);
          msgsSnap.docs.forEach(doc => batch.delete(doc.ref));
          
          batch.update(doc(db, 'chat_sessions', 'current'), {
            lastMessageAt: Date.now(),
            isDeleted: false,
            deletedBy: null,
            deletedAt: null
          });
          
          await batch.commit();
        }
      } else {
        await softDeleteChat();
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error panic deleting chat:)");
        
        
      } else {
        console.error("Error panic deleting chat:", error);
      }
    }
  };

  const softDeleteChat = async () => {
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    if (!u) return;
    try {
      const now = Date.now();
      const cs = hasQuotaError ? localChatSession : chatSession;
      const currentMap = cs?.deletedAtByUser || {};
      const updatedMap = { ...currentMap, [u.id]: now };

      updateLocalChatSession({
        deletedAtByUser: updatedMap
      });

      if (!hasQuotaError) {
        await setDoc(doc(db, 'chat_sessions', 'current'), {
          deletedAtByUser: updatedMap
        }, { merge: true });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error soft deleting chat:)");
        
        
      } else {
        console.error("Error soft deleting chat:", error);
      }
    }
  };

  const restoreChat = async () => {
    const u = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
    const cs = hasQuotaError ? localChatSession : chatSession;
    if (!u) return;
    try {
      const currentMap = { ...cs?.deletedAtByUser };
      delete currentMap[u.id];

      updateLocalChatSession({
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
        deletedAtByUser: currentMap
      });

      if (!hasQuotaError) {
        await setDoc(doc(db, 'chat_sessions', 'current'), {
          isDeleted: false,
          deletedBy: null,
          deletedAt: null,
          deletedAtByUser: currentMap
        }, { merge: true });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error restoring chat:)");
        
        
      } else {
        console.error("Error restoring chat:", error);
      }
    }
  };

  const updatePrivacyMode = async (mode: PrivacyMode) => {
    try {
      updateLocalChatSession({ privacyMode: mode });
      if (!hasQuotaError) {
        await updateDoc(doc(db, 'chat_sessions', 'current'), { privacyMode: mode });
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error updating privacy mode:)");
        
        
      } else {
        console.error("Error updating privacy mode:", error);
      }
    }
  };

  const updateAutoExpire = async (timerMs?: number) => {
    try {
      updateLocalChatSession({ autoExpireTimer: timerMs || undefined });
      const updateData: any = { autoExpireTimer: timerMs || null };
      if (!hasQuotaError) {
        await updateDoc(doc(db, 'chat_sessions', 'current'), updateData);
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error updating auto expire:)");
        
        
      } else {
        console.error("Error updating auto expire:", error);
      }
    }
  };

  const markMessagesAsViewed = async (messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return;
    
    try {
      const now = Date.now();
      messageIds.forEach(id => {
        updateLocalChatMessage(id, { viewedAt: now });
      });

      if (!hasQuotaError) {
        const batch = writeBatch(db);
        messageIds.forEach(id => {
           const msgRef = doc(db, 'chat_messages', id);
           batch.update(msgRef, { viewedAt: now });
        });
        batch.commit().catch(e => console.error(e));
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error marking messages as viewed:)");
        
        
      } else {
        console.error("Error marking messages as viewed:", error);
      }
    }
  };

  const markMessageAsViewed = async (messageId: string) => {
    try {
      updateLocalChatMessage(messageId, { viewedAt: Date.now() });
      const localCopy = localChatMessages.find(m => m.id === messageId);
      const isViewOnce = localCopy?.isViewOnce;
      
      const updateData: any = { viewedAt: Date.now() };
      if (isViewOnce) {
        updateData.imageUrl = '';
        updateData.text = 'הודעה נמחקה (צפייה חד פעמית)';
        updateLocalChatMessage(messageId, { imageUrl: '', text: updateData.text });
      }

      if (!hasQuotaError) {
        const msgRef = doc(db, 'chat_messages', messageId);
        updateDoc(msgRef, updateData).catch(e => console.error(e));
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error marking message as viewed:)");
        
        
      } else {
        console.error("Error marking message as viewed:", error);
      }
    }
  };

  const resetAllMissions = async (target: 'boaz' | 'mishel' | 'all') => {
    try {
      if (target === 'all') {
        setLocalMissions([]);
        setLocalData('missions', []);
        setLocalUsers(prev => {
          const next = { ...prev };
          if (next.boaz) next.boaz.points = 0;
          if (next.mishel) next.mishel.points = 0;
          setLocalData('users', next);
          return next;
        });
      } else {
        setLocalMissions(prev => {
          const next = prev.filter(m => m.sender !== target && m.receiver !== target);
          setLocalData('missions', next);
          return next;
        });
        setLocalUsers(prev => {
          const next = { ...prev };
          if (next[target]) next[target].points = 0;
          setLocalData('users', next);
          return next;
        });
      }

      if (!hasQuotaError) {
        const missionsRef = collection(db, 'missions');
        let docsToDelete: any[] = [];
        
        if (target === 'all') {
          const missionsSnap = await getDocs(missionsRef);
          docsToDelete = missionsSnap.docs;
        } else {
          const qSender = query(missionsRef, where('sender', '==', target));
          const qReceiver = query(missionsRef, where('receiver', '==', target));
          
          const [snapSender, snapReceiver] = await Promise.all([
            getDocs(qSender),
            getDocs(qReceiver)
          ]);
          
          const docsMap = new Map();
          snapSender.docs.forEach(doc => docsMap.set(doc.id, doc));
          snapReceiver.docs.forEach(doc => docsMap.set(doc.id, doc));
          
          docsToDelete = Array.from(docsMap.values());
        }

        const batch = writeBatch(db);
        
        docsToDelete.forEach((doc) => {
          batch.delete(doc.ref);
        });

        if (target === 'all') {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { points: 0 });
          });
        } else {
          const userRef = doc(db, 'users', target);
          batch.update(userRef, { points: 0 });
        }
        
        await batch.commit();
      }
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Quota or connection error, working offline (Error resetting missions)");
        
        
      } else {
        console.error('Error resetting missions:', error);
      }
    }
  };

  const activeUser = hasQuotaError || !currentUser ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
  const activePartner = hasQuotaError || !partner ? (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null) : partner;
  const activeMissions = hasQuotaError || missions === null ? localMissions : missions;
  const activeSession = hasQuotaError || session === null ? localSession : session;
  const activeChatSession = hasQuotaError || chatSession === null ? localChatSession : chatSession;
  const activeChatMessages = hasQuotaError || chatMessages === null ? localChatMessages : chatMessages;

  return (
    <AppContext.Provider value={{ 
      currentUser: activeUser, 
      setCurrentUser: handleSetCurrentUser, 
      partner: activePartner, 
      missions: activeMissions, 
      session: activeSession, 
      sendMission, 
      updateMissionStatus, 
      revealMystery,
      updateSessionMode,
      addCustomButton,
      updateCustomButton,
      deleteCustomButton,
      redeemSpecialRequest,
      redeemReward,
      markMissionAsViewed,
      resetAllMissions,
      revertMissionCompletion,
      chatSession: activeChatSession,
      chatMessages: activeChatMessages,
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
      setTypingStatus,
      hasQuotaError
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
