import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'LSJI',
  tagline: 'Learning System for JavaScript Intelligence',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://lsji.ryopc.org',
  baseUrl: '/',

  organizationName: 'ryotagtagtag-wq',
  projectName: 'LSJI',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/ryotagtagtag-wq/LSJI/tree/main/docs/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/ryotagtagtag-wq/LSJI/tree/main/docs/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/lsji-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'LSJI',
      logo: {
        alt: 'LSJI Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/ryotagtagtag-wq/LSJI',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/lsji',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'Core Concepts',
              to: '/docs/core-concepts',
            },
            {
              label: 'API Reference',
              to: '/docs/api/agent',
            },
            {
              label: 'CLI Reference',
              to: '/docs/cli',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/ryotagtagtag-wq/LSJI/issues',
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/ryotagtagtag-wq/LSJI/discussions',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/ryotagtagtag-wq/LSJI',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/lsji',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} LSJI Contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
