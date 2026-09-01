---
title: CLI Reference
description: Command-line interface for training and playing
---

# CLI Reference

LSJI includes a command-line interface for training and playing without writing code.

## Installation

```bash
# Global install
npm install -g lsji

# Or use npx
npx lsji --help
```

## Commands

### `lsji train`

Train the agent.

```bash
lsji train [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--episodes <n>` | Number of training episodes | 200 |
| `--pattern <0-3>` | Training pattern | 0 |
| `--batch-size <n>` | Database batch size | 200 |
| `--opponent <type>` | Opponent strategy | random |
| `--storage <type>` | Storage backend | sqlite |
| `--db-path <path>` | Database file path | ./lsji.db |
| `--alpha <n>` | Learning rate | 0.1 |
| `--gamma <n>` | Discount factor | 0.9 |
| `--epsilon <n>` | Exploration rate | 0.1 |
| `--json` | Output as JSON | false |

**Training Patterns:**
- `0` — Random actions
- `1` — Always Rock
- `2` — Counter previous action
- `3` — Sequential (0,1,2,0,1,2...)

**Opponent Strategies:**
- `random` — Random actions
- `always_rock` — Always plays Rock
- `counter` — Counters agent's previous action
- `sequential` — Cycles through actions

**Examples:**
```bash
# Default training
lsji train --episodes 500

# Train against always-rock opponent
lsji train --episodes 100 --pattern 1 --opponent always_rock

# Train with custom hyperparameters
lsji train --episodes 1000 --alpha 0.05 --gamma 0.95 --epsilon 0.2

# Use memory storage (ephemeral)
lsji train --episodes 100 --storage memory
```

### `lsji play`

Play a single game against the agent.

```bash
lsji play --hand <0|1|2> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--hand <0\|1\|2>` | Your hand: 0=Rock, 1=Scissors, 2=Paper |
| `--opponent <type>` | Opponent strategy |
| `--storage <type>` | Storage backend |
| `--db-path <path>` | Database file path |
| `--json` | Output as JSON |

**Examples:**
```bash
lsji play --hand 0        # Play Rock
lsji play --hand 1        # Play Scissors
lsji play --hand 2 --json # Play Paper, JSON output
```

### `lsji status`

Show system status and statistics.

```bash
lsji status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--storage <type>` | Storage backend |
| `--db-path <path>` | Database file path |
| `--json` | Output as JSON |

**Example:**
```bash
lsji status --json
```

Output:
```json
{
  "status": "running",
  "todayTotal": 42,
  "limit": 90000,
  "performance": [
    { "mode": "train", "total": 1000, "win_rate": 65.5 },
    { "mode": "test", "total": 50, "win_rate": 72.0 }
  ],
  "aiBrain": [
    { "state": "0", "action": 0, "q_value": 0.45 },
    { "state": "0", "action": 1, "q_value": 0.12 }
  ]
}
```

### `lsji start`

Enable training and play.

```bash
lsji start [options]
```

### `lsji stop`

Disable training and play (system paused).

```bash
lsji stop [options]
```

### `lsji help`

Show help message.

```bash
lsji help
lsji --help
lsji -h
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LSJI_STORAGE` | Default storage backend | sqlite |
| `LSJI_DB_PATH` | Default database path | ./lsji.db |

## Examples

### Full Training Session

```bash
# Start fresh
rm -f lsji.db

# Train against random opponent
lsji train --episodes 500 --opponent random

# Train against counter opponent
lsji train --episodes 500 --opponent counter

# Check progress
lsji status --json

# Play a few games
lsji play --hand 0
lsji play --hand 1
lsji play --hand 2
```

### Using Memory Storage (CI/Testing)

```bash
lsji train --episodes 100 --storage memory
lsji play --hand 0 --storage memory
lsji status --storage memory
```

### Custom Hyperparameters

```bash
lsji train \
  --episodes 2000 \
  --alpha 0.05 \
  --gamma 0.95 \
  --epsilon 0.2 \
  --opponent random \
  --storage sqlite \
  --db-path ./custom.db
```
