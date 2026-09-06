import React, { useState, useEffect, useMemo } from 'react';
import { Home, Bell, History, Settings, ShoppingBag, Award, MessageCircle, FolderLock, Gamepad2 } from 'lucide-react';
import { useApp } from '../lib/store';
import { motion } from 'motion/react';
import { playSound } from '../lib/sounds';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'home' | 'inbox' | 'profile' | 'settings' | 'chat' | 'vault' | 'games';
  setActiveTab: (tab: 'home' | 'inbox' | 'profile' | 'settings' | 'chat' | 'vault' | 'games') => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { missions, currentUser, chatMessages, partner } = useApp();
  
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);

  React.useEffect(() => {
    const handleChatScroll = (e: any) => setIsChatAtBottom(e.detail.isAtBottom);
    window.addEventListener('chatScroll', handleChatScroll);
    return () => window.removeEventListener('chatScroll', handleChatScroll);
  }, []);
  
  const pendingCount = missions.filter(m => 
    m.receiver === currentUser?.id && 
    (
      ((m.status === 'sent' || m.status === 'opened' || m.status === 'saved_for_later') && (!m.unlockAt || m.unlockAt <= Date.now())) ||
      (m.status === 'locked' && m.unlockAt && m.unlockAt <= Date.now())
    )
  ).length;

  const unreadChatCount = chatMessages.filter(m => 
    m.receiverId === currentUser?.id && !m.viewedAt && !m.isViewOnce && !m.isPing
  ).length;

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [gamesWithMyTurn, setGamesWithMyTurn] = useState<number>(0);

  const gameId = useMemo(() => {
    return currentUser?.id && partner?.id
      ? [currentUser.id, partner.id].sort().join("_")
      : null;
  }, [currentUser?.id, partner?.id]);

  const [myTurnGames, setMyTurnGames] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!gameId || !currentUser) {
      setMyTurnGames([]);
      return;
    }

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
          if (isMyTurn) {
            return [...others, g];
          }
          return others;
        });
      }, () => {})
    );

    return () => unsubs.forEach(u => u());
  }, [gameId, currentUser]);

  const hasGameTurn = myTurnGames.length > 0;


  React.useEffect(() => {
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

  React.useEffect(() => {
    const totalUnread = unreadChatCount + pendingCount;
    if (typeof navigator !== 'undefined') {
      if ('setAppBadge' in navigator && totalUnread > 0) {
        (navigator as any).setAppBadge(totalUnread).catch(console.error);
      } else if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge().catch(console.error);
      }
    }
    
    // Call inside a user gesture or leave it passive
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
       // Just attempting setAppBadge is standard for PWAs.
    }
  }, [unreadChatCount, pendingCount]);

  React.useEffect(() => {
    if (chatMessages.length > 0) {
      const latestMessage = chatMessages[0];
      // Only show toast if it's sent to current user, unviewed, and activeTab isn't chat
      if (
        latestMessage.receiverId === currentUser?.id && 
        !latestMessage.viewedAt && 
        (activeTab !== 'chat' || document.visibilityState === 'hidden' || latestMessage.isPing)
      ) {
         const lastToastedMsg = sessionStorage.getItem('lastToastedMsg');
         if (lastToastedMsg !== latestMessage.id) {
           playSound('receive');
           
           if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
             try {
               const title = latestMessage.isPing ? `עדכון מ${partner?.name || 'הפרטנר'}` : `הודעה חדשה מ${partner?.name || 'הפרטנר'}`;
               const options = {
                 body: latestMessage.isPing ? latestMessage.text : (latestMessage.isViewOnce ? 'תמונה/וידאו במצב דיסקרטי' : 'נכנסה הודעה חדשה בצאט'),
                 icon: '/icon.png',
               };
               
               if ('serviceWorker' in navigator) {
                 navigator.serviceWorker.ready.then(registration => {
                   registration.showNotification(title, options);
                 }).catch(() => {
                   new Notification(title, options);
                 });
               } else {
                 new Notification(title, options);
               }
             } catch (e) {
               console.error('Notification error', e);
             }
           } else if (activeTab !== 'chat' || latestMessage.isPing) {
             import('sonner').then(({ toast }) => {
               if (latestMessage.isPing) {
                 toast.success(`עדכון מ${partner?.name || 'הפרטנר'}: ${latestMessage.text}`);
               } else {
                 toast.success(`הודעה חדשה מ${partner?.name || 'הפרטנר'}`);
               }
             });
           }
           
           sessionStorage.setItem('lastToastedMsg', latestMessage.id);
         }
      }
    }
  }, [chatMessages, activeTab, currentUser?.id, partner?.name]);

  React.useEffect(() => {
    // Check for new responses on sent missions
    const sentMissionsWithResponses = missions.filter(m => m.sender === currentUser?.id && m.response);
    if (sentMissionsWithResponses.length > 0) {
      const latestMission = sentMissionsWithResponses[0];
      const lastToastedResponse = sessionStorage.getItem(`lastToastedResp_${latestMission.id}`);
      
      if (!lastToastedResponse) {
        playSound('receive');
        
        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
          try {
            const title = `${partner?.name || 'הפרטנר'} הגיב/ה למשימה!`;
            const options = {
              body: `תגובה: "${latestMission.response}"`,
              icon: '/icon.png',
            };
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(() => {
                new Notification(title, options);
              });
            } else {
              new Notification(title, options);
            }
          } catch (e) {
            console.error('Notification error', e);
          }
        } else {
          import('sonner').then(({ toast }) => {
            toast.success(`${partner?.name || 'הפרטנר'} הגיב/ה למשימה!`, {
              description: `"${latestMission.response}"`
            });
          });
        }
        
        sessionStorage.setItem(`lastToastedResp_${latestMission.id}`, 'true');
      }
    }
  }, [missions, currentUser?.id, partner?.name]);

  return (
    <div className="h-full w-full flex flex-col font-sans relative overflow-x-hidden">
      <main className={`flex-1 flex flex-col w-full h-full relative ${(activeTab === 'chat' || activeTab === 'vault') ? 'overflow-hidden pb-0' : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}>
        {children}
      </main>
      


      {!isKeyboardOpen && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar transition-all duration-300 ${activeTab === 'chat' ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <button 
          onClick={() => {
            playSound('click');
            setActiveTab('home');
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 px-1 py-2 rounded-2xl flex-1 ${activeTab === 'home' ? 'text-[#4a5568] bg-[#f1f5f9]' : 'text-[#a0aec0] hover:text-[#4a5568]'}`}
        >
          <Home size={20} className={activeTab === 'home' ? 'text-[#FF6B6B]' : ''} />
          <span className="text-[10px] font-bold">בית</span>
        </button>
        
        <button 
          onClick={() => {
            playSound('click');
            setActiveTab('inbox');
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 px-1 py-2 rounded-2xl flex-1 ${activeTab === 'inbox' ? 'text-[#4a5568] bg-[#f1f5f9]' : 'text-[#a0aec0] hover:text-[#4a5568]'}`}
        >
          <div className="relative">
            <Bell size={20} className={activeTab === 'inbox' ? 'text-[#FF6B6B]' : ''} />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] bg-[#FF6B6B] rounded-full text-[10px] flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">התראות</span>
        </button>
        <button 
          onClick={() => {
            playSound('click');
            setActiveTab('chat');
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 px-1 py-2 rounded-2xl flex-1 ${(activeTab as string) === 'chat' ? 'text-[#4a5568] bg-[#f1f5f9]' : 'text-[#a0aec0] hover:text-[#4a5568]'}`}
        >
          <div className="relative">
            <MessageCircle size={20} className={(activeTab as string) === 'chat' ? 'text-[#FF6B6B]' : ''} />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] bg-[#FF6B6B] rounded-full text-[10px] flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
                {unreadChatCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">צ'אט</span>
        </button>

        <button 
          onClick={() => {
            playSound('click');
            setActiveTab('games');
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 px-1 py-2 rounded-2xl flex-1 ${activeTab === 'games' ? 'text-[#4a5568] bg-[#f1f5f9]' : 'text-[#a0aec0] hover:text-[#4a5568]'}`}
        >
          <div className="relative">
            <Gamepad2 size={20} className={activeTab === 'games' ? 'text-[#FF6B6B]' : ''} />
            {hasGameTurn && (
              <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] bg-[#FF6B6B] rounded-full text-[10px] flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">{myTurnGames.length}</span>
            )}
          </div>
          <span className="text-[10px] font-bold">משחק</span>
        </button>

        <button 
          onClick={() => {
            playSound('click');
            setActiveTab('vault');
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 px-1 py-2 rounded-2xl flex-1 ${activeTab === 'vault' ? 'text-[#4a5568] bg-[#f1f5f9]' : 'text-[#a0aec0] hover:text-[#4a5568]'}`}
        >
          <FolderLock size={20} className={activeTab === 'vault' ? 'text-[#FF6B6B]' : ''} />
          <span className="text-[10px] font-bold">כספת</span>
        </button>

        <button 
          onClick={() => {
            playSound('click');
            setActiveTab('settings');
          }}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 px-1 py-2 rounded-2xl flex-1 ${activeTab === 'settings' ? 'text-[#4a5568] bg-[#f1f5f9]' : 'text-[#a0aec0] hover:text-[#4a5568]'}`}
        >
          <Settings size={20} className={activeTab === 'settings' ? 'text-[#FF6B6B]' : ''} />
          <span className="text-[10px] font-bold">הגדרות</span>
        </button>
      </div>
      )}
    </div>
  );
}
