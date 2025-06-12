export interface Post {
  filename: string;
  title: string;
  slug: string;
  content: string;
}

export interface Project {
  id: string;
  label: string; // Display name (what user sees)
  x: number;
  y: number;
  posts: Post[];
  description?: string;
  intention?: string;
  postRecipe?: string[];
  // Fields from Rust struct
  name: string; // Display name (matches Rust backend)
  folder_name: string; // Actual folder name (sanitized)
  path: string;
}
