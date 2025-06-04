import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderPlus, Eye, X as Close } from 'lucide-react';
import { writeTextFile, BaseDirectory, mkdir, exists } from '@tauri-apps/plugin-fs';

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
  const initProjects = (): Project[] => {
    const labels = ['Alchemy', 'Garden', 'Codex'];
    const radius = 160;

    const projectData = {
      Alchemy: [
        {
          id: 'alchemy-1',
          title: 'Introduction to Digital Transformation',
          body: "# Digital Transformation in Modern Business\n\nThe landscape of business is rapidly evolving with digital technologies at the forefront. Companies that embrace digital transformation are seeing significant improvements in efficiency, customer satisfaction, and competitive advantage.\n\n## Key Areas of Focus\n\n- **Automation**: Streamlining repetitive tasks\n- **Data Analytics**: Making informed decisions\n- **Cloud Migration**: Scaling infrastructure\n- **Customer Experience**: Enhancing touchpoints\n\nThis transformation isn't just about technology—it's about reimagining how we work.",
        },
        {
          id: 'alchemy-2',
          title: 'The Art of Problem Solving',
          body: '# Creative Problem Solving Methods\n\nEvery challenge presents an opportunity for innovation. Here are some proven methodologies for approaching complex problems:\n\n## Design Thinking Process\n\n1. **Empathize** - Understand the user\n2. **Define** - Frame the problem\n3. **Ideate** - Generate solutions\n4. **Prototype** - Build to think\n5. **Test** - Learn and iterate\n\n> "The best way to have a good idea is to have lots of ideas." - Linus Pauling',
        },
        {
          id: 'alchemy-3',
          title: 'Building Sustainable Systems',
          body: '# Creating Systems That Last\n\nSustainability in system design goes beyond environmental concerns—it encompasses maintainability, scalability, and long-term viability.\n\n## Core Principles\n\n- **Modularity**: Build in discrete, replaceable components\n- **Documentation**: Keep knowledge accessible\n- **Testing**: Ensure reliability through automated checks\n- **Monitoring**: Track performance and health\n\nA well-designed system should be able to evolve and adapt over time.',
        },
        {
          id: 'alchemy-4',
          title: 'Innovation in Practice',
          body: "# Turning Ideas into Reality\n\nInnovation isn't just about having great ideas—it's about executing them effectively. Here's how successful organizations approach innovation:\n\n## The Innovation Pipeline\n\n1. **Idea Generation** - Create a culture of curiosity\n2. **Evaluation** - Assess feasibility and impact\n3. **Experimentation** - Test with minimal viable products\n4. **Implementation** - Scale successful experiments\n\nThe key is to fail fast and learn faster.",
        },
      ],
      Garden: [
        {
          id: 'garden-1',
          title: 'Cultivating Creative Spaces',
          body: '# Designing Environments for Creativity\n\nPhysical and digital spaces have a profound impact on our ability to think creatively and collaborate effectively.\n\n## Elements of Creative Spaces\n\n- **Natural Light**: Enhances mood and energy\n- **Flexible Furniture**: Adapts to different work styles\n- **Quiet Zones**: For focused, deep work\n- **Collaboration Areas**: For team brainstorming\n- **Nature Elements**: Plants and natural materials\n\nThe goal is to create an environment that inspires and energizes.',
        },
        {
          id: 'garden-2',
          title: 'Growing Ideas from Seeds',
          body: "# The Lifecycle of an Idea\n\nGreat ideas don't emerge fully formed—they grow and evolve through careful nurturing and cultivation.\n\n## Stages of Idea Development\n\n1. **Seed Stage** - Initial spark of inspiration\n2. **Germination** - Early exploration and research\n3. **Growth** - Development and refinement\n4. **Flowering** - Implementation and testing\n5. **Harvest** - Launch and scaling\n\nLike gardening, idea cultivation requires patience, care, and the right conditions.",
        },
        {
          id: 'garden-3',
          title: 'Community and Collaboration',
          body: '# Building Thriving Communities\n\nStrong communities don\'t happen by accident—they require intentional design and ongoing cultivation.\n\n## Community Building Principles\n\n- **Shared Purpose**: Clear mission and values\n- **Trust**: Safe spaces for vulnerability\n- **Diversity**: Different perspectives and backgrounds\n- **Participation**: Active engagement from members\n- **Evolution**: Ability to adapt and grow\n\n> "Alone we can do so little; together we can do so much." - Helen Keller',
        },
        {
          id: 'garden-4',
          title: 'Sustainable Growth Strategies',
          body: '# Growing Without Burning Out\n\nSustainable growth focuses on long-term health rather than short-term gains. This applies to businesses, communities, and personal development.\n\n## Key Strategies\n\n- **Organic Expansion**: Growth that feels natural\n- **Resource Management**: Careful allocation of time and energy\n- **Quality over Quantity**: Depth rather than breadth\n- **Regular Rest**: Periods of recovery and reflection\n\nThe most resilient systems are those that prioritize sustainability over speed.',
        },
      ],
      Codex: [
        {
          id: 'codex-1',
          title: 'The Philosophy of Code',
          body: "# Code as Craft and Communication\n\nWriting code is both an art and a science. It's about solving problems elegantly while communicating clearly with both machines and other humans.\n\n## Principles of Good Code\n\n- **Clarity**: Code should read like well-written prose\n- **Simplicity**: Prefer simple solutions over clever ones\n- **Consistency**: Follow established patterns and conventions\n- **Testability**: Write code that can be easily verified\n- **Maintainability**: Consider the future developer (often yourself)\n\n```javascript\n// Good code tells a story\nfunction calculateMonthlyPayment(principal, rate, years) {\n  const monthlyRate = rate / 12;\n  const numberOfPayments = years * 12;\n  return principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / \n         (Math.pow(1 + monthlyRate, numberOfPayments) - 1);\n}\n```",
        },
        {
          id: 'codex-2',
          title: 'Architecture and Design Patterns',
          body: '# Building Scalable Software Architecture\n\nSoftware architecture is the foundation upon which applications are built. Good architecture decisions made early can save countless hours later.\n\n## Common Design Patterns\n\n### MVC (Model-View-Controller)\nSeparates data, presentation, and business logic for better organization.\n\n### Observer Pattern\nAllows objects to subscribe to and receive notifications about changes.\n\n### Factory Pattern\nCreates objects without specifying their exact classes.\n\n## Architecture Principles\n\n- **Separation of Concerns**: Each component has a single responsibility\n- **Loose Coupling**: Components depend on abstractions, not concretions\n- **High Cohesion**: Related functionality is grouped together\n\nRemember: Architecture is about trade-offs, not perfect solutions.',
        },
        {
          id: 'codex-3',
          title: 'Testing and Quality Assurance',
          body: "# Building Confidence Through Testing\n\nTesting isn't just about finding bugs—it's about building confidence in your code and enabling safe refactoring.\n\n## Testing Pyramid\n\n1. **Unit Tests** (Base) - Test individual functions/methods\n2. **Integration Tests** (Middle) - Test component interactions\n3. **E2E Tests** (Top) - Test complete user workflows\n\n## Best Practices\n\n- **Test-Driven Development**: Write tests before implementation\n- **Meaningful Test Names**: Describe what the test verifies\n- **Single Assertion**: Each test should verify one thing\n- **Independent Tests**: Tests shouldn't depend on each other\n\n```javascript\ndescribe('calculateMonthlyPayment', () => {\n  it('should calculate correct payment for standard 30-year mortgage', () => {\n    const payment = calculateMonthlyPayment(100000, 0.05, 30);\n    expect(payment).toBeCloseTo(536.82, 2);\n  });\n});\n```",
        },
        {
          id: 'codex-4',
          title: 'Performance and Optimization',
          body: '# Writing Efficient Code\n\nPremature optimization is the root of all evil, but understanding performance principles helps you make better decisions from the start.\n\n## Performance Principles\n\n### Time Complexity\n- **O(1)** - Constant time (hash lookups)\n- **O(log n)** - Logarithmic (binary search)\n- **O(n)** - Linear (simple loops)\n- **O(n²)** - Quadratic (nested loops)\n\n### Space Complexity\nConsider memory usage alongside execution time.\n\n## Optimization Strategies\n\n1. **Measure First**: Profile before optimizing\n2. **Focus on Bottlenecks**: 80/20 rule applies\n3. **Cache Intelligently**: Store expensive computations\n4. **Lazy Loading**: Load resources when needed\n\n> "Make it work, make it right, make it fast." - Kent Beck',
        },
        {
          id: 'codex-5',
          title: 'Developer Experience and Tooling',
          body: "# Creating Delightful Development Workflows\n\nGood developer experience isn't a luxury—it's essential for productivity and job satisfaction.\n\n## Essential Development Tools\n\n### Code Editors\n- Syntax highlighting and autocomplete\n- Integrated debugging capabilities\n- Extension ecosystems\n\n### Version Control\n- Git for tracking changes\n- Meaningful commit messages\n- Branching strategies (Git Flow, GitHub Flow)\n\n### Automation\n- Continuous Integration/Deployment\n- Automated testing and linting\n- Code formatting (Prettier, ESLint)\n\n## Creating Good DX\n\n- **Fast Feedback Loops**: Quick builds and tests\n- **Clear Documentation**: README files and inline comments\n- **Consistent Environments**: Docker, dev containers\n- **Error Messages**: Helpful and actionable\n\nInvest in your tools—they're your daily companions.",
        },
      ],
    };

    return labels.map((label, idx) => {
      const { x, y } = polar(radius, (360 / labels.length) * idx);
      return {
        id: label,
        label,
        x,
        y,
        posts: projectData[label as keyof typeof projectData] || [
          { id: `${label}-1`, title: 'Default Post', body: 'Default content' },
        ],
      };
    });
  };
  const [projects, setProjects] = useState<Project[]>(initProjects);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openProj, setOpenProj] = useState<{ project: Project; position?: { x: number; y: number } } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // File system test function - handles iCloud Documents
  const testFileSystem = async () => {
    try {
      // Try multiple approaches for macOS Documents folder
      const strategies = [
        // Strategy 1: Use BaseDirectory.Document (standard approach)
        async () => {
          await mkdir('studio', { baseDir: BaseDirectory.Document, recursive: true });
          return { baseDir: BaseDirectory.Document, path: 'studio/test.md', location: 'Documents (BaseDirectory)' };
        },

        // Strategy 2: Use Home directory + Documents (bypass iCloud issues)
        async () => {
          // Note: This might require different permissions
          await mkdir('Documents/studio', { baseDir: BaseDirectory.Home, recursive: true });
          return { baseDir: BaseDirectory.Home, path: 'Documents/studio/test.md', location: 'Home/Documents' };
        },

        // Strategy 3: Use Desktop as fallback (usually works better with iCloud)
        async () => {
          await mkdir('studio', { baseDir: BaseDirectory.Desktop, recursive: true });
          return { baseDir: BaseDirectory.Desktop, path: 'studio/test.md', location: 'Desktop' };
        },
      ];

      let lastError = null;

      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`Trying file system strategy ${i + 1}...`);
          const result = await strategies[i]();

          // Create a test file
          const testContent = `# Studio Test File
Created at: ${new Date().toISOString()}
Strategy: ${result.location}
Path: ${result.path}

This file was created to test Tauri's file system access on macOS.

## System Info
- Strategy used: ${i + 1}/${strategies.length}
- Location: ${result.location}
- iCloud Documents might be: ${result.location.includes('BaseDirectory') ? 'enabled' : 'bypassed'}
`;

          await writeTextFile(result.path, testContent, { baseDir: result.baseDir });

          alert(
            `✅ File system test successful!\n\nCreated: ${result.path}\nLocation: ${result.location}\nStrategy: ${
              i + 1
            }/${strategies.length}`
          );
          return; // Success, exit function
        } catch (error) {
          console.warn(`Strategy ${i + 1} failed:`, error);
          lastError = error;
          continue; // Try next strategy
        }
      }

      // If we get here, all strategies failed
      throw lastError;
    } catch (error) {
      console.error('All file system strategies failed:', error);

      let errorMessage = `❌ File system test failed: ${error}`;

      if (error.toString().includes('forbidden')) {
        errorMessage += `\n\n💡 This might be due to:\n• iCloud Documents & Desktop sync\n• macOS security permissions\n• Tauri capability configuration\n\nTry:\n1. Disable iCloud for Documents\n2. Grant file access permissions\n3. Check Tauri capabilities`;
      }

      alert(errorMessage);
    }
  };

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
    const label = `Project ${projects.length + 1}`;
    const { x, y } = polar(160, (360 / (projects.length + 1)) * projects.length);
    const newProj: Project = { id: label, label, x, y, posts: [{ id: `${label}-1`, title: 'Post 1' }] };
    setProjects((prev) => [...prev, newProj]);
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
      {/* File System Test Button */}
      <button
        onClick={testFileSystem}
        className="fixed top-4 left-4 z-50 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg shadow-lg transition-colors"
      >
        Test File System
      </button>
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
