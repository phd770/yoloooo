import React, { useState } from 'react';
import { Layout } from './Layout';
import { Home } from './Home';
import { Inbox } from './Inbox';
import { Settings } from './Settings';
import { DiscreteChat } from './DiscreteChat';
import { Vault } from './Vault';
import { Games } from './Games';
import { useApp } from '../lib/store';
import { AnimatePresence, motion } from 'motion/react';

type DashboardTab = 'home' | 'inbox' | 'settings' | 'chat' | 'vault' | 'games';

export function Dashboard() {
  const { currentUser, partner, missions } = useApp();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    try {
      const savedTab = localStorage.getItem('dateapp_active_tab');
      return savedTab && ['home', 'inbox', 'settings', 'chat', 'vault', 'games'].includes(savedTab)
        ? savedTab as DashboardTab
        : 'home';
    } catch {
      return 'home';
    }
  });

  React.useEffect(() => {
    localStorage.setItem('dateapp_active_tab', activeTab);
  }, [activeTab]);

  React.useEffect(() => {
    console.log("Dashboard State:", { 
      currentUser: currentUser?.id, 
      partner: partner?.id, 
      missionsCount: missions.length 
    });
  }, [currentUser, partner, missions.length]);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="h-full w-full"
        >
          {activeTab === 'home' && <Home onNavigate={setActiveTab} />}
          {activeTab === 'inbox' && <Inbox />}
          {activeTab === 'chat' && <DiscreteChat onBack={() => setActiveTab('home')} onNavigate={setActiveTab} />}
          {activeTab === 'vault' && <Vault />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'games' && <Games />}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
