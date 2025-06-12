import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { polar } from '../utils';

interface RadialMenuProps {
  open: boolean;
  actions: { icon: any; label: string; onClick: () => void }[];
}

export default function RadialMenu({ open, actions }: RadialMenuProps) {
  const radius = 80;
  const offsetFor = (index: number) => {
    if (actions.length === 1 || index === 0) return { x: 0, y: -radius };
    if (index === 1) return { x: -radius, y: 0 };
    // fallback (shouldn't happen with 2 buttons)
    const { x, y } = polar(radius, (360 / actions.length) * index);
    return { x: -x, y: -y };
  };

  return (
    <AnimatePresence>
      {open &&
        actions.map((action, i) => {
          const pos = offsetFor(i);
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              onClick={action.onClick}
              aria-label={action.label}
              className="fixed bottom-8 right-8 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-100 shadow-lg"
              style={{
                translateX: pos.x,
                translateY: pos.y,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 18 }}
            >
              <div className="text-white">
                <Icon size={16} />
              </div>
            </motion.button>
          );
        })}
    </AnimatePresence>
  );
}
