# TRIZ Analysis: Knowledge Management Contradictions

## 1. Structure vs. Ease of Use
- **Contradiction**: Structured data (claims, links) requires complex forms, but users want simple writing (Markdown).
- **TRIZ Principle**: **1. Segmentation** (Separate the storage model from the UI) and **15. Dynamicity** (Allow text to be parsed into structure dynamically).

## 2. Privacy vs. Intelligence
- **Contradiction**: Synthesis requires LLM power, but privacy forbids sending data to cloud APIs.
- **TRIZ Principle**: **28. Mechanics Substitution** (Use local search + context builders or local WASM LLMs).

## 3. Depth vs. Performance
- **Contradiction**: Large graphs are slow to render, but relationships are vital.
- **TRIZ Principle**: **2. Taking Out** (Only render local neighborhoods of entities) and **17. Another Dimension** (Switch between hierarchy/Mind Map and network/Graph).
