import MarkdownIt from 'markdown-it';

// WAY-37: an allow-list. Relative targets carry no scheme, do not start with // and have no
// backslash (raw or encoded), which browsers read as a slash and so as another site.
const SAFE_LINK = /^(?:https?:|mailto:|#|(?![a-z][a-z0-9+.-]*:|\/\/)(?!.*(?:\\|%5c)))/i;

/**
 * Renders untrusted Markdown: raw HTML is escaped (html: false), links only allow
 * http(s)/mailto/relative targets, and images may only point at the project's own assets.
 */
export function createRenderer(assetBase: string) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  md.validateLink = (url: string) => SAFE_LINK.test(url.trim());

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

  // The page owns <h1> (the task or project title), so headings move one level down. With
  // env.headingBase (a page whose Markdown sits right under its <h1>), the highest heading present
  // becomes that level instead, so a body that starts at «##» leaves no gap.
  md.core.ruler.push('shift_headings', (state) => {
    const headings = state.tokens.filter((token) => token.type === 'heading_open' || token.type === 'heading_close');
    if (headings.length === 0) return;
    const level = (tag: string) => Number(tag[1]);
    const base = (state.env as { headingBase?: number } | undefined)?.headingBase;
    const shift = base ? base - Math.min(...headings.map((token) => level(token.tag))) : 1;
    for (const token of headings) token.tag = `h${Math.min(level(token.tag) + shift, 6)}`;
  });
  return md;
}
