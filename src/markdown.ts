import MarkdownIt from 'markdown-it';

const SAFE_LINK = /^(https?:|mailto:|#|\/(?!\/)|\.{0,2}\/?[\w.-])/i;

/**
 * Renders untrusted Markdown: raw HTML is escaped (html: false), links only allow
 * http(s)/mailto/relative targets, and images may only point at the project's own assets.
 */
export function createRenderer(assetBase: string) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  md.validateLink = (url: string) => SAFE_LINK.test(url.trim()) && !/^\s*(javascript|vbscript|data|file):/i.test(url);

  const defaultImage = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = String(token.attrGet('src') ?? '');
    const name = /^(?:\.\.\/)?assets\/([\w.-]+\.(?:png|jpe?g|gif|webp))$/i.exec(src)?.[1];
    if (!name) {
      // Remote or unknown images are not loaded: show their description as text instead.
      return md.utils.escapeHtml(`[${token.content || 'image'}]`);
    }
    token.attrSet('src', `${assetBase}/${encodeURIComponent(name)}`);
    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, idx, options, env, self);
  };

  const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = String(tokens[idx].attrGet('href') ?? '');
    if (/^https?:/i.test(href)) {
      tokens[idx].attrSet('rel', 'noopener noreferrer');
      tokens[idx].attrSet('target', '_blank');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // Shift headings one level down: the page owns <h1> (the task or project title).
  md.core.ruler.push('shift_headings', (state) => {
    for (const token of state.tokens) {
      if ((token.type === 'heading_open' || token.type === 'heading_close') && /^h[1-5]$/.test(token.tag)) {
        token.tag = `h${Number(token.tag[1]) + 1}`;
      }
    }
  });
  return md;
}
