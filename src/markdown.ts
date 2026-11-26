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
  // A11Y-4: records written by Wayfinder (history, error notes, log) keep fixed English labels
  // («status: a -> b», «Files:», «Resolved. Fields: …»). With env.generated, each such line, or
  // only its label when the value is the person's text, is marked lang="en" so it is read as
  // English inside a Spanish page. Only these exact shapes are marked, at the start of a line.
  md.core.ruler.push('generated_lang', (state) => {
    if (!(state.env as { generated?: boolean } | undefined)?.generated) return;
    const span = (content: string) => Object.assign(new state.Token('html_inline', '', 0), { content });
    const text = (content: string) => Object.assign(new state.Token('text', '', 0), { content });
    const english = (content: string) => [span('<span lang="en">'), text(content), span('</span>')];
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      const out = [];
      const children = block.children;
      for (let i = 0; i < children.length; i++) {
        const token = children[i];
        const lineStart = i === 0 || /^(soft|hard)break$/.test(children[i - 1].type);
        const lineEnd = i === children.length - 1 || /^(soft|hard)break$/.test(children[i + 1].type);
        const label = lineStart && token.type === 'text' ? GENERATED_LABEL.exec(token.content) : null;
        if (lineStart && lineEnd && token.type === 'text' && GENERATED_LINE.some((re) => re.test(token.content))) out.push(...english(token.content));
        else if (label) out.push(...english(label[0].trimEnd()), text(token.content.slice(label[0].length - 1)));
        else out.push(token);
      }
      block.children = out;
    }
  });
  return md;
}

/** Lines written whole by Wayfinder (src/store: tasks.ts, approve.ts, error-records.ts). */
const GENERATED_LINE = [
  /^status: [\w-]+ -> [\w-]+$/,
  /^(trivial|risk-acknowledged): true$/,
  /^approved-via: \w+$/,
  /^review: (clean|suspicious)$/,
  /^(Created \(task: [A-Z]{2,6}-\d+\)\.|(Resolved|Updated|Reopened|Discarded)\.( Task: \S+ -> \S+\.)?( Fields: [\w, ]+\.)?)$/,
];
/** Fixed labels followed by the person's text (history fields in history.ts, chat approvals). */
const GENERATED_LABEL = /^(Decisions|Files|Next|Blockers|quote|signals|reasons): /;
