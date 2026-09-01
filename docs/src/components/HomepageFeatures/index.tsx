import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Tabular Q-Learning',
    icon: '🧠',
    description: (
      <>
        Classic TD learning with configurable learning rate (α), discount factor (γ), 
        and exploration rate (ε). Supports both full TD updates and simplified 
        terminal-state updates.
      </>
    ),
  },
  {
    title: 'Pluggable Storage',
    icon: '💾',
    description: (
      <>
        Three built-in backends: node:sqlite (zero deps, recommended), 
        better-sqlite3 (high performance), and in-memory (testing). 
        Easy to implement custom backends.
      </>
    ),
  },
  {
    title: 'Custom Environments',
    icon: '🎮',
    description: (
      <>
        Implement the Env interface for any RL problem. Includes 
        RockPaperScissorsEnv with 4 opponent strategies for quick testing.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center" style={{fontSize: '3rem'}}>
        {icon}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
