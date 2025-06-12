import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderPlus, Eye } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Import our extracted components and utilities
import { Project } from './types';
import { polar } from './utils';
import ProjectCard from './components/ProjectCard';
import RadialMenu from './components/RadialMenu';
import ProjectEditor from './components/ProjectEditor';
import PublicSitePreview from './components/PublicSitePreview';

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

      const result = await invoke<{ success: boolean; message: string; is_first_time: boolean }>('initialize_studio');

      if (result.success) {
        alert(result.message);
        console.log(result.is_first_time ? 'Created new studio workspace' : 'Studio workspace already exists');
      } else {
        throw new Error('Studio initialization failed');
      }
    } catch (error) {
      console.error('Studio initialization failed:', error);
      alert(`❌ Failed to initialize studio workspace: ${error}\n\nPlease check file permissions and try again.`);
    }
  };

  // Load projects from file system
  const loadProjects = async () => {
    try {
      const projectList = await invoke<Array<{ name: string; folder_name: string; path: string }>>('list_projects');

      // Convert file system projects to UI projects with positions
      const uiProjects: Project[] = projectList.map((proj, idx) => {
        const radius = 160;
        const { x, y } = polar(radius, (360 / projectList.length) * idx);

        return {
          id: proj.folder_name, // Use folder_name as unique ID
          label: proj.name, // Display name
          name: proj.name, // Display name
          folder_name: proj.folder_name, // Actual folder name
          path: proj.path,
          x,
          y,
          posts: [], // Posts will be loaded dynamically when project is opened
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
      const newProject = await invoke<{ name: string; folder_name: string; path: string }>('create_project', { name });
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

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));

    // Update the currently open project if it's the same one
    if (openProj && openProj.project.id === updatedProject.id) {
      setOpenProj({ ...openProj, project: updatedProject });
    }
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
              onUpdateProject={handleUpdateProject}
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
