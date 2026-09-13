import { defineConfig } from 'vitepress';

import { icon } from './icons.ts';

const DESCRIPTION =
  'Action Wire adds a text assistant to a web application. The assistant reads the WebMCP tools the application already registers, and calls them. The application keeps one definition of each tool.';

/** Sidebar links carry the icon the page used to declare in its frontmatter. */
function link(name: string, text: string, path: string) {
  return { text: icon(name) + text, link: path };
}

export default defineConfig({
  title: 'Action Wire',
  description: DESCRIPTION,
  lang: 'en-US',

  // Project page subpath. Keep in sync with `sitemap.hostname`.
  base: '/action-wire/',

  cleanUrls: true,
  lastUpdated: true,

  sitemap: { hostname: 'https://hamedniroomand.github.io/action-wire/' },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/action-wire/icon.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/action-wire/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#2566f0' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Action Wire' }],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    [
      'meta',
      { property: 'og:image', content: 'https://hamedniroomand.github.io/action-wire/logo.png' },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    // A fence written as ```ts [tools.ts] keeps its filename. VitePress parses
    // the label for code groups but shows the language elsewhere, so put the
    // label in the badge the block already renders.
    config(md) {
      const fence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        // A mermaid fence is a diagram, not a code block. Hand it to the
        // component that draws it in the browser.
        if (token.info.trim() === 'mermaid') {
          return `<Mermaid code="${encodeURIComponent(token.content)}" />`;
        }
        // Read the label first. The renderer this wraps strips it from the token.
        const title = token.info.match(/\[(.+?)\]/)?.[1];
        const html = fence(tokens, idx, options, env, self);
        return title
          ? html.replace(/<span class="lang">.*?<\/span>/, `<span class="lang">${title}</span>`)
          : html;
      };
    },
  },

  themeConfig: {
    logo: '/icon.svg',
    siteTitle: 'Action Wire',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/', activeMatch: '/reference/' },
      { text: 'Project', link: '/project/', activeMatch: '/project/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            link('compass', 'Introduction', '/guide/'),
            link('package', 'Installation', '/guide/installation'),
            link('chrome', 'Browser setup', '/guide/browser-setup'),
            link('rocket', 'Quickstart', '/guide/quickstart'),
          ],
        },
        {
          text: 'Build',
          items: [
            link('server', 'Model endpoint', '/guide/model-endpoint'),
            link('shield-check', 'Confirmations', '/guide/confirmations'),
            link('unplug', 'Without native WebMCP', '/guide/without-webmcp'),
            link('boxes', 'Frameworks', '/guide/frameworks'),
            link('palette', 'Styling', '/guide/styling'),
            link('life-buoy', 'Troubleshooting', '/guide/troubleshooting'),
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            link('braces', 'Package', '/reference/'),
            link('message-square', 'Widget', '/reference/widget'),
            link('terminal', 'Headless bridge', '/reference/headless'),
            link('plug', 'ToolSource', '/reference/tool-source'),
            link('brain', 'Model adapter', '/reference/model-adapter'),
            link('circle-alert', 'Errors', '/reference/errors'),
          ],
        },
      ],
      '/project/': [
        {
          text: 'Project',
          items: [
            link('folder-git-2', 'Overview', '/project/'),
            link('network', 'Architecture', '/project/architecture'),
            link('badge-check', 'Compatibility', '/project/compatibility'),
            link('hammer', 'Development', '/project/development'),
          ],
        },
      ],
    },

    outline: { level: [2, 3], label: 'On this page' },

    socialLinks: [{ icon: 'github', link: 'https://github.com/hamedniroomand/action-wire' }],

    editLink: {
      pattern: 'https://github.com/hamedniroomand/action-wire/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present Hamed Niroomand',
    },
  },
});
