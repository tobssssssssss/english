import { useState, useEffect } from 'react';
import { type Player, type PracticeMode, type InputMode } from '@/lib/supabase';
import Login from '@/components/Login';
import Home from '@/components/Home';
import Practice from '@/components/Practice';
import Admin from '@/components/Admin';

type Screen = 'login' | 'home' | 'practice' | 'admin';

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('mix');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [selectedVerbs, setSelectedVerbs] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem('verb_player');
    if (saved) {
      try {
        const p = JSON.parse(saved) as Player;
        setPlayer(p);
        setScreen('home');
      } catch {
        localStorage.removeItem('verb_player');
      }
    }
  }, []);

  const handleLogin = (p: Player) => {
    localStorage.setItem('verb_player', JSON.stringify(p));
    setPlayer(p);
    setScreen('home');
  };

  const startPractice = (mode: PracticeMode, im: InputMode, verbs?: string[]) => {
    setPracticeMode(mode);
    setInputMode(im);
    setSelectedVerbs(verbs);
    setScreen('practice');
  };

  if (!player || screen === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (screen === 'practice') {
    return (
      <Practice
        player={player}
        mode={practiceMode}
        inputMode={inputMode}
        selectedVerbIds={selectedVerbs}
        onExit={() => setScreen('home')}
      />
    );
  }

  if (screen === 'admin' && player.is_admin) {
    return <Admin onExit={() => setScreen('home')} />;
  }

  return (
    <Home
      player={player}
      onStartPractice={startPractice}
      onOpenAdmin={() => setScreen('admin')}
    />
  );
}
