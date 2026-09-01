import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'getting-started',
    'core-concepts',
    'runtime-server',
    'plugins',
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/agent',
        'api/qlearning',
        'api/env',
        'api/storage',
        'api/environments',
      ],
    },
    'cli',
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/custom-environment',
        'examples/custom-storage',
        'examples/advanced-training',
      ],
    },
    'architecture',
    'contributing',
  ],
};

export default sidebars;
