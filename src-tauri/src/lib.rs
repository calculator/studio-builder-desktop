use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Project {
    name: String,
    path: String,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn list_projects() -> Result<Vec<Project>, String> {
    let documents_dir = dirs::document_dir()
        .ok_or("Could not find documents directory")?;
    
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
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            projects.push(Project {
                                name: name.to_string(),
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
    
    let documents_dir = dirs::document_dir()
        .ok_or("Could not find documents directory")?;
    
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
    
    // Create a blank _layout.astro file so Astro won't complain
    let layout_content = r#"---
// Layout for the project pages
---

<slot />
"#;
    
    let layout_path = project_path.join("_layout.astro");
    if let Err(e) = fs::write(&layout_path, layout_content) {
        return Err(format!("Failed to create layout file: {}", e));
    }
    
    // Create an index.astro file as well
    let index_content = format!(r#"---
import Layout from './_layout.astro';
---

<Layout>
  <h1>{}</h1>
  <p>This is your new project page. Start building something amazing!</p>
  <p><em>You can rename this project by changing the folder name in your file system.</em></p>
</Layout>
"#, name);
    
    let index_path = project_path.join("index.astro");
    if let Err(e) = fs::write(&index_path, index_content) {
        return Err(format!("Failed to create index file: {}", e));
    }
    
    Ok(Project {
        name: sanitized_name.clone(),
        path: project_path.to_string_lossy().to_string(),
    })
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
        .invoke_handler(tauri::generate_handler![greet, list_projects, create_project])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
