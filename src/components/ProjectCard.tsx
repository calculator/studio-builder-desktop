import React from 'react';
import { motion } from 'framer-motion';
import { Project } from '../types';

interface ProjectCardProps {
  project: Project;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onOpen: (p: Project, cardPosition: { x: number; y: number }) => void;
  updatePos: (id: string, x: number, y: number) => void;
}

export default function ProjectCard({ project, containerRef, onOpen, updatePos }: ProjectCardProps) {
  const handleOpen = () => {
    // Calculate the absolute position of the project card on screen
    const cardPosition = {
      x: window.innerWidth / 2 + project.x,
      y: window.innerHeight / 2 + project.y,
    };
    onOpen(project, cardPosition);
  };

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-2xl bg-white/10 text-xs backdrop-blur-lg active:cursor-grabbing"
      style={{ translateX: project.x, translateY: project.y }}
      drag
      dragMomentum={false}
      dragTransition={{ power: 0, timeConstant: 0 }}
      dragElastic={0}
      dragConstraints={containerRef}
      onDoubleClick={handleOpen}
      onDragEnd={(_, info) => {
        const newX = project.x + info.offset.x;
        const newY = project.y + info.offset.y;
        updatePos(project.id, newX, newY);
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
