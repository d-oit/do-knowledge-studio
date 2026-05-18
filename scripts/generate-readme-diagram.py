import re
import os
import sys

START_MARKER = "<!-- START_DIAGRAM -->"
END_MARKER = "<!-- END_DIAGRAM -->"
ARCH_HEADING = "## 🏗️ Architecture"

def generate_mermaid():
    return """
```mermaid
graph TD
    subgraph UI_Layer [UI Layer (React 19)]
        Editor[Rich Text Editor]
        Graph[Knowledge Graph]
        MindMap[Mind Maps]
        Chat[AI Chat]
    end

    subgraph Logic_Layer [Logic & Search]
        Repository[Repository API]
        Orama[Orama Search Index]
        Jobs[Job Coordinator]
    end

    subgraph Data_Layer [Data & Storage]
        Worker[SQLite Worker]
        SQLite[SQLite WASM + FTS5]
        OPFS[Browser OPFS Storage]
    end

    Editor --> Repository
    Graph --> Repository
    MindMap --> Repository
    Chat --> Repository
    Chat --> Orama

    Repository --> Jobs
    Jobs --> Orama
    Repository --> Worker
    Worker --> SQLite
    SQLite --> OPFS

    CLI[TS CLI] --> Repository
    Export[Export Engine] --> Repository
```
"""

def get_updated_content(content):
    mermaid_code = generate_mermaid()
    pattern = re.compile(f"{re.escape(START_MARKER)}.*?{re.escape(END_MARKER)}", re.DOTALL)

    if pattern.search(content):
        return pattern.sub(f"{START_MARKER}\n{mermaid_code}\n{END_MARKER}", content)
    elif ARCH_HEADING in content:
        return content.replace(ARCH_HEADING, f"{ARCH_HEADING}\n\n{START_MARKER}\n{mermaid_code}\n{END_MARKER}")
    else:
        return None

def update_readme(readme_path="README.md"):
    if not os.path.exists(readme_path):
        print(f"Error: {readme_path} not found.")
        return False

    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = get_updated_content(content)

    if new_content is None:
        print(f"Could not find markers or heading '{ARCH_HEADING}' to insert diagram.")
        return False

    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Updated {readme_path} with architecture diagram.")
    return True

if __name__ == "__main__":
    if update_readme():
        sys.exit(0)
    else:
        sys.exit(1)
