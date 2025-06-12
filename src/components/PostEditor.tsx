import { useState, useEffect } from 'react';
import { Post } from '../types';

interface PostEditorProps {
  post: Post;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function PostEditor({ post, onClose, onSave, onDelete }: PostEditorProps) {
  const [content, setContent] = useState(post.content || '');
  const [title, setTitle] = useState(post.title || '');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  // Update local state when post prop changes
  useEffect(() => {
    setContent(post.content || '');
    setTitle(post.title || '');
  }, [post.content, post.title]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update content with new title in frontmatter
      const updatedContent = updateContentWithTitle(content, title);
      await onSave(updatedContent);
    } catch (error) {
      console.error('Failed to save post:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateContentWithTitle = (content: string, newTitle: string) => {
    // Check if content has frontmatter
    if (content.startsWith('---\n')) {
      // Replace existing title in frontmatter
      const frontmatterEnd = content.indexOf('\n---\n', 4);
      if (frontmatterEnd !== -1) {
        const frontmatter = content.substring(4, frontmatterEnd);
        const bodyContent = content.substring(frontmatterEnd + 5);

        // Replace or add title in frontmatter
        const updatedFrontmatter =
          frontmatter.replace(/^title:.*$/m, `title: "${newTitle}"`) ||
          (frontmatter.includes('title:') ? frontmatter : `title: "${newTitle}"\n${frontmatter}`);

        return `---\n${updatedFrontmatter}\n---\n${bodyContent}`;
      }
    }

    // Add frontmatter if it doesn't exist
    return `---\ntitle: "${newTitle}"\ndate: ${new Date().toISOString().split('T')[0]}\n---\n\n${content}`;
  };

  const handleDelete = async () => {
    console.log('PostEditor handleDelete called, post:', post);
    console.log('Proceeding with deletion');
    try {
      await onDelete();
      console.log('onDelete function completed successfully');
      onClose();
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  return (
    <div className="h-full w-full p-8 flex flex-col">
      <div className="flex gap-2 absolute right-4 top-4">
        <button
          onClick={confirmDelete}
          className="px-4 py-2 bg-red-600 text-sm text-white rounded-lg hover:bg-red-700 transition-colors"
          aria-label="Delete post"
        >
          Delete
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-sm text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          aria-label="Save post"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-6 text-2xl font-semibold text-neutral-50 flex-shrink-0 bg-transparent border-none outline-none focus:bg-neutral-800/20 rounded px-2 py-1 transition-colors"
        placeholder="Post title..."
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write in markdown…"
        className="flex-1 w-full resize-none rounded-lg bg-neutral-800/40 p-4 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-neutral-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Post</h3>
            <p className="text-neutral-300 mb-6">
              Are you sure you want to delete "{post.title}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDelete();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
