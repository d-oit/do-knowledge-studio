import re
import os

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

def update_readme(readme_path="README.md"):
    if not os.path.exists(readme_path):
        print(f"Error: {readme_path} not found.")
        return

    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    mermaid_code = generate_mermaid()

    # Define start and end markers
    start_marker = "<!-- START_DIAGRAM -->"
    end_marker = "<!-- END_DIAGRAM -->"

    pattern = re.compile(f"{re.escape(start_marker)}.*?{re.escape(end_marker)}", re.DOTALL)

    if pattern.search(content):
        new_content = pattern.sub(f"{start_marker}\n{mermaid_code}\n{end_marker}", content)
    else:
        # If markers don't exist, insert after the Architecture heading
        arch_heading = "## 🏗️ Architecture"
        if arch_heading in content:
            new_content = content.replace(arch_heading, f"{arch_heading}\n\n{start_marker}\n{mermaid_code}\n{end_marker}")
        else:
            print("Could not find Architecture heading to insert diagram.")
            return

    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Updated {readme_path} with architecture diagram.")

if __name__ == "__main__":
    update_readme()
