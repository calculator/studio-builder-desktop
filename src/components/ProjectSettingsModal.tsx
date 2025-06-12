import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Project } from '../types';

interface ProjectSettingsModalProps {
  project: Project;
  onClose: () => void;
  onDelete: () => void;
}

export default function ProjectSettingsModal({ project, onClose, onDelete }: ProjectSettingsModalProps) {
  const [title, setTitle] = useState(project.label);
  const [description, setDescription] = useState(project.description || '');
  const [intention, setIntention] = useState(project.intention || '');
  const [postRecipe, setPostRecipe] = useState<string[]>(project.postRecipe || ['Title', 'Date', 'Related', 'Image']);

  const addRecipeField = () => {
    setPostRecipe([...postRecipe, 'New Field']);
  };

  const updateRecipeField = (index: number, value: string) => {
    const updated = [...postRecipe];
    updated[index] = value;
    setPostRecipe(updated);
  };

  const removeRecipeField = (index: number) => {
    setPostRecipe(postRecipe.filter((_, i) => i !== index));
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${project.label}"? This action cannot be undone.`)) {
      onDelete();
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-90 flex items-center justify-start bg-neutral-950/90 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative h-screen w-[50vw] bg-neutral-900 p-8 shadow-lg overflow-auto"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      >
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200"
            aria-label="Back"
          >
            <div className="text-white">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6"></path>
              </svg>
            </div>
            <span className="text-white">Back</span>
          </button>

          <h2 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold text-white">
            Project Settings
          </h2>

          <div></div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2 text-left">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-neutral-800 p-3 text-white border border-neutral-700 focus:border-blue-500 focus:outline-none"
              placeholder="Enter project title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2 text-left">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg bg-neutral-800 p-3 text-white border border-neutral-700 focus:border-blue-500 focus:outline-none resize-none"
              rows={3}
              placeholder="Brief description of this project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2 text-left">Intention</label>
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              className="w-full rounded-lg bg-neutral-800 p-3 text-white border border-neutral-700 focus:border-blue-500 focus:outline-none resize-none"
              rows={2}
              placeholder="What do you hope to achieve with this project?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2 text-left">Post Recipe</label>
            <div className="rounded-lg bg-neutral-800 p-4 border border-neutral-700">
              <div className="space-y-3">
                {postRecipe.map((field, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      value={field}
                      onChange={(e) => updateRecipeField(index, e.target.value)}
                      className="flex-1 bg-transparent text-white text-sm border-none focus:outline-none"
                      placeholder="Field name"
                    />
                    {postRecipe.length > 1 && (
                      <button
                        onClick={() => removeRecipeField(index)}
                        className="text-neutral-500 hover:text-neutral-300 text-xs"
                        aria-label="Remove field"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addRecipeField}
                className="mt-4 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors"
                aria-label="Add field"
              >
                <div className="text-white">
                  <Plus size={16} />
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-700">
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 bg-black hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Delete Project
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
