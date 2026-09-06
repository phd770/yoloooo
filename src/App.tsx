/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AppProvider, useApp } from './lib/store';
import { UserSelect } from './components/UserSelect';
import { Dashboard } from './components/Dashboard';
import { Toaster } from 'sonner';

function MainApp() {
  const { currentUser, setCurrentUser } = useApp();

  useEffect(() => {
    if (!currentUser) return;

    let timeout: NodeJS.Timeout;
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours (much smoother chatting experience)

    const logout = () => {
      setCurrentUser(null);
    };

    const resetTimer = () => {
      const lastActivity = parseInt(localStorage.getItem('last_activity') || '0', 10);
      if (lastActivity > 0 && Date.now() - lastActivity > SESSION_TIMEOUT) {
        logout();
        return;
      }
      localStorage.setItem('last_activity', Date.now().toString());
      clearTimeout(timeout);
      timeout = setTimeout(logout, SESSION_TIMEOUT);
    };

    const intervalId = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('last_activity') || '0', 10);
      if (lastActivity > 0 && Date.now() - lastActivity > SESSION_TIMEOUT) {
        logout();
      }
    }, 1000);

    const checkTimeoutOnVisibility = () => {
      if (document.visibilityState === 'visible') {
        const lastActivity = parseInt(localStorage.getItem('last_activity') || '0', 10);
        if (Date.now() - lastActivity > SESSION_TIMEOUT) {
          logout();
        } else {
          resetTimer();
        }
      }
    };

    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });
    
    document.addEventListener('visibilitychange', checkTimeoutOnVisibility);
    window.addEventListener('focus', checkTimeoutOnVisibility);

    resetTimer();

    return () => {
      clearTimeout(timeout);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkTimeoutOnVisibility);
      window.removeEventListener('focus', checkTimeoutOnVisibility);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [currentUser?.id, setCurrentUser]); // Only re-run if the user ID changes

  return (
    <div className="fixed inset-0 w-full h-full bg-background text-foreground selection:bg-primary/30 flex flex-col overflow-hidden">
      {!currentUser ? <UserSelect /> : <Dashboard />}
      <Toaster position="top-center" richColors theme="light" />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
