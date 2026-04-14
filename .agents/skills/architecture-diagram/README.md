# Architecture Diagram Skill

Generates SVG architecture diagrams from the live project structure.

## Overview

This skill scans the current project and produces a visual architecture diagram showing:
- Project structure
- Skill registry
- Agent definitions  
- Custom commands
- CI/CD pipeline

## Usage

```bash
# Generate architecture diagram
Update the architecture diagram for this project

# The diagram will be saved to docs/architecture.svg
```

## Output

- **File**: `docs/architecture.svg`
- **Format**: Standalone SVG, viewBox 680 × auto
- **Compatibility**: GitHub README embedding

## Customization

Create `docs/diagram-config.json` to customize:

```json
{
  "title": "Project Architecture",
  "project_name": "My Project",
  "author": "maintainer",
  "pipeline_stages": [
    {"name": "Lint", "status": "pass"},
    {"name": "Test", "status": "pass"},
    {"name": "Build", "status": "pass"},
    {"name": "Deploy", "status": "pass"}
  ],
  "accent_color": "#FF6B35",
  "bg_color": "#FFFFFF"
}
```

## How It Works

1. Discovers project structure
2. Counts skills, agents, and commands
3. Generates SVG visualization
4. Embeddable in README with `![Architecture](docs/architecture.svg)`
