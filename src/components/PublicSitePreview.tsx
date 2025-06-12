import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X as Close } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
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
  const [projectsWithPosts, setProjectsWithPosts] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all posts for all projects when component mounts
  useEffect(() => {
    const loadAllContent = async () => {
      try {
        setLoading(true);
        const projectsWithLoadedPosts = await Promise.all(
          projects.map(async (project) => {
            try {
              const posts = await invoke<Post[]>('list_posts', {
                projectName: project.folder_name,
              });
              return { ...project, posts };
            } catch (error) {
              console.error(`Failed to load posts for project ${project.name}:`, error);
              return { ...project, posts: [] };
            }
          })
        );
        setProjectsWithPosts(projectsWithLoadedPosts);
      } catch (error) {
        console.error('Failed to load project content:', error);
        setProjectsWithPosts(projects);
      } finally {
        setLoading(false);
      }
    };

    loadAllContent();
  }, [projects]);

  const loadFullPost = async (project: Project, post: Post) => {
    try {
      const fullPost = await invoke<Post>('read_post', {
        projectName: project.folder_name,
        slug: post.slug,
      });
      setView({ type: 'post', project, post: fullPost });
    } catch (error) {
      console.error('Failed to load full post:', error);
      setView({ type: 'post', project, post });
    }
  };

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
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-500">Loading content...</div>
          </div>
        ) : (
          <>
            {view.type === 'home' && (
              <div className="max-w-6xl w-full">
                <h1 className="text-3xl font-bold mb-8 text-center">{studioName}</h1>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                  {projectsWithPosts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setView({ type: 'project', project: p })}
                      className="cursor-pointer rounded-2xl border bg-neutral-50 p-6 shadow-sm transition hover:shadow-md"
                    >
                      <h3 className="text-lg font-semibold">{p.label}</h3>
                      <p className="mt-2 text-xs text-neutral-500">{p.posts.length} posts</p>
                      {p.posts.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-neutral-600 font-medium">Recent posts:</p>
                          <ul className="mt-1 space-y-1">
                            {p.posts.slice(0, 3).map((post) => (
                              <li key={post.slug} className="text-xs text-neutral-500 truncate">
                                • {post.title}
                              </li>
                            ))}
                          </ul>
                          {p.posts.length > 3 && (
                            <p className="text-xs text-neutral-400 mt-1">+{p.posts.length - 3} more</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {projectsWithPosts.length === 0 && (
                  <div className="text-center text-neutral-500 mt-12">
                    <p>No projects found</p>
                    <p className="text-sm mt-2">Create your first project to get started!</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {view.type === 'project' && (
          <div className="max-w-6xl w-full">
            <h2 className="mb-6 text-2xl font-semibold">{view.project.label}</h2>
            {view.project.posts.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {view.project.posts.map((post) => (
                  <div
                    key={post.slug}
                    onClick={() => loadFullPost(view.project, post)}
                    className="cursor-pointer rounded-xl border bg-neutral-50 p-5 shadow-sm transition hover:shadow-md"
                  >
                    <h3 className="font-medium text-neutral-900">{post.title}</h3>
                    <p className="text-xs text-neutral-500 mt-2">{post.filename} • Click to read</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-neutral-500 py-12">
                <p>No posts in this project yet</p>
                <p className="text-sm mt-2">Posts will appear here once you create them</p>
              </div>
            )}
          </div>
        )}
        {view.type === 'post' && (
          <div className="max-w-[700px] w-full mx-auto">
            <div className="mb-4">
              <p className="text-sm text-neutral-500">
                {view.project.label} • {view.post.filename}
              </p>
            </div>
            <h1 className="mb-6 text-3xl font-bold text-left">{view.post.title}</h1>
            <div className="prose prose-neutral max-w-none text-left">
              {view.post.content ? (
                <div
                  className="text-neutral-700 leading-relaxed text-left"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(view.post.content) }}
                />
              ) : (
                <div className="text-center text-neutral-500 py-12">
                  <p>No content available</p>
                  <p className="text-sm mt-2">This post appears to be empty</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
