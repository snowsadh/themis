import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore, GAME_PHASES } from './store/gameStore';
import Lobby from './components/Lobby/Lobby';
import Courtroom from './components/Courtroom/Courtroom';
import Verdict from './components/Verdict/Verdict';
import Spotlight from './components/Spotlight';

function App() {
  const { phase, theme, toggleTheme } = useGameStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <Spotlight />
      <AnimatePresence mode="wait">
        {(phase === GAME_PHASES.LOBBY || phase === GAME_PHASES.CASE_SELECT) && (
          <motion.div 
            key="lobby" 
            initial={{ opacity: 0, scale: 0.97, filter: 'blur(10px)' }} 
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} 
            exit={{ opacity: 0, scale: 1.03, filter: 'blur(10px)' }} 
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} 
            style={{ width: '100%', height: '100%' }}
          >
            <Lobby />
          </motion.div>
        )}
        {phase === GAME_PHASES.COURTROOM && (
          <motion.div 
            key="courtroom" 
            initial={{ opacity: 0, scale: 0.97, filter: 'blur(10px)' }} 
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} 
            exit={{ opacity: 0, scale: 1.03, filter: 'blur(10px)' }} 
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} 
            style={{ width: '100%', height: '100%' }}
          >
            <Courtroom />
          </motion.div>
        )}
        {phase === GAME_PHASES.VERDICT && (
          <motion.div 
            key="verdict" 
            initial={{ opacity: 0, scale: 0.97, filter: 'blur(10px)' }} 
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} 
            exit={{ opacity: 0, scale: 1.03, filter: 'blur(10px)' }} 
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} 
            style={{ width: '100%', height: '100%' }}
          >
            <Verdict />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
