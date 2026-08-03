import type { Entity, Claim, GraphNode, GraphEdge, ChatMessage } from './types'

const now = new Date()
const iso = (daysAgo: number) => {
  const date = new Date(now)
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}

export const seedEntities: Entity[] = [
  {
    id: 'e1',
    name: 'TRIZ Contradiction Matrix',
    type: 'concept',
    description:
      'A structured 39×39 matrix developed by Genrich Altshuller that maps an engineering contradiction (an improving parameter vs. a worsening parameter) to the most frequently used inventive principles from the analysis of strong patents.',
    content:
      '# TRIZ Contradiction Matrix\n\nThe contradiction matrix is the cornerstone of TRIZ problem-solving. It encodes decades of patent analysis into a lookup table that directs inventors toward the inventive principles most likely to resolve their specific contradiction.\n\n## How it works\n\n1. Identify the **improving parameter** — what you want to make better.\n2. Identify the **worsening parameter** — what gets worse as a result.\n3. Look up the cell at the intersection — it lists 1–4 inventive principles.\n4. Apply those principles as creative prompts.\n\n## The 39 parameters\n\nThe parameters cover engineering space broadly: weight, length, area, volume, speed, force, temperature, brightness, and so on. They are intentionally generic so any technical contradiction can be projected onto them.\n\n## Why it matters\n\nRather than brainstorming randomly, the matrix narrows the search space. A team that would have generated 20 ideas might now generate 4 targeted idea families — each grounded in a proven inventive pattern.',
    sourceUrl: 'https://triz-journal.com',
    tags: ['triz', 'innovation', 'method'],
    createdAt: iso(28),
    updatedAt: iso(2),
    links: [
      { targetId: 'e2', relation: 'developed by' },
      { targetId: 'e3', relation: 'applies' },
      { targetId: 'e7', relation: 'contrasts with' },
    ],
  },
  {
    id: 'e2',
    name: 'Genrich Altshuller',
    type: 'person',
    description:
      'Soviet engineer and science-fiction author (1926–1998) who developed TRIZ. Beginning in 1946, he analyzed thousands of patents to extract the patterns of invention, eventually building a system that he taught to generations of engineers.',
    content:
      '# Genrich Altshuller\n\nAltshuller founded what would become TRIZ while working in the patent office of the Soviet Navy. After his famous 1948 letter to Stalin criticizing the state of Soviet innovation, he was imprisoned for several years — where he continued his research using the prison library.\n\n## Key contributions\n\n- The **40 inventive principles**\n- The **contradiction matrix**\n- **Su-field analysis**\n- **ARIZ** — the algorithm of inventive problem-solving\n- The **laws of technical system evolution**\n\nHis students formed a global community that has continued extending TRIZ for over 70 years.',
    tags: ['triz', 'history', 'soviet'],
    createdAt: iso(25),
    updatedAt: iso(10),
    links: [{ targetId: 'e1', relation: 'developed' }],
  },
  {
    id: 'e3',
    name: '40 Inventive Principles',
    type: 'concept',
    description:
      'The catalogue of recurring solution patterns extracted from patent analysis. Each principle (e.g. Segmentation, Asymmetry, Nesting) is a creative prompt that can be applied to break a contradiction.',
    content:
      '# 40 Inventive Principles\n\nThe principles are the conceptual toolkit of TRIZ. They are not formulas — they are lenses. Applying "Segmentation" to a problem might mean breaking a monolith into modules, dividing a process into stages, or making a solid object porous.\n\n## Common principles\n\n- **#1 Segmentation** — divide an object into independent parts.\n- **#2 Taking out** — separate the interfering part or property.\n- **#15 Dynamics** — allow characteristics to adapt; make rigid objects movable.\n- **#35 Parameter changes** — change physical state, concentration, or flexibility.\n\n## Usage\n\nPrinciples are used as creative prompts. A team reads the principle name, asks "how would we apply this to our problem?", and lets the analogy generate new solution paths.',
    tags: ['triz', 'innovation', 'toolkit'],
    createdAt: iso(20),
    updatedAt: iso(5),
    links: [{ targetId: 'e1', relation: 'used by' }],
  },
  {
    id: 'e4',
    name: 'Knowledge Graph Project',
    type: 'project',
    description:
      'Internal initiative to build a local-first knowledge graph studio that combines rich-text notes, semantic search, and graph visualization — with AI agents for synthesis.',
    content:
      '# Knowledge Graph Project\n\n## Goals\n\n- Capture entities and claims as first-class objects.\n- Visualize relationships as an interactive graph.\n- Search both keyword and semantic.\n- Keep everything local — no backend, no lock-in.\n\n## Status\n\nCurrently in v0.2 — editor, library, graph, and mind map are stable. AI harness and TRIZ matrix are in the lab.',
    tags: ['project', 'knowledge'],
    createdAt: iso(30),
    updatedAt: iso(1),
    links: [
      { targetId: 'e1', relation: 'uses' },
      { targetId: 'e5', relation: 'built with' },
      { targetId: 'e8', relation: 'explores' },
    ],
  },
  {
    id: 'e5',
    name: 'Local-First Software',
    type: 'concept',
    description:
      'A software design philosophy that prioritizes local ownership of data and offline-capable operation, while still allowing optional collaboration. Coined and articulated by Ink & Switch.',
    content:
      '# Local-First Software\n\nThe seven ideals of local-first software:\n\n1. **No spinners** — your work is always available locally.\n2. **Multi-device** — sync when online.\n3. **Collaboration** — not just local single-user.\n4. **Longevity** — data outlives the app.\n5. **Privacy** — encryption by default.\n6. **Real-time** — no manual sync.\n7. **User control** — exit on your terms.\n\n## Why it matters\n\nCloud-only apps can disappear, change pricing, or leak data. Local-first keeps your data on your machine while still enabling collaboration.',
    sourceUrl: 'https://www.inkandswitch.com/local-first/',
    tags: ['philosophy', 'architecture'],
    createdAt: iso(22),
    updatedAt: iso(7),
    links: [{ targetId: 'e4', relation: 'guides' }],
  },
  {
    id: 'e6',
    name: 'Research note on second brains',
    type: 'note',
    description:
      'A reflection on the "second brain" movement and how it relates to local-first knowledge tools.',
    content:
      '# On Second Brains\n\nThe idea of an external system for thinking is old — commonplaces, zettelkasten, shoebox research. What is new is the combination of:\n\n- Rich-text capture\n- Bidirectional links\n- Graph view\n- Semantic search\n- AI synthesis\n\nThe risk is that the tool becomes a graveyard. The discipline is: capture, curate, retrieve. A second brain that you never query is just a pile.',
    tags: ['reflection', 'pkm'],
    createdAt: iso(15),
    updatedAt: iso(3),
    links: [{ targetId: 'e5', relation: 'related to' }],
  },
  {
    id: 'e7',
    name: 'Brainstorming',
    type: 'concept',
    description:
      'Unstructured divergent ideation. Contrasted with structured methods like TRIZ that direct the search for solutions.',
    content:
      '# Brainstorming\n\nBrainstorming is useful for divergent exploration but suffers from anchoring and groupthink. Structured inventive methods like TRIZ compensate by directing attention toward proven inventive patterns.',
    tags: ['method', 'comparison'],
    createdAt: iso(12),
    updatedAt: iso(8),
    links: [{ targetId: 'e1', relation: 'contrasted with' }],
  },
  {
    id: 'e8',
    name: 'Semantic Search',
    type: 'concept',
    description:
      'Search that matches by meaning rather than keywords, typically using vector embeddings. Complements traditional full-text search.',
    content:
      '# Semantic Search\n\nFull-text search (FTS) finds documents that share your keywords. Semantic search finds documents that share your intent.\n\n## Hybrid pipeline\n\n1. **FTS** gives exact-match, fast, interpretable results.\n2. **Semantic** gives meaning-level matches, slower, opaque.\n3. Combine: FTS first, semantic re-rank, or vice versa.\n\nThe studio uses client-side search over localStorage-persisted entities and claims, with ranked retrieval for relevant results.',
    tags: ['search', 'ai'],
    createdAt: iso(10),
    updatedAt: iso(4),
    links: [{ targetId: 'e4', relation: 'powers' }],
  },
]

export const seedClaims: Claim[] = [
  {
    id: 'c1',
    entityId: 'e1',
    statement:
      'The contradiction matrix was derived from analysis of approximately 1.5 million patents.',
    evidence: 'Altshuller et al., 1969.',
    confidence: 0.85,
    verification: 'verified',
    source: 'TRIZ Journal',
    createdAt: iso(28),
    updatedAt: iso(2),
  },
  {
    id: 'c2',
    entityId: 'e2',
    statement:
      'Altshuller was imprisoned from 1950 to 1954 after writing a letter critical of Soviet innovation policy.',
    evidence: 'Biographical accounts.',
    confidence: 0.95,
    verification: 'verified',
    source: 'Wikipedia',
    createdAt: iso(25),
    updatedAt: iso(10),
  },
  {
    id: 'c3',
    entityId: 'e5',
    statement:
      'Local-first was articulated as a named philosophy by the Ink & Switch research lab in a 2019 essay.',
    evidence: 'Ink & Switch, "Local-first software: You own your data, in spite of the cloud".',
    confidence: 0.98,
    verification: 'verified',
    source: 'inkandswitch.com',
    createdAt: iso(22),
    updatedAt: iso(7),
  },
  {
    id: 'c4',
    entityId: 'e7',
    statement:
      'Structured inventive methods outperform unstructured brainstorming by a measurable margin in controlled studies.',
    evidence: 'Mixed evidence; some studies show benefit, others show no difference.',
    confidence: 0.55,
    verification: 'disputed',
    source: 'Research meta-analysis',
    createdAt: iso(12),
    updatedAt: iso(8),
  },
  {
    id: 'c5',
    entityId: 'e8',
    statement:
      'Hybrid search (FTS + semantic) outperforms either alone on knowledge retrieval tasks.',
    evidence: 'Benchmark on internal dataset.',
    confidence: 0.75,
    verification: 'unverified',
    createdAt: iso(10),
    updatedAt: iso(4),
  },
]

export const seedGraph: { nodes: GraphNode[]; edges: GraphEdge[] } = {
  nodes: [
    { id: 'e1', label: 'TRIZ Contradiction Matrix', type: 'concept', x: 400, y: 300 },
    { id: 'e2', label: 'Genrich Altshuller', type: 'person', x: 200, y: 180 },
    { id: 'e3', label: '40 Inventive Principles', type: 'concept', x: 600, y: 180 },
    { id: 'e4', label: 'Knowledge Graph Project', type: 'project', x: 400, y: 500 },
    { id: 'e5', label: 'Local-First Software', type: 'concept', x: 200, y: 420 },
    { id: 'e6', label: 'Research note on second brains', type: 'note', x: 80, y: 540 },
    { id: 'e7', label: 'Brainstorming', type: 'concept', x: 680, y: 360 },
    { id: 'e8', label: 'Semantic Search', type: 'concept', x: 620, y: 540 },
  ],
  edges: [
    { id: 'l1', source: 'e1', target: 'e2', relation: 'developed by' },
    { id: 'l2', source: 'e1', target: 'e3', relation: 'applies' },
    { id: 'l3', source: 'e1', target: 'e7', relation: 'contrasts with' },
    { id: 'l4', source: 'e4', target: 'e1', relation: 'uses' },
    { id: 'l5', source: 'e4', target: 'e5', relation: 'built with' },
    { id: 'l6', source: 'e4', target: 'e8', relation: 'explores' },
    { id: 'l7', source: 'e5', target: 'e6', relation: 'related to' },
    { id: 'l8', source: 'e7', target: 'e1', relation: 'contrasted with' },
  ],
}

export const seedChat: ChatMessage[] = [
  {
    id: 'm1',
    role: 'assistant',
    content:
      "Welcome to your local knowledge studio. I can answer questions about your library, summarize entities, or help you think through contradictions using TRIZ. Try asking \"What is the contradiction matrix useful for?\" or pick one of the suggestions below.",
    timestamp: iso(0),
  },
]

export const trizParameters: string[] = [
  'Weight of moving object',
  'Weight of non-moving object',
  'Length of moving object',
  'Length of non-moving object',
  'Area of moving object',
  'Area of non-moving object',
  'Volume of moving object',
  'Volume of non-moving object',
  'Speed',
  'Force',
  'Tension / Pressure',
  'Shape',
  'Stability of object composition',
  'Strength',
  'Duration of action by moving object',
  'Duration of action by non-moving object',
  'Temperature',
  'Illumination intensity',
  'Energy use by moving object',
  'Energy use by non-moving object',
  'Power',
  'Loss of energy',
  'Loss of substance',
  'Loss of information',
  'Loss of time',
  'Amount of substance',
  'Reliability',
  'Measurement accuracy',
  'Manufacturing precision',
  'External harm affecting object',
  'Object-generated harmful factors',
  'Ease of manufacture',
  'Ease of operation',
  'Ease of repair',
  'Design complexity',
  'Degree of automation',
  'Device complexity',
  'Manufacturing productivity',
  'Adaptability / Versatility',
]

export const trizPrinciples: { id: number; name: string; description: string }[] = [
  { id: 1, name: 'Segmentation', description: 'Divide an object into independent parts; make an object sectional; increase the degree of fragmentation.' },
  { id: 2, name: 'Taking out', description: 'Separate the interfering part or property from an object, or single out the only necessary part.' },
  { id: 3, name: 'Local quality', description: 'Make each part of an object function in conditions most suitable for its operation.' },
  { id: 5, name: 'Combining', description: 'Bring together identical or related tasks; perform simultaneous operations.' },
  { id: 8, name: 'Anti-weight', description: 'Compensate for the weight of an object by combining it with something that provides lift.' },
  { id: 10, name: 'Preliminary action', description: 'Perform the required action in advance, fully or partially.' },
  { id: 13, name: 'The other way round', description: 'Instead of the direct action dictated by the problem, implement an opposite action.' },
  { id: 15, name: 'Dynamics', description: 'Allow characteristics of an object to change to be optimal; make rigid objects movable.' },
  { id: 17, name: 'Another dimension', description: 'Move an object in 2D to 3D; use multi-layered arrangements.' },
  { id: 18, name: 'Mechanical vibration', description: 'Cause an object to oscillate; use ultrasound; resonance; piezoelectric vibrators.' },
  { id: 19, name: 'Periodic action', description: 'Replace a continuous action with a periodic one.' },
  { id: 28, name: 'Mechanics substitution', description: 'Replace a mechanical system with a sensory, optical, acoustic, or electric one.' },
  { id: 35, name: 'Parameter changes', description: 'Change the physical state, concentration, consistency, or flexibility of an object.' },
  { id: 40, name: 'Composite materials', description: 'Change from uniform to composite materials.' },
]
