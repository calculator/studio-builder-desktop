import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X as Close } from 'lucide-react';
import { Project, Post } from '../types';
import { parseMarkdown } from '../utils';

interface PublicSitePreviewProps {
  studioName: string;
  projects: Project[];
  onClose: () => void;
}

type View = { type: 'home' } | { type: 'project'; project: Project } | { type: 'post'; project: Project; post: Post };

export default function PublicSitePreview({ studioName, projects, onClose }: PublicSitePreviewProps) {
  const [view, setView] = useState<View>({ type: 'home' });

  const back = () => {
    if (view.type === 'post') setView({ type: 'project', project: view.project });
    else if (view.type === 'project') setView({ type: 'home' });
    else onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-60 flex flex-col bg-white text-neutral-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between border-b px-6 py-4 text-sm font-medium">
        <button onClick={back} className="flex items-center gap-1 text-neutral-500 hover:text-neutral-800 bg-white">
          <div className="text-neutral-500">
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
          Back
        </button>
        <span>{studioName}</span>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="text-neutral-500 hover:text-neutral-800 bg-white"
        >
          <div className="text-neutral-500">
            <Close size={18} />
          </div>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-8 flex justify-center">
        {view.type === 'home' && (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 max-w-6xl w-full">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => setView({ type: 'project', project: p })}
                className="cursor-pointer rounded-2xl border bg-neutral-50 p-6 shadow-sm transition hover:shadow-md"
              >
                <h3 className="text-lg font-semibold">{p.label}</h3>
                <p className="mt-2 text-xs text-neutral-500">{p.posts.length} posts</p>
              </div>
            ))}
          </div>
        )}
        {view.type === 'project' && (
          <div className="max-w-6xl w-full">
            <h2 className="mb-6 text-2xl font-semibold">{view.project.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {view.project.posts.map((post) => (
                <div
                  key={post.slug}
                  onClick={() => setView({ type: 'post', project: view.project, post })}
                  className="cursor-pointer rounded-xl border bg-neutral-50 p-5 shadow-sm transition hover:shadow-md"
                >
                  {post.title}
                </div>
              ))}
            </div>
          </div>
        )}
        {view.type === 'post' && (
          <div className="max-w-[700px] w-full mx-auto">
            <h1 className="mb-6 text-3xl font-bold text-left">{view.post.title}</h1>
            <div className="prose prose-neutral max-w-none text-left">
              {view.post.content ? (
                <div
                  className="text-neutral-700 leading-relaxed text-left"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(view.post.content) }}
                />
              ) : (
                <p className="text-sm text-neutral-500 text-left">No content available</p>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
