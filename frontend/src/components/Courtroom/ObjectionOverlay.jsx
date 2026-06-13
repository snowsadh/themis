import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { playObjection } from '../../utils/audio';

export default function ObjectionOverlay({ name }) {
  useEffect(() => {
    playObjection();
  }, []);

  return (
    <motion.div 
      className="objection-overlay"
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="objection-card"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ 
          scale: [1.5, 0.9, 1.1, 1], 
          rotate: [10, -10, 5, 0], 
          x: [0, -30, 30, -15, 15, 0] 
        }}
        transition={{ duration: 0.6, type: 'spring' }}
      >
        <div className="objection-icon">🚫</div>
        <div className="objection-text">OBJECTION!</div>
        <div className="objection-by">Raised by {name}</div>
      </motion.div>
    </motion.div>
  );
}
