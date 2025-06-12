export const polar = (r: number, angleDeg: number) => {
  const angle = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
  };
};

import { marked } from 'marked';

export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';

  try {
    // Remove frontmatter if present
    let content = markdown;
    if (content.startsWith('---')) {
      const frontmatterEnd = content.indexOf('\n---\n', 4);
      if (frontmatterEnd !== -1) {
        content = content.substring(frontmatterEnd + 5);
      }
    }

    // Configure marked with GitHub Flavored Markdown
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    // Parse markdown to HTML
    let html = marked(content) as string;

    // Post-process the HTML to add Tailwind classes
    html = html
      // Headings
      .replace(/<h1>/g, '<h1 class="text-3xl font-bold mb-6 mt-8 text-neutral-900 border-b border-neutral-200 pb-2">')
      .replace(/<h2>/g, '<h2 class="text-2xl font-semibold mb-4 mt-6 text-neutral-800">')
      .replace(/<h3>/g, '<h3 class="text-xl font-semibold mb-3 mt-5 text-neutral-800">')
      .replace(/<h4>/g, '<h4 class="text-lg font-medium mb-2 mt-4 text-neutral-700">')
      .replace(/<h5>/g, '<h5 class="text-base font-medium mb-2 mt-3 text-neutral-700">')
      .replace(/<h6>/g, '<h6 class="text-sm font-medium mb-2 mt-3 text-neutral-600">')

      // Paragraphs
      .replace(/<p>/g, '<p class="mb-4 text-neutral-700 leading-relaxed">')

      // Lists
      .replace(/<ul>/g, '<ul class="list-disc list-inside mb-4 space-y-1 text-neutral-700 ml-4">')
      .replace(/<ol>/g, '<ol class="list-decimal list-inside mb-4 space-y-1 text-neutral-700 ml-4">')
      .replace(/<li>/g, '<li class="mb-1">')

      // Blockquotes
      .replace(
        /<blockquote>/g,
        '<blockquote class="border-l-4 border-blue-200 bg-blue-50 pl-4 py-3 my-4 italic text-neutral-600 rounded-r">'
      )

      // Code blocks
      .replace(
        /<pre><code>/g,
        '<pre class="bg-neutral-900 text-neutral-100 p-4 rounded-lg my-4 overflow-x-auto"><code class="text-sm font-mono">'
      )

      // Inline code
      .replace(/<code>/g, '<code class="bg-neutral-100 text-neutral-800 px-2 py-1 rounded text-sm font-mono">')

      // Links
      .replace(/<a href="/g, '<a href="')
      .replace(
        /<a /g,
        '<a class="text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500 transition-colors" '
      )

      // Strong and emphasis
      .replace(/<strong>/g, '<strong class="font-semibold text-neutral-900">')
      .replace(/<em>/g, '<em class="italic text-neutral-700">')

      // Horizontal rules
      .replace(/<hr>/g, '<hr class="my-8 border-neutral-300">')

      // Tables
      .replace(
        /<table>/g,
        '<div class="overflow-x-auto my-6"><table class="min-w-full border border-neutral-200 rounded-lg">'
      )
      .replace(/<\/table>/g, '</table></div>')
      .replace(/<thead>/g, '<thead class="bg-neutral-50">')
      .replace(/<tbody>/g, '<tbody class="bg-white">')
      .replace(/<tr>/g, '<tr class="border-b border-neutral-200">')
      .replace(/<th>/g, '<th class="px-4 py-2 font-medium text-neutral-900 text-left">')
      .replace(/<td>/g, '<td class="px-4 py-2 text-neutral-700">');

    return html;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return `<p class="text-red-500">Error parsing markdown content</p>`;
  }
}
