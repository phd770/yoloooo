import React, { useState } from 'react';
import { Layout } from './Layout';
import { Home } from './Home';
import { Inbox } from './Inbox';
import { Settings } from './Settings';
import { DiscreteChat } from './DiscreteChat';
import { Vault } from './Vault';
import { Games } from './Games';
import { useApp } from '../lib/store';

export function Dashboard() {
  const { currentUser, partner, missions } = useApp();
  const [activeTab, setActiveTab] = useState<'home' | 'inbox' | 'settings' | 'chat' | 'vault' | 'games'>('home');

  React.useEffect(() => {
    console.log("Dashboard State:", { 
      currentUser: currentUser?.id, 
      partner: partner?.id, 
      missionsCount: missions.length 
    });
  }, [currentUser, partner, missions.length]);

  return (
    <Layout activeTab={activeTab as any} setActiveTab={setActiveTab as any}>
      {activeTab === 'home' && <Home onNavigate={setActiveTab as any} />}
      {activeTab === 'inbox' && <Inbox />}
      {activeTab === 'chat' && <DiscreteChat onBack={() => setActiveTab('home')} onNavigate={setActiveTab as any} />}
      {activeTab === 'vault' && <Vault />}
      {activeTab === 'settings' && <Settings />}
      {activeTab === 'games' && <Games />}
    </Layout>
  );
}
