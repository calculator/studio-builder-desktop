import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderPlus, Eye, X as Close } from 'lucide-react';
import { writeTextFile, BaseDirectory, mkdir, exists, readDir, copyFile } from '@tauri-apps/plugin-fs';
import { resolveResource } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';

/* ──────────────────────────────────────────────────────────
   Utilities & Types
────────────────────────────────────────────────────────── */
const polar = (r: number, angleDeg: number) => {
  const angle = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
  };
};

interface Post {
  id: string;
  title: string;
  body?: string;
}

interface Project {
  id: string;
  label: string;
  x: number;
  y: number;
  posts: Post[];
  description?: string;
  intention?: string;
  postRecipe?: string[];
  // Add fields from Rust struct
  name?: string;
  path?: string;
}

/* ──────────────────────────────────────────────────────────
   Orbiting Project Card (Dashboard)
────────────────────────────────────────────────────────── */
function ProjectCard({
  project,
  containerRef,
  onOpen,
  updatePos,
}: {
  project: Project;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onOpen: (p: Project, cardPosition: { x: number; y: number }) => void;
  updatePos: (id: string, x: number, y: number) => void;
}) {
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

/* ──────────────────────────────────────────────────────────
   Radial ORB Menu (2‑button layout)
────────────────────────────────────────────────────────── */
function RadialMenu({
  open,
  actions,
}: {
  open: boolean;
  actions: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void }[];
}) {
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

/* ──────────────────────────────────────────────────────────
   Post Editor (unchanged)
────────────────────────────────────────────────────────── */
function PostEditor({ post, onClose }: { post: Post; onClose: () => void }) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body ?? '');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  // Update local state when post prop changes
  useEffect(() => {
    setTitle(post.title);
    setBody(post.body ?? '');
  }, [post]);

  const handlePublish = () => {
    // Update the post with current values
    post.title = title;
    post.body = body;
    // You could add publish logic here (API calls, etc.)
    console.log('Publishing post:', { title, body });
  };

  return (
    <div className="h-full w-full p-8 flex flex-col">
      <button
        onClick={handlePublish}
        className="absolute right-4 top-4 px-4 py-2 bg-black text-sm text-white rounded-lg transition-colors"
        aria-label="Publish post"
      >
        Publish
      </button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        className="mb-6 w-full border-none bg-transparent text-2xl font-semibold text-neutral-50 placeholder-neutral-500 focus:ring-0 flex-shrink-0"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write in markdown…"
        className="flex-1 w-full resize-none rounded-lg bg-neutral-800/40 p-4 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Project Settings Modal
────────────────────────────────────────────────────────── */
function ProjectSettingsModal({
  project,
  onClose,
  onDelete,
}: {
  project: Project;
  onClose: () => void;
  onDelete: () => void;
}) {
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

/* ──────────────────────────────────────────────────────────
   Project Editor (inside modal) – two column layout
────────────────────────────────────────────────────────── */
function ProjectEditor({
  project,
  onClose,
  initialPosition,
  onDeleteProject,
}: {
  project: Project;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
  onDeleteProject: (id: string) => void;
}) {
  const [posts, setPosts] = useState<Post[]>(project.posts);
  const [openPost, setOpenPost] = useState<Post | null>(posts.length > 0 ? posts[0] : null);
  const [showSettings, setShowSettings] = useState(false);

  const addPost = () => {
    const newPost = { id: Date.now().toString(), title: `Post ${posts.length + 1}` };
    setPosts((prev) => [...prev, newPost]);
    project.posts.push(newPost);
    // Auto-select the newly created post
    setOpenPost(newPost);
  };

  const handleDeleteProject = () => {
    onDeleteProject(project.id);
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

          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{project.label}</h2>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
              aria-label="Project settings"
            >
              <div className="text-white">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </div>
            </button>
          </div>

          <button
            onClick={addPost}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50/10 backdrop-blur-lg shadow-md transition active:scale-90"
            aria-label="New Post"
          >
            <div className="text-white">
              <Plus size={18} />
            </div>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              className={`relative flex cursor-pointer items-center justify-center rounded-xl p-6 text-sm backdrop-blur-lg transition-colors ${
                openPost?.id === post.id ? 'bg-blue-600/30 border border-blue-400' : 'bg-white/10 hover:bg-white/15'
              }`}
              whileHover={{ scale: 1.02 }}
              onClick={() => setOpenPost(post)}
            >
              {post.title}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Column - Post Editor */}
      <div className="w-1/2 bg-neutral-800/50 relative">
        {openPost ? (
          <PostEditor post={openPost} onClose={() => setOpenPost(null)} />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📝</div>
              <p>No posts yet</p>
              <button
                onClick={addPost}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create your first post
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <ProjectSettingsModal
            project={project}
            onClose={() => setShowSettings(false)}
            onDelete={handleDeleteProject}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────
   Simple Markdown Parser
────────────────────────────────────────────────────────── */
function parseMarkdown(markdown: string): string {
  if (!markdown) return '';

  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-3 mt-6">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-4 mt-6">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 mt-6">$1</h1>')

    // Bold and Italic
    .replace(/\*\*(.*)\**/gim, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.*)\*/gim, '<em class="italic">$1</em>')

    // Code blocks
    .replace(
      /```([\s\S]*?)```/gim,
      '<pre class="bg-neutral-100 p-3 rounded text-sm font-mono my-4 overflow-x-auto"><code>$1</code></pre>'
    )

    // Inline code
    .replace(/`([^`]*)`/gim, '<code class="bg-neutral-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')

    // Quotes
    .replace(
      /^> (.*$)/gim,
      '<blockquote class="border-l-4 border-neutral-300 pl-4 py-2 my-4 italic text-neutral-600">$1</blockquote>'
    )

    // Lists
    .replace(/^- (.*$)/gim, '<li class="ml-4 mb-1">• $1</li>')

    // Line breaks
    .replace(/\n\n/gim, '</p><p class="mb-4">')
    .replace(/\n/gim, '<br>');

  // Wrap in paragraphs
  html = '<p class="mb-4">' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p class="mb-4"><\/p>/gim, '');

  return html;
}

/* ──────────────────────────────────────────────────────────
   Public Site Preview (unchanged)
────────────────────────────────────────────────────────── */
function PublicSitePreview({
  studioName,
  projects,
  onClose,
}: {
  studioName: string;
  projects: Project[];
  onClose: () => void;
}) {
  type View = { type: 'home' } | { type: 'project'; project: Project } | { type: 'post'; project: Project; post: Post };
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
                  key={post.id}
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
              {view.post.body ? (
                <div
                  className="text-neutral-700 leading-relaxed text-left"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(view.post.body) }}
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

/* ──────────────────────────────────────────────────────────
   MAIN – Studio Dashboard
────────────────────────────────────────────────────────── */
export default function StudioDashboard() {
  // State for projects - now loaded dynamically
  const [projects, setProjects] = useState<Project[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openProj, setOpenProj] = useState<{ project: Project; position?: { x: number; y: number } } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // First launch handler - sets up studio workspace
  const initializeStudio = async () => {
    try {
      console.log('Checking studio workspace...');

      // Define the canonical studio location: ~/Documents/studio/
      const STUDIO_PATH = 'studio';
      const STUDIO_BASE = BaseDirectory.Document;

      // Check if studio directory already exists
      let studioExists = false;
      try {
        await readDir(STUDIO_PATH, { baseDir: STUDIO_BASE });
        studioExists = true;
        console.log('Studio workspace already exists - respecting user setup');
      } catch {
        console.log('Studio workspace not found - will create new one');
      }

      if (!studioExists) {
        // Create the studio directory
        await mkdir(STUDIO_PATH, { baseDir: STUDIO_BASE, recursive: true });
        console.log('Created studio directory');

        // Create starter site files
        await createStarterSite();

        alert(
          `🎉 Welcome to Studio Builder Desktop!\n\nYour new Astro workspace has been created at:\n~/Documents/studio/\n\nTo get started:\n1. Open a terminal in that folder\n2. Run: npm install && npm run dev\n3. Open http://localhost:4321 in your browser`
        );
      } else {
        alert(`✅ Studio workspace found!\n\nLocation: ~/Documents/studio/\n\nYour existing setup has been preserved.`);
      }
    } catch (error) {
      console.error('Studio initialization failed:', error);
      alert(`❌ Failed to initialize studio workspace: ${error}\n\nPlease check file permissions and try again.`);
    }
  };

  // Create the starter Astro site
  const createStarterSite = async () => {
    try {
      console.log('Creating starter site...');

      // Create directory structure
      const dirs = ['src', 'src/layouts', 'src/pages', 'src/components', 'public'];
      for (const dir of dirs) {
        await mkdir(`studio/${dir}`, { baseDir: BaseDirectory.Document, recursive: true });
      }

      // Create starter files
      const files = {
        'studio/package.json': JSON.stringify(
          {
            name: 'studio-site',
            type: 'module',
            version: '0.0.1',
            scripts: {
              dev: 'astro dev',
              start: 'astro dev',
              build: 'astro check && astro build',
              preview: 'astro preview',
              astro: 'astro',
            },
            dependencies: {
              astro: '^4.16.18',
              '@astrojs/check': '^0.9.2',
              typescript: '^5.6.2',
            },
          },
          null,
          2
        ),

        'studio/README.md': `# Studio Site

Welcome to your Studio! This Astro-powered website was automatically created by Studio Builder Desktop.

## 🚀 Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open your browser to \`http://localhost:4321\`

Built with ❤️ by Studio Builder Desktop`,

        'studio/astro.config.mjs': `import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  outDir: './dist',
  publicDir: './public',
  srcDir: './src'
});`,

        'studio/tsconfig.json': JSON.stringify(
          {
            extends: 'astro/tsconfigs/strict',
            compilerOptions: {
              baseUrl: '.',
              paths: {
                '@/*': ['./src/*'],
              },
            },
          },
          null,
          2
        ),

        'studio/src/layouts/Layout.astro': `---
export interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="Welcome to your Studio!" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
    <style>
      html { font-family: system-ui, sans-serif; }
      body { 
        margin: 0; padding: 2rem; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh; color: white;
      }
      .container { max-width: 800px; margin: 0 auto; }
      h1 { font-size: 3rem; margin-bottom: 1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
      .card { 
        background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);
        border-radius: 1rem; padding: 2rem; margin: 2rem 0;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <slot />
    </div>
  </body>
</html>`,

        'studio/src/pages/index.astro': `---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Welcome to Your Studio">
  <main>
    <h1>🎨 Welcome to Your Studio</h1>
    
    <div class="card">
      <h2>✨ Your Site is Ready!</h2>
      <p>
        Congratulations! Your Astro-powered studio site has been automatically set up 
        by Studio Builder Desktop and is ready to use.
      </p>
    </div>

    <div class="card">
      <h3>🚀 Get Started</h3>
      <p>To start the development server, run:</p>
      <code>npm install && npm run dev</code>
    </div>

    <div class="card">
      <h2>🎯 Built with Studio Builder Desktop</h2>
      <p>
        This site was automatically created and configured for you. No setup required – 
        just start creating!
      </p>
    </div>
  </main>
</Layout>`,

        'studio/public/favicon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="45" fill="url(#grad)"/>
  <text x="50" y="58" font-family="Arial, sans-serif" font-size="32" fill="white" text-anchor="middle">✶</text>
</svg>`,
      };

      // Write all files
      for (const [filePath, content] of Object.entries(files)) {
        await writeTextFile(filePath, content, { baseDir: BaseDirectory.Document });
      }

      console.log('Starter site created successfully');
    } catch (error) {
      console.error('Failed to create starter site:', error);
      throw error;
    }
  };

  // Load projects from file system
  const loadProjects = async () => {
    try {
      const projectList = await invoke<Array<{ name: string; path: string }>>('list_projects');

      // Convert file system projects to UI projects with positions
      const uiProjects: Project[] = projectList.map((proj, idx) => {
        const radius = 160;
        const { x, y } = polar(radius, (360 / projectList.length) * idx);

        return {
          id: proj.name,
          label: proj.name,
          name: proj.name,
          path: proj.path,
          x,
          y,
          posts: [{ id: `${proj.name}-1`, title: 'Welcome', body: 'Welcome to your project!' }],
        };
      });

      setProjects(uiProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  // Create a new project
  const createNewProject = async () => {
    console.log('createNewProject called!');

    // Generate a unique "untitled" name
    const generateUntitledName = () => {
      const baseName = 'untitled';
      const existingNames = projects.map((p) => p.name || p.label);

      if (!existingNames.includes(baseName)) {
        return baseName;
      }

      let counter = 1;
      while (existingNames.includes(`${baseName}-${counter}`)) {
        counter++;
      }
      return `${baseName}-${counter}`;
    };

    const name = generateUntitledName();
    console.log('Creating project with name:', name);

    try {
      const newProject = await invoke<{ name: string; path: string }>('create_project', { name });
      console.log('Project created successfully:', newProject);

      // Reload projects to update the UI
      await loadProjects();

      // No alert - just create silently for better UX
      console.log(`✅ Project '${newProject.name}' created at: ${newProject.path}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      // Still show error alerts
      alert(`❌ Failed to create project: ${error}`);
    }
  };

  // Auto-initialize studio and load projects on first launch
  useEffect(() => {
    const initAndLoad = async () => {
      await initializeStudio();
      await loadProjects();
    };
    initAndLoad();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        addProject();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [projects]);

  const addProject = () => {
    console.log('addProject called!');
    createNewProject();
  };

  const updatePos = (id: string, x: number, y: number) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
  };

  const handleOpenProject = (project: Project, position?: { x: number; y: number }) => {
    setOpenProj({ project, position });
  };

  const actions = [
    { icon: FolderPlus, label: 'New Project', onClick: addProject },
    { icon: Eye, label: 'Preview Site', onClick: () => setPreviewOpen(true) },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center text-neutral-50 selection:bg-neutral-700">
      <div ref={containerRef} className="relative h-[28rem] w-[28rem] select-none">
        <div className="absolute top-1/2 left-1/2 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/5 shadow-inner backdrop-blur-sm pointer-events-none">
          <motion.span layoutId="avatar" className="text-sm opacity-60">
            ✶ Studio
          </motion.span>
        </div>
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            containerRef={containerRef}
            onOpen={handleOpenProject}
            updatePos={updatePos}
          />
        ))}
      </div>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-50/10 backdrop-blur-lg shadow-xl transition active:scale-90"
        aria-label="Studio Orb"
      >
        <div className="text-white">
          <Plus className="h-6 w-6" />
        </div>
      </button>
      <RadialMenu open={menuOpen} actions={actions} />
      <AnimatePresence>
        {openProj && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ProjectEditor
              project={openProj.project}
              onClose={() => setOpenProj(null)}
              initialPosition={openProj.position}
              onDeleteProject={(id) => {
                setProjects((prev) => prev.filter((p) => p.id !== id));
                setOpenProj(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {previewOpen && (
          <PublicSitePreview studioName="My Studio" projects={projects} onClose={() => setPreviewOpen(false)} />
        )}
      </AnimatePresence>
      <p className="fixed bottom-8 left-8 text-xs text-neutral-500">⌘P – New Project</p>
    </div>
  );
}
