export const polar = (r: number, angleDeg: number) => {
  const angle = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
  };
};

export function parseMarkdown(markdown: string): string {
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
