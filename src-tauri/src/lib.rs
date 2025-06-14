use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
struct Project {
    name: String,      // Display name (what user sees)
    folder_name: String, // Actual folder name (sanitized)
    path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Post {
    filename: String,
    title: String,
    slug: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct StudioInitResult {
    success: bool,
    message: String,
    is_first_time: bool,
}

#[tauri::command]
async fn initialize_studio(app: AppHandle) -> Result<StudioInitResult, String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;
    let studio_path = documents_dir.join("studio");

    // Check if studio directory already exists
    let is_first_time = !studio_path.exists();

    if is_first_time {
        // Create the studio directory
        if let Err(e) = fs::create_dir_all(&studio_path) {
            return Err(format!("Failed to create studio directory: {}", e));
        }

        // Create starter site
        create_starter_site_internal(&app, &studio_path)?;

        Ok(StudioInitResult {
            success: true,
            message: "🎉 Welcome to Studio Builder Desktop!\n\nYour new Astro workspace has been created at:\n~/Documents/studio/\n\nTo get started:\n1. Open a terminal in that folder\n2. Run: npm install && npm run dev\n3. Open http://localhost:4321 in your browser".to_string(),
            is_first_time: true,
        })
    } else {
        Ok(StudioInitResult {
            success: true,
            message: "✅ Studio workspace found!\n\nLocation: ~/Documents/studio/\n\nYour existing setup has been preserved.".to_string(),
            is_first_time: false,
        })
    }
}

fn create_starter_site_internal(
    app: &AppHandle,
    studio_path: &std::path::Path,
) -> Result<(), String> {
    // Get the starter site template from resources
    let template_path = app
        .path()
        .resolve(
            "resources/templates/starter-site",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|e| format!("Failed to resolve template path: {}", e))?;

    // Recursively copy all template files
    copy_dir_all(&template_path, studio_path)?;

    Ok(())
}

fn copy_dir_all(source_dir: &std::path::Path, dest_path: &std::path::Path) -> Result<(), String> {
    // Create the destination directory if it doesn't exist
    if let Err(e) = fs::create_dir_all(dest_path) {
        return Err(format!(
            "Failed to create directory {}: {}",
            dest_path.display(),
            e
        ));
    }

    // Read the source directory
    let entries = fs::read_dir(source_dir)
        .map_err(|e| format!("Failed to read directory {}: {}", source_dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let source_path = entry.path();
        let dest_entry_path = dest_path.join(entry.file_name());

        if source_path.is_dir() {
            // Recursively copy subdirectories
            copy_dir_all(&source_path, &dest_entry_path)?;
        } else {
            // Copy files
            if let Err(e) = fs::copy(&source_path, &dest_entry_path) {
                return Err(format!(
                    "Failed to copy file {} to {}: {}",
                    source_path.display(),
                    dest_entry_path.display(),
                    e
                ));
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn create_starter_site(app: AppHandle) -> Result<(), String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;
    let studio_path = documents_dir.join("studio");

    create_starter_site_internal(&app, &studio_path)
}

#[tauri::command]
async fn list_projects() -> Result<Vec<Project>, String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;

    let pages_path = documents_dir.join("studio").join("src").join("pages");

    if !pages_path.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    match fs::read_dir(&pages_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(folder_name) = path.file_name().and_then(|n| n.to_str()) {
                            // Try to read display name from index.astro frontmatter
                            let display_name = read_project_display_name(&path)
                                .unwrap_or_else(|| folder_name.to_string());

                            projects.push(Project {
                                name: display_name,
                                folder_name: folder_name.to_string(),
                                path: path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read pages directory: {}", e)),
    }

    projects.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(projects)
}

#[tauri::command]
async fn create_project(name: String) -> Result<Project, String> {
    // Sanitize the project name
    let sanitized_name = sanitize_project_name(&name);

    if sanitized_name.is_empty() {
        return Err("Project name cannot be empty after sanitization".to_string());
    }

    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;

    let pages_path = documents_dir.join("studio").join("src").join("pages");
    let project_path = pages_path.join(&sanitized_name);

    // Check if project already exists
    if project_path.exists() {
        return Err(format!("Project '{}' already exists", sanitized_name));
    }

    // Create the project directory
    if let Err(e) = fs::create_dir_all(&project_path) {
        return Err(format!("Failed to create project directory: {}", e));
    }

    // Create a project-specific layout that uses the main PostLayout
    let layout_content = format!(
        r#"---
import PostLayout from '../../layouts/PostLayout.astro';

export interface Props {{
  title: string;
}}

const {{ title }} = Astro.props;
const projectName = '{}';
---

<PostLayout title={{title}} projectName={{projectName}}>
  <slot />
</PostLayout>
"#,
        sanitized_name
    );

    let layout_path = project_path.join("_layout.astro");
    if let Err(e) = fs::write(&layout_path, layout_content) {
        return Err(format!("Failed to create layout file: {}", e));
    }

    // Create an index.astro file for the project listing
    let index_content = format!(
        r#"---
title: "{}"
displayName: "{}"
import ProjectLayout from '../../layouts/ProjectLayout.astro';
import {{ readdir }} from 'node:fs/promises';
import path from 'node:path';

const projectName = '{}';
const displayName = '{}';
const folderName = '{}';
const projectDir = path.join(process.cwd(), 'src/pages', folderName);

// Get all markdown posts
let posts = [];
try {{
  const entries = await readdir(projectDir);
  posts = entries
    .filter(file => file.endsWith('.md'))
    .map(file => {{
      const slug = file.replace('.md', '');
      return {{
        slug,
        title: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        href: `/${{folderName}}/${{slug}}`
      }};
    }});
}} catch (error) {{
  console.log('No posts found yet');
}}
---

<ProjectLayout title={{displayName}} projectName={{projectName}}>
  <h2>Posts</h2>

  {{posts.length > 0 ? (
    <div class="post-grid">
      {{posts.map((post) => (
        <a href={{post.href}} class="card post-card">
          {{post.title}}
        </a>
      ))}}
    </div>
  ) : (
    <div class="card">
      <h3>No posts yet</h3>
      <p>Create your first post using Studio Builder Desktop!</p>
    </div>
  )}}
</ProjectLayout>
"#,
        name, // original display name for title
        name, // original display name for displayName
        name, // original display name for projectName (what user sees)
        name, // original display name for displayName variable
        sanitized_name // sanitized folder name for file system operations
    );

    let index_path = project_path.join("index.astro");
    if let Err(e) = fs::write(&index_path, index_content) {
        return Err(format!("Failed to create index file: {}", e));
    }

    Ok(Project {
        name: name.clone(), // Original display name
        folder_name: sanitized_name.clone(),
        path: project_path.to_string_lossy().to_string(),
    })
}

// Post CRUD operations
#[tauri::command]
async fn list_posts(project_name: String) -> Result<Vec<Post>, String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;

    let project_path = documents_dir
        .join("studio")
        .join("src")
        .join("pages")
        .join(&project_name);

    if !project_path.exists() {
        return Err(format!("Project '{}' does not exist", project_name));
    }

    let mut posts = Vec::new();

    match fs::read_dir(&project_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(extension) = path.extension() {
                            if extension == "md" {
                                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                                    let slug = filename
                                        .strip_suffix(".md")
                                        .unwrap_or(filename)
                                        .to_string();

                                    // Read the file to extract the title
                                    let content = fs::read_to_string(&path).unwrap_or_default();
                                    let title = extract_title_from_markdown(&content, &slug);

                                    posts.push(Post {
                                        filename: filename.to_string(),
                                        title,
                                        slug,
                                        content: String::new(), // Don't load full content for listing
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read project directory: {}", e)),
    }

    posts.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(posts)
}

#[tauri::command]
async fn create_post(project_name: String, title: String) -> Result<Post, String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;

    let project_path = documents_dir
        .join("studio")
        .join("src")
        .join("pages")
        .join(&project_name);

    if !project_path.exists() {
        return Err(format!("Project '{}' does not exist", project_name));
    }

    // Generate a unique slug
    let base_slug = sanitize_slug(&title);
    let mut slug = base_slug.clone();
    let mut counter = 1;

    // Ensure unique filename
    while project_path.join(format!("{}.md", slug)).exists() {
        slug = format!("{}-{}", base_slug, counter);
        counter += 1;
    }

    let filename = format!("{}.md", slug);
    let file_path = project_path.join(&filename);

    // Create markdown content with frontmatter
    let content = format!(
        r#"---
title: "{}"
date: {}
---

# {}

Write your content here...
"#,
        title,
        chrono::Utc::now().format("%Y-%m-%d"),
        title
    );

    // Write the file
    if let Err(e) = fs::write(&file_path, &content) {
        return Err(format!("Failed to create post file: {}", e));
    }

    Ok(Post {
        filename,
        title,
        slug,
        content,
    })
}

#[tauri::command]
async fn read_post(project_name: String, slug: String) -> Result<Post, String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;

    let project_path = documents_dir
        .join("studio")
        .join("src")
        .join("pages")
        .join(&project_name);
    let filename = format!("{}.md", slug);
    let file_path = project_path.join(&filename);

    if !file_path.exists() {
        return Err(format!("Post '{}' does not exist", slug));
    }

    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read post file: {}", e))?;

    let title = extract_title_from_markdown(&content, &slug);

    Ok(Post {
        filename,
        title,
        slug,
        content,
    })
}

#[tauri::command]
async fn update_post(project_name: String, slug: String, content: String) -> Result<(), String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;

    let project_path = documents_dir
        .join("studio")
        .join("src")
        .join("pages")
        .join(&project_name);
    let filename = format!("{}.md", slug);
    let file_path = project_path.join(&filename);

    if !file_path.exists() {
        return Err(format!("Post '{}' does not exist", slug));
    }

    // Atomic write: write to temp file first, then rename
    let temp_path = project_path.join(format!(".{}.tmp", filename));

    // Write to temp file
    {
        let mut temp_file = fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        temp_file
            .write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write to temp file: {}", e))?;
        temp_file
            .sync_all()
            .map_err(|e| format!("Failed to sync temp file: {}", e))?;
    }

    // Atomically replace the original file
    fs::rename(&temp_path, &file_path)
        .map_err(|e| format!("Failed to replace original file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn delete_post(project_name: String, slug: String) -> Result<(), String> {
    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;

    let project_path = documents_dir
        .join("studio")
        .join("src")
        .join("pages")
        .join(&project_name);
    let filename = format!("{}.md", slug);
    let file_path = project_path.join(&filename);

    if !file_path.exists() {
        return Err(format!("Post '{}' does not exist", slug));
    }

    fs::remove_file(&file_path).map_err(|e| format!("Failed to delete post file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn rename_project(old_folder_name: String, new_display_name: String) -> Result<Project, String> {
    // Sanitize the new project name for folder
    let sanitized_new_name = sanitize_project_name(&new_display_name);

    if sanitized_new_name.is_empty() {
        return Err("Project name cannot be empty after sanitization".to_string());
    }

    let documents_dir = dirs::document_dir().ok_or("Could not find documents directory")?;
    let pages_path = documents_dir.join("studio").join("src").join("pages");
    
    let old_project_path = pages_path.join(&old_folder_name);
    let new_project_path = pages_path.join(&sanitized_new_name);

    // Check if old project exists
    if !old_project_path.exists() {
        return Err(format!("Project folder '{}' does not exist", old_folder_name));
    }

    // Check if new project name already exists (only if folder name is changing)
    if old_folder_name != sanitized_new_name && new_project_path.exists() {
        return Err(format!("Project folder '{}' already exists", sanitized_new_name));
    }

    // Update the index.astro file with new display name
    let index_file_path = old_project_path.join("index.astro");
    if index_file_path.exists() {
        update_project_display_name(&index_file_path, &new_display_name, &sanitized_new_name)?;
    }

    // Rename the directory if the folder name changed
    if old_folder_name != sanitized_new_name {
        fs::rename(&old_project_path, &new_project_path)
            .map_err(|e| format!("Failed to rename project directory: {}", e))?;

        // Update the layout file to reference the new folder name
        let layout_file_path = new_project_path.join("_layout.astro");
        if layout_file_path.exists() {
            let layout_content = fs::read_to_string(&layout_file_path)
                .map_err(|e| format!("Failed to read layout file: {}", e))?;

            let updated_content = layout_content.replace(
                &format!("const projectName = '{}';", old_folder_name),
                &format!("const projectName = '{}';", sanitized_new_name),
            );

            fs::write(&layout_file_path, updated_content)
                .map_err(|e| format!("Failed to update layout file: {}", e))?;
        }
    }

    // Return the updated project information
    let final_folder_name = sanitized_new_name;
    let final_project_path = pages_path.join(&final_folder_name);
    
    Ok(Project {
        name: new_display_name,
        folder_name: final_folder_name,
        path: final_project_path.to_string_lossy().to_string(),
    })
}

// Helper functions
fn update_project_display_name(
    index_path: &std::path::Path,
    new_display_name: &str,
    new_folder_name: &str,
) -> Result<(), String> {
    let content = fs::read_to_string(index_path)
        .map_err(|e| format!("Failed to read index file: {}", e))?;

    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    let mut in_frontmatter = false;
    let mut frontmatter_end = 0;

    // Find frontmatter boundaries
    for (i, line) in lines.iter().enumerate() {
        if i == 0 && line.trim() == "---" {
            in_frontmatter = true;
            continue;
        }
        if in_frontmatter && line.trim() == "---" {
            frontmatter_end = i;
            break;
        }
    }

    if frontmatter_end == 0 {
        return Err("No frontmatter found in index.astro".to_string());
    }

    // Update frontmatter fields
    let mut found_title = false;
    let mut found_display_name = false;

    for i in 1..frontmatter_end {
        let line = &lines[i];
        if line.trim().starts_with("title:") {
            lines[i] = format!("title: \"{}\"", new_display_name);
            found_title = true;
        } else if line.trim().starts_with("displayName:") {
            lines[i] = format!("displayName: \"{}\"", new_display_name);
            found_display_name = true;
        } else if line.trim().starts_with("const projectName =") {
            lines[i] = format!("const projectName = '{}';", new_display_name);
        } else if line.trim().starts_with("const displayName =") {
            lines[i] = format!("const displayName = '{}';", new_display_name);
        } else if line.trim().starts_with("const folderName =") {
            lines[i] = format!("const folderName = '{}';", new_folder_name);
        }
    }

    // Add missing frontmatter fields if needed
    if !found_title {
        lines.insert(1, format!("title: \"{}\"", new_display_name));
        frontmatter_end += 1;
    }
    if !found_display_name {
        let insert_pos = if found_title { 2 } else { 1 };
        lines.insert(insert_pos, format!("displayName: \"{}\"", new_display_name));
    }

    let updated_content = lines.join("\n");
    fs::write(index_path, updated_content)
        .map_err(|e| format!("Failed to update index file: {}", e))?;

    Ok(())
}

fn read_project_display_name(project_path: &std::path::Path) -> Option<String> {
    let index_path = project_path.join("index.astro");
    if !index_path.exists() {
        return None;
    }

    if let Ok(content) = fs::read_to_string(&index_path) {
        // Extract displayName from frontmatter
        if content.starts_with("---") {
            let lines: Vec<&str> = content.lines().collect();
            let mut in_frontmatter = false;
            let mut frontmatter_end = 0;

            for (i, line) in lines.iter().enumerate() {
                if i == 0 && line.trim() == "---" {
                    in_frontmatter = true;
                    continue;
                }
                if in_frontmatter && line.trim() == "---" {
                    frontmatter_end = i;
                    break;
                }
            }

            if frontmatter_end > 0 {
                for i in 1..frontmatter_end {
                    let line = lines[i].trim();
                    if line.starts_with("displayName:") {
                        let display_name_part = &line[12..].trim();
                        // Remove quotes if present
                        let display_name = if (display_name_part.starts_with('"') && display_name_part.ends_with('"'))
                            || (display_name_part.starts_with('\'') && display_name_part.ends_with('\''))
                        {
                            &display_name_part[1..display_name_part.len() - 1]
                        } else {
                            display_name_part
                        };
                        return Some(display_name.to_string());
                    }
                }
            }
        }
    }

    None
}

fn extract_title_from_markdown(content: &str, fallback_slug: &str) -> String {
    // First try to extract title from frontmatter
    if let Some(frontmatter_title) = extract_frontmatter_title(content) {
        return frontmatter_title;
    }

    // Then try to find the first heading
    let lines = content.lines();
    for line in lines {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return trimmed[2..].trim().to_string();
        }
    }

    // Fallback to slug formatted as title
    fallback_slug
        .replace('-', " ")
        .replace('_', " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn extract_frontmatter_title(content: &str) -> Option<String> {
    if !content.starts_with("---") {
        return None;
    }

    let lines: Vec<&str> = content.lines().collect();
    let mut in_frontmatter = false;
    let mut frontmatter_end = 0;

    for (i, line) in lines.iter().enumerate() {
        if i == 0 && line.trim() == "---" {
            in_frontmatter = true;
            continue;
        }
        if in_frontmatter && line.trim() == "---" {
            frontmatter_end = i;
            break;
        }
    }

    if frontmatter_end > 0 {
        for i in 1..frontmatter_end {
            let line = lines[i].trim();
            if line.starts_with("title:") {
                let title_part = &line[6..].trim();
                // Remove quotes if present
                let title = if (title_part.starts_with('"') && title_part.ends_with('"'))
                    || (title_part.starts_with('\'') && title_part.ends_with('\''))
                {
                    &title_part[1..title_part.len() - 1]
                } else {
                    title_part
                };
                return Some(title.to_string());
            }
        }
    }

    None
}

fn sanitize_slug(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .map(|c| match c {
            ' ' | '_' => '-',
            c if c.is_alphanumeric() || c == '-' => c,
            _ => '-',
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn sanitize_project_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            ' ' => '-',
            c if c.is_alphanumeric() || c == '-' || c == '_' => c,
            _ => '-',
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
        .to_lowercase()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            initialize_studio,
            create_starter_site,
            list_projects,
            create_project,
            list_posts,
            create_post,
            read_post,
            update_post,
            delete_post,
            rename_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
