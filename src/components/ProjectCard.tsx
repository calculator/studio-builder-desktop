import React from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Project } from '../types';

interface ProjectCardProps {
  project: Project;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onOpen: (p: Project, cardPosition: { x: number; y: number }) => void;
  updatePos: (id: string, x: number, y: number) => void;
}

export default function ProjectCard({ project, containerRef, onOpen, updatePos }: ProjectCardProps) {
  const x = useMotionValue(project.x);
  const y = useMotionValue(project.y);

  // Update motion values when project position changes
  React.useEffect(() => {
    x.set(project.x);
    y.set(project.y);
  }, [project.x, project.y, x, y]);

  const handleOpen = () => {
    // Calculate the absolute position of the project card on screen
    const cardPosition = {
      x: window.innerWidth / 2 + x.get(),
      y: window.innerHeight / 2 + y.get(),
    };
    onOpen(project, cardPosition);
  };

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-2xl bg-white/10 text-xs backdrop-blur-lg active:cursor-grabbing"
      style={{ x, y }}
      drag
      dragMomentum={false}
      dragTransition={{ power: 0, timeConstant: 0 }}
      dragElastic={0}
      dragConstraints={containerRef}
      onDoubleClick={handleOpen}
      onDragEnd={() => {
        // Update the project position with the current motion values
        updatePos(project.id, x.get(), y.get());
      }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {project.label}
    </motion.div>
  );
}
