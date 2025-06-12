import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Project, Post } from '../types';
import PostEditor from './PostEditor';

interface ProjectEditorProps {
  project: Project;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
  onDeleteProject: (id: string) => void;
  onUpdateProject?: (updatedProject: Project) => void;
}

export default function ProjectEditor({ project, onClose, initialPosition, onUpdateProject }: ProjectEditorProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(project.label);
  const [currentProjectName, setCurrentProjectName] = useState(project.name || project.label);

  // Load posts when component mounts or project changes
  useEffect(() => {
    setCurrentProjectName(project.name || project.label);
    loadPosts();
  }, [project.folder_name, project.name, project.label]);

  // Update edited title when project changes (for navigation)
  useEffect(() => {
    setEditedTitle(project.label);
  }, [project.label]);

  const loadPosts = async () => {
    if (!project.folder_name) return;

    try {
      setLoading(true);
      const result = await invoke<Post[]>('list_posts', { projectName: project.folder_name });
      setPosts(result);
      if (result.length > 0 && !openPost) {
        setOpenPost(result[0]);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    console.log('createPost called, project folder_name:', project.folder_name);
    if (!project.folder_name) {
      console.error('No project folder name available');
      alert('Error: No project folder name available');
      return;
    }

    try {
      const title = 'Untitled Post';
      console.log('Creating post with title:', title, 'for project:', project.folder_name);
      const newPost = await invoke<Post>('create_post', {
        projectName: project.folder_name,
        title,
      });
      console.log('Post created successfully:', newPost);
      setPosts((prev) => [...prev, newPost]);
      setOpenPost(newPost);
    } catch (error) {
      console.error('Failed to create post:', error);
      alert(`Failed to create post: ${error}`);
    }
  };

  const savePost = async (content: string) => {
    if (!openPost || !project.folder_name) return;

    try {
      await invoke('update_post', {
        projectName: project.folder_name,
        slug: openPost.slug,
        content,
      });

      // Extract title from the updated content
      const updatedTitle = extractTitleFromContent(content);

      // Update both the post content and title in state
      setPosts((prev) =>
        prev.map((post) => (post.slug === openPost.slug ? { ...post, content, title: updatedTitle } : post))
      );
      setOpenPost((prev) => (prev ? { ...prev, content, title: updatedTitle } : null));
    } catch (error) {
      console.error('Failed to save post:', error);
      throw error;
    }
  };

  const extractTitleFromContent = (content: string): string => {
    // Check if content has frontmatter
    if (content.startsWith('---\n')) {
      const frontmatterEnd = content.indexOf('\n---\n', 4);
      if (frontmatterEnd !== -1) {
        const frontmatter = content.substring(4, frontmatterEnd);
        const titleMatch = frontmatter.match(/^title:\s*"?([^"]*)"?$/m);
        if (titleMatch) {
          return titleMatch[1];
        }
      }
    }

    // Fallback to first heading or default
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1];
    }

    return 'Untitled Post';
  };

  const deletePost = async () => {
    console.log('deletePost called, openPost:', openPost, 'project folder_name:', project.folder_name);
    if (!openPost || !project.folder_name) {
      console.error('Missing openPost or project folder_name');
      return;
    }

    try {
      console.log('Deleting post:', openPost.slug, 'from project:', project.folder_name);
      await invoke('delete_post', {
        projectName: project.folder_name,
        slug: openPost.slug,
      });
      console.log('Post deleted successfully');

      setPosts((prev) => prev.filter((post) => post.slug !== openPost.slug));
      setOpenPost(null);
    } catch (error) {
      console.error('Failed to delete post:', error);
      throw error;
    }
  };

  const selectPost = async (post: Post) => {
    if (!project.folder_name) return;

    try {
      const fullPost = await invoke<Post>('read_post', {
        projectName: project.folder_name,
        slug: post.slug,
      });
      setOpenPost(fullPost);
    } catch (error) {
      console.error('Failed to read post:', error);
    }
  };

  const startEditingTitle = () => {
    setIsEditingTitle(true);
    setEditedTitle(project.label);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle(project.label);
  };

  const saveTitle = async () => {
    if (!currentProjectName || editedTitle.trim() === '') return;

    const newDisplayName = editedTitle.trim();

    try {
      // Call backend to rename the project (passing folder_name and new display name)
      const updatedProjectFromBackend = await invoke<{ name: string; folder_name: string; path: string }>(
        'rename_project',
        {
          oldFolderName: project.folder_name,
          newDisplayName: newDisplayName,
        }
      );

      // Update the project locally with the complete information from backend
      const updatedProject = {
        ...project,
        label: updatedProjectFromBackend.name,
        name: updatedProjectFromBackend.name,
        folder_name: updatedProjectFromBackend.folder_name,
        path: updatedProjectFromBackend.path,
      };

      // Update local state first
      setCurrentProjectName(updatedProjectFromBackend.name);

      // Notify parent component of the change
      if (onUpdateProject) {
        onUpdateProject(updatedProject);
      }

      // Reload posts with the updated project information
      await loadPosts();

      setIsEditingTitle(false);
      console.log(`✅ Project renamed to: ${newDisplayName} (folder: ${updatedProjectFromBackend.folder_name})`);
    } catch (error) {
      console.error('Failed to rename project:', error);
      alert(`❌ Failed to rename project: ${error}`);
      // Revert on error
      setEditedTitle(project.label);
    }
  };

  return (
    <motion.div
      className="relative h-screen w-screen bg-neutral-900 shadow-xl overflow-hidden flex"
      initial={
        initialPosition
          ? {
              scale: 0,
              x: initialPosition.x - window.innerWidth / 2,
              y: initialPosition.y - window.innerHeight / 2,
            }
          : { scale: 0 }
      }
      animate={{ scale: 1, x: 0, y: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {/* Left Column - Project Posts */}
      <div className="w-1/2 p-8 border-r border-neutral-700 overflow-auto relative">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200"
            aria-label="Back to dashboard"
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

          <div className="flex items-center gap-3 relative">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-xl text-center font-semibold bg-neutral-800 text-white border border-neutral-600 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') cancelEditingTitle();
                }}
                onBlur={cancelEditingTitle}
                placeholder="Enter project name"
              />
            ) : (
              <h2
                className="text-xl font-semibold cursor-pointer hover:text-blue-400 transition-colors"
                onClick={startEditingTitle}
                title="Click to edit project name"
              >
                {project.label}
              </h2>
            )}
          </div>

          <button
            onClick={createPost}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50/10 backdrop-blur-lg shadow-md transition active:scale-90"
            aria-label="New Post"
          >
            <div className="text-white">
              <Plus size={18} />
            </div>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-neutral-500">Loading posts...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {posts.map((post) => (
              <motion.div
                key={post.slug}
                className={`relative flex cursor-pointer items-center justify-center rounded-xl p-6 text-sm backdrop-blur-lg transition-colors ${
                  openPost?.slug === post.slug
                    ? 'bg-blue-600/30 border border-blue-400'
                    : 'bg-white/10 hover:bg-white/15'
                }`}
                whileHover={{ scale: 1.02 }}
                onClick={() => selectPost(post)}
              >
                {post.title}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column - Post Editor */}
      <div className="w-1/2 bg-neutral-800/50 relative">
        {openPost ? (
          <PostEditor post={openPost} onClose={() => setOpenPost(null)} onSave={savePost} onDelete={deletePost} />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📝</div>
              <p>No posts yet</p>
              <button
                onClick={createPost}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create your first post
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
