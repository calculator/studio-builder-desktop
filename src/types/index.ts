export interface Post {
  filename: string;
  title: string;
  slug: string;
  content: string;
}

export interface Project {
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
