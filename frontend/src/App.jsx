import { useEffect } from "react";
import { AnimatePresence, motion as Motion, MotionConfig } from "framer-motion";
import { useGameStore, GAME_PHASES } from "./store/gameStore";
import Lobby from "./components/Lobby/Lobby";
import Courtroom from "./components/Courtroom/Courtroom";
import Verdict from "./components/Verdict/Verdict";

export default function App() {
  const { phase, theme } = useGameStore();
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <Motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {phase === GAME_PHASES.COURTROOM ? (
            <Courtroom />
          ) : phase === GAME_PHASES.VERDICT ? (
            <Verdict />
          ) : (
            <Lobby />
          )}
        </Motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
