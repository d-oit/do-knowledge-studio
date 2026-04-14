# Dependency Analysis

Cross-file dependency tracking for safe migrations with 2026 tooling updates.

## Overview

This guide covers techniques for analyzing and tracking dependencies between code files, services, and infrastructure components during migrations, incorporating modern tools and AI-assisted analysis.

## Code-Level Dependencies (2026 Tools)

### Python Import Analysis with Modern Tooling

Modern Python dependency analysis uses `ast` and `importlib` for comprehensive tracking:

```python
# analyze_imports.py - Enhanced for 2026
import ast
import os
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field
import networkx as nx  # For graph analysis

@dataclass
class ImportInfo:
    module: str
    names: List[str]
    is_from_import: bool
    level: int  # Relative import level
    line_number: int
    is_conditional: bool  # Inside try/except or if block

@dataclass
class ModuleAnalysis:
    filepath: Path
    imports: List[ImportInfo] = field(default_factory=list)
    exports: List[str] = field(default_factory=list)
    dependencies: Set[str] = field(default_factory=set)
    reverse_dependencies: Set[str] = field(default_factory=set)

class ModernImportAnalyzer:
    """
    Advanced Python import analyzer with support for:
    - Conditional imports (try/except blocks)
    - Dynamic imports (importlib, __import__)
    - Type checking only imports
    - Third-party vs stdlib vs local classification
    """
    
    STDLIB_MODULES = set(sys.stdlib_module_names) if hasattr(sys, 'stdlib_module_names') else {
        'os', 'sys', 'typing', 'collections', 'json', 're', 'datetime',
        'pathlib', 'functools', 'itertools', 'contextlib', 'logging'
    }
    
    def __init__(self, source_dir: Path, project_name: str = ""):
        self.source_dir = Path(source_dir)
        self.project_name = project_name
        self.modules: Dict[str, ModuleAnalysis] = {}
        self.dependency_graph = nx.DiGraph()
        
    def analyze_file(self, filepath: Path) -> ModuleAnalysis:
        """Extract all imports from a Python file with enhanced detection"""
        try:
            content = filepath.read_text(encoding='utf-8')
            tree = ast.parse(content)
        except (SyntaxError, UnicodeDecodeError) as e:
            print(f"Warning: Could not parse {filepath}: {e}")
            return ModuleAnalysis(filepath=filepath)
        
        analysis = ModuleAnalysis(filepath=filepath)
        module_name = self._filepath_to_module(filepath)
        
        # Track conditional context
        in_conditional = False
        
        for node in ast.walk(tree):
            # Track conditional blocks
            if isinstance(node, (ast.Try, ast.If)):
                in_conditional = True
            
            if isinstance(node, ast.Import):
                for alias in node.names:
                    info = ImportInfo(
                        module=alias.name,
                        names=[alias.asname or alias.name],
                        is_from_import=False,
                        level=0,
                        line_number=node.lineno,
                        is_conditional=in_conditional
                    )
                    analysis.imports.append(info)
                    analysis.dependencies.add(alias.name.split('.')[0])
                    
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ''
                names = [alias.name for alias in node.names]
                info = ImportInfo(
                    module=module,
                    names=names,
                    is_from_import=True,
                    level=node.level,
                    line_number=node.lineno,
                    is_conditional=in_conditional
                )
                analysis.imports.append(info)
                
                # Determine base module
                if node.level > 0:
                    # Relative import
                    base = self._resolve_relative_import(module_name, node.level, module)
                else:
                    base = module.split('.')[0] if module else ''
                
                if base:
                    analysis.dependencies.add(base)
            
            # Detect dynamic imports
            elif isinstance(node, ast.Call):
                if (isinstance(node.func, ast.Name) and node.func.id == '__import__'):
                    # Dynamic import detected
                    if node.args and isinstance(node.args[0], ast.Constant):
                        analysis.dependencies.add(node.args[0].value.split('.')[0])
        
        # Extract exports
        analysis.exports = self._extract_exports(tree)
        
        self.modules[module_name] = analysis
        return analysis
    
    def _filepath_to_module(self, filepath: Path) -> str:
        """Convert file path to module name"""
        rel_path = filepath.relative_to(self.source_dir)
        parts = list(rel_path.with_suffix('').parts)
        return '.'.join(parts)
    
    def _resolve_relative_import(self, current_module: str, level: int, module: str) -> str:
        """Resolve relative import to absolute module name"""
        current_parts = current_module.split('.')
        base_parts = current_parts[:-level] if level <= len(current_parts) else []
        if module:
            return '.'.join(base_parts + [module])
        return '.'.join(base_parts) if base_parts else ''
    
    def _extract_exports(self, tree: ast.AST) -> List[str]:
        """Extract public exports from module"""
        exports = []
        
        # __all__ definition
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == '__all__':
                        if isinstance(node.value, (ast.List, ast.Tuple)):
                            for elt in node.value.elts:
                                if isinstance(elt, ast.Constant):
                                    exports.append(elt.value)
        
        # Public classes and functions
        for node in ast.walk(tree):
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                if not node.name.startswith('_'):
                    exports.append(node.name)
        
        return exports
    
    def build_dependency_graph(self) -> nx.DiGraph:
        """Build NetworkX directed graph of dependencies"""
        for module_name, analysis in self.modules.items():
            self.dependency_graph.add_node(module_name, 
                                           filepath=str(analysis.filepath))
            
            for dep in analysis.dependencies:
                if dep in self.modules or self._is_local_module(dep):
                    self.dependency_graph.add_edge(module_name, dep)
        
        return self.dependency_graph
    
    def _is_local_module(self, module_name: str) -> bool:
        """Check if module is part of the local project"""
        return module_name.startswith(self.project_name) if self.project_name else False
    
    def find_impacted_files(self, changed_module: str) -> Set[str]:
        """Find all files that import or depend on a changed module"""
        impacted = set()
        
        # Direct dependents
        for module, analysis in self.modules.items():
            if changed_module in analysis.dependencies:
                impacted.add(module)
        
        # Transitive dependents (recursive)
        to_process = list(impacted)
        while to_process:
            current = to_process.pop()
            for module, analysis in self.modules.items():
                if current in analysis.dependencies and module not in impacted:
                    impacted.add(module)
                    to_process.append(module)
        
        return impacted
    
    def detect_circular_dependencies(self) -> List[List[str]]:
        """Detect circular dependencies using cycle detection"""
        try:
            cycles = list(nx.simple_cycles(self.dependency_graph))
            return cycles
        except nx.NetworkXNoCycle:
            return []
    
    def classify_dependencies(self, module_name: str) -> Dict[str, Set[str]]:
        """Classify dependencies as stdlib, third-party, or local"""
        analysis = self.modules.get(module_name)
        if not analysis:
            return {}
        
        classification = {
            'stdlib': set(),
            'third_party': set(),
            'local': set()
        }
        
        for dep in analysis.dependencies:
            if dep in self.STDLIB_MODULES:
                classification['stdlib'].add(dep)
            elif dep in self.modules:
                classification['local'].add(dep)
            else:
                classification['third_party'].add(dep)
        
        return classification
```

### JavaScript/TypeScript Module Analysis (2026)

```javascript
// dependency-analyzer.js - Modern ES2022+ support
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const resolve = require('resolve');

class ModernJSDependencyAnalyzer {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.aliasedPaths = options.aliasedPaths || {};
    this.visited = new Set();
    this.graph = new Map();
  }

  analyzeFile(filepath) {
    if (this.visited.has(filepath)) {
      return this.graph.get(filepath);
    }
    
    this.visited.add(filepath);
    
    const content = fs.readFileSync(filepath, 'utf-8');
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator',
        'topLevelAwait'
      ]
    });
    
    const imports = [];
    const exports = [];
    const dynamicImports = [];
    const typeOnlyImports = []; // TypeScript specific
    
    traverse(ast, {
      // ES6 imports
      ImportDeclaration({ node }) {
        const importInfo = {
          source: node.source.value,
          specifiers: node.specifiers.map(s => ({
            type: s.type,
            local: s.local.name,
            imported: s.imported?.name || s.local.name
          })),
          isTypeOnly: node.importKind === 'type' || node.source.value.startsWith('type ')
        };
        
        if (importInfo.isTypeOnly) {
          typeOnlyImports.push(importInfo);
        } else {
          imports.push(importInfo);
        }
      },
      
      // CommonJS requires
      CallExpression({ node }) {
        if (node.callee.name === 'require' && 
            node.arguments[0]?.type === 'StringLiteral') {
          imports.push({
            source: node.arguments[0].value,
            specifiers: [],
            isRequire: true
          });
        }
        
        // Dynamic imports
        if (node.callee.type === 'Import') {
          dynamicImports.push({
            source: node.arguments[0]?.value || '<dynamic>',
            location: node.loc
          });
        }
      },
      
      // Exports
      ExportNamedDeclaration({ node }) {
        if (node.declaration) {
          exports.push(this._extractExport(node.declaration));
        }
        node.specifiers.forEach(spec => {
          exports.push({
            name: spec.exported.name,
            local: spec.local.name,
            type: 're-export'
          });
        });
      },
      
      ExportDefaultDeclaration({ node }) {
        exports.push({
          name: 'default',
          type: node.declaration.type
        });
      },
      
      // ES2022 top-level await
      AwaitExpression({ node, parent }) {
        // Track top-level await for module ordering
      }
    });
    
    const analysis = {
      filepath,
      imports,
      exports,
      dynamicImports,
      typeOnlyImports,
      resolved: this._resolveImports(filepath, imports)
    };
    
    this.graph.set(filepath, analysis);
    return analysis;
  }
  
  _extractExport(node) {
    if (node.type === 'FunctionDeclaration') {
      return { name: node.id.name, type: 'function' };
    }
    if (node.type === 'ClassDeclaration') {
      return { name: node.id.name, type: 'class' };
    }
    if (node.type === 'VariableDeclaration') {
      return node.declarations.map(d => ({
        name: d.id.name,
        type: 'variable'
      }));
    }
    return { name: '<unknown>', type: node.type };
  }
  
  _resolveImports(filepath, imports) {
    return imports.map(imp => {
      try {
        const resolved = resolve.sync(imp.source, {
          basedir: path.dirname(filepath),
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
        });
        return { ...imp, resolved };
      } catch (e) {
        return { ...imp, resolved: null, error: e.message };
      }
    });
  }
  
  findCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    
    const dfs = (node, path = []) => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }
      
      if (visited.has(node)) return;
      
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const analysis = this.graph.get(node);
      if (analysis) {
        for (const imp of analysis.resolved) {
          if (imp.resolved) {
            dfs(imp.resolved, [...path]);
          }
        }
      }
      
      recursionStack.delete(node);
    };
    
    for (const [filepath] of this.graph) {
      dfs(filepath);
    }
    
    return cycles;
  }
}

module.exports = { ModernJSDependencyAnalyzer };
```

## Circular Dependency Detection (2026)

Modern circular dependency detection with severity analysis:

```python
# circular_dependency_analyzer.py
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import networkx as nx

class CycleSeverity(Enum):
    CRITICAL = "critical"      # Runtime errors, cannot start
    HIGH = "high"              # Risk of issues, affects initialization
    MEDIUM = "medium"          # Code smell, may cause issues
    LOW = "low"                # Minor, mostly aesthetic concern

@dataclass
class CycleAnalysis:
    cycle: List[str]
    severity: CycleSeverity
    description: str
    files_involved: List[str]
    suggested_break_points: List[Tuple[str, str]]

class CircularDependencyAnalyzer:
    """
    Advanced circular dependency analyzer with severity assessment
    and remediation suggestions.
    """
    
    def __init__(self, dependency_graph: nx.DiGraph):
        self.graph = dependency_graph
        self.cycles: List[CycleAnalysis] = []
        
    def detect_all_cycles(self) -> List[CycleAnalysis]:
        """Detect and analyze all circular dependencies"""
        try:
            # Find all simple cycles
            simple_cycles = list(nx.simple_cycles(self.graph))
            
            # Find cycles with detailed analysis
            for cycle in simple_cycles:
                analysis = self._analyze_cycle(cycle)
                self.cycles.append(analysis)
            
            return self.cycles
        except nx.NetworkXNoCycle:
            return []
    
    def _analyze_cycle(self, cycle: List[str]) -> CycleAnalysis:
        """Analyze a specific cycle for severity and remediation"""
        # Determine severity based on cycle characteristics
        severity = self._calculate_severity(cycle)
        
        # Find best points to break the cycle
        break_points = self._suggest_break_points(cycle)
        
        # Get files involved
        files = self._get_files_in_cycle(cycle)
        
        return CycleAnalysis(
            cycle=cycle,
            severity=severity,
            description=self._generate_description(cycle, severity),
            files_involved=files,
            suggested_break_points=break_points
        )
    
    def _calculate_severity(self, cycle: List[str]) -> CycleSeverity:
        """Calculate severity based on cycle characteristics"""
        # Check if it's a runtime import cycle
        runtime_imports = self._check_runtime_imports(cycle)
        if runtime_imports:
            return CycleSeverity.CRITICAL
        
        # Check if cycle involves type-only imports (TypeScript)
        if self._is_type_only_cycle(cycle):
            return CycleSeverity.LOW
        
        # Check initialization dependencies
        if self._has_init_dependencies(cycle):
            return CycleSeverity.HIGH
        
        # Check for side effects
        if self._has_side_effects(cycle):
            return CycleSeverity.HIGH
        
        return CycleSeverity.MEDIUM
    
    def _check_runtime_imports(self, cycle: List[str]) -> bool:
        """Check if cycle involves runtime imports that could fail"""
        # Analyze if imports happen at module load time
        for i, module in enumerate(cycle):
            next_module = cycle[(i + 1) % len(cycle)]
            edge_data = self.graph.get_edge_data(module, next_module)
            if edge_data and edge_data.get('is_runtime', False):
                return True
        return False
    
    def _is_type_only_cycle(self, cycle: List[str]) -> bool:
        """Check if cycle is only type imports (not runtime issue)"""
        for i, module in enumerate(cycle):
            next_module = cycle[(i + 1) % len(cycle)]
            edge_data = self.graph.get_edge_data(module, next_module)
            if edge_data and not edge_data.get('is_type_only', False):
                return False
        return True
    
    def _has_init_dependencies(self, cycle: List[str]) -> bool:
        """Check if cycle involves __init__ or initialization dependencies"""
        for module in cycle:
            if '.__init__' in module or module.endswith('.__init__'):
                return True
        return False
    
    def _has_side_effects(self, cycle: List[str]) -> bool:
        """Check if modules in cycle have side effects on import"""
        # This would require AST analysis of each module
        # Placeholder for side effect detection
        return False
    
    def _suggest_break_points(self, cycle: List[str]) -> List[Tuple[str, str]]:
        """Suggest optimal points to break the cycle"""
        suggestions = []
        
        for i in range(len(cycle)):
            current = cycle[i]
            next_module = cycle[(i + 1) % len(cycle)]
            
            # Check if this edge is a good candidate for breaking
            if self._is_good_break_point(current, next_module):
                suggestions.append((current, next_module))
        
        # Sort by best candidates (fewest downstream dependencies)
        suggestions.sort(key=lambda x: self.graph.out_degree(x[0]))
        
        return suggestions[:3]  # Top 3 suggestions
    
    def _is_good_break_point(self, from_module: str, to_module: str) -> bool:
        """Determine if this edge is a good candidate for breaking"""
        # Prefer breaking at interface boundaries
        edge_data = self.graph.get_edge_data(from_module, to_module)
        if edge_data:
            # Type imports can usually be deferred
            if edge_data.get('is_type_only'):
                return True
            # Dynamic imports are good break points
            if edge_data.get('is_dynamic'):
                return True
        return False
    
    def _get_files_in_cycle(self, cycle: List[str]) -> List[str]:
        """Get actual file paths for modules in cycle"""
        files = []
        for module in cycle:
            node_data = self.graph.nodes.get(module, {})
            filepath = node_data.get('filepath')
            if filepath:
                files.append(filepath)
        return files
    
    def _generate_description(self, cycle: List[str], 
                              severity: CycleSeverity) -> str:
        """Generate human-readable description of the cycle"""
        cycle_str = ' -> '.join(cycle) + f' -> {cycle[0]}'
        
        descriptions = {
            CycleSeverity.CRITICAL: f"Runtime circular dependency: {cycle_str}. "
                                    "May cause import errors or infinite loops.",
            CycleSeverity.HIGH: f"Initialization circular dependency: {cycle_str}. "
                                 "May cause startup issues or unexpected behavior.",
            CycleSeverity.MEDIUM: f"Circular dependency: {cycle_str}. "
                                "Code smell that may cause maintenance issues.",
            CycleSeverity.LOW: f"Type-only circular dependency: {cycle_str}. "
                             "Low impact, primarily affects IDE performance."
        }
        
        return descriptions.get(severity, f"Unknown severity cycle: {cycle_str}")
    
    def generate_fix_suggestions(self, cycle_analysis: CycleAnalysis) -> List[str]:
        """Generate specific code suggestions to break the cycle"""
        suggestions = []
        
        for from_mod, to_mod in cycle_analysis.suggested_break_points:
            # Suggest dependency injection
            suggestions.append(
                f"Move dependency from {from_mod} to {to_mod} using dependency injection"
            )
            
            # Suggest interface extraction
            suggestions.append(
                f"Extract interface from {to_mod} to break direct dependency"
            )
            
            # Suggest lazy import
            suggestions.append(
                f"Use lazy import in {from_mod}: move import inside function"
            )
        
        return suggestions
```

## Service Dependencies (2026)

### Service Mesh Integration

Modern service dependency tracking with service mesh support:

```yaml
# service-dependencies.yml - Enhanced for 2026
services:
  api-gateway:
    depends_on:
      - service: user-service
        type: http
        criticality: required
        timeout_ms: 5000
        retry_policy: exponential_backoff
      - service: order-service
        type: http
        criticality: required
      - service: payment-service
        type: http
        criticality: required
        circuit_breaker: true
    endpoints:
      - /api/v1/users
      - /api/v1/orders
    service_mesh:
      enabled: true
      mtls: true
      traffic_split:
        canary: 10
        stable: 90
      
  user-service:
    depends_on:
      - service: postgres
        type: database
        criticality: required
      - service: redis
        type: cache
        criticality: optional
    consumers:
      - api-gateway
      - notification-service
    events:
      produces:
        - topic: user.created
          schema: user-events/v1
        - topic: user.updated
          schema: user-events/v1
          
  order-service:
    depends_on:
      - service: postgres
        type: database
      - service: user-service
        type: http
        async: true  # Async communication pattern
      - service: inventory-service
        type: http
        criticality: required
    circuit_breaker:
      failure_threshold: 5
      recovery_timeout_ms: 30000
    events:
      produces:
        - topic: order.created
          schema: order-events/v2
        - topic: order.updated
          schema: order-events/v2
      consumes:
        - topic: inventory.reserved
          handler: onInventoryReserved
```

### Dependency Visualization

```python
import graphviz
from typing import Dict, List
import networkx as nx

class DependencyVisualizer:
    """Create visualizations of service dependencies"""
    
    def create_service_graph(self, dependencies: Dict) -> graphviz.Digraph:
        """Create Graphviz diagram of service dependencies"""
        dot = graphviz.Digraph(comment='Service Dependencies')
        dot.attr(rankdir='TB')
        dot.attr('node', shape='box', style='rounded')
        
        # Add nodes with status colors
        for service, config in dependencies.items():
            # Color based on health/criticality
            color = self._get_node_color(config)
            dot.node(service, service, fillcolor=color, style='filled')
        
        # Add edges with type indicators
        for service, config in dependencies.items():
            for dep in config.get('depends_on', []):
                dep_name = dep['service'] if isinstance(dep, dict) else dep
                edge_style = self._get_edge_style(dep)
                dot.edge(service, dep_name, **edge_style)
        
        return dot
    
    def create_critical_path_diagram(self, dependencies: Dict) -> graphviz.Digraph:
        """Highlight critical path through system"""
        # Find services with most dependents
        dependents = self._calculate_dependents(dependencies)
        
        dot = graphviz.Digraph(comment='Critical Path')
        dot.attr(rankdir='TB')
        
        # Highlight critical services
        for service, count in dependents:
            size = 0.5 + (count * 0.1)  # Size proportional to dependents
            color = 'red' if count > 5 else 'orange' if count > 2 else 'lightblue'
            dot.node(service, f'{service}\n({count} deps)', 
                    width=str(size), height=str(size),
                    fillcolor=color, style='filled')
        
        return dot
    
    def _get_node_color(self, config: Dict) -> str:
        """Determine node color based on service characteristics"""
        if config.get('health') == 'unhealthy':
            return 'red'
        elif config.get('criticality') == 'critical':
            return 'orange'
        elif config.get('service_mesh', {}).get('canary', 0) > 0:
            return 'yellow'  # In canary
        return 'lightblue'
    
    def _get_edge_style(self, dep) -> Dict:
        """Determine edge style based on dependency type"""
        if isinstance(dep, dict):
            dep_type = dep.get('type', 'http')
            criticality = dep.get('criticality', 'required')
            
            styles = {
                'database': {'style': 'bold', 'color': 'blue'},
                'cache': {'style': 'dashed', 'color': 'green'},
                'http': {'style': 'solid', 'color': 'black'},
                'async': {'style': 'dotted', 'color': 'purple'}
            }
            
            style = styles.get(dep_type, {'style': 'solid'})
            
            if criticality == 'optional':
                style['style'] = 'dashed'
            
            return style
        
        return {'style': 'solid'}
    
    def _calculate_dependents(self, dependencies: Dict) -> List[tuple]:
        """Calculate number of services depending on each service"""
        dependents = {}
        for service, config in dependencies.items():
            for dep in config.get('depends_on', []):
                dep_name = dep['service'] if isinstance(dep, dict) else dep
                dependents[dep_name] = dependents.get(dep_name, 0) + 1
        
        return sorted(dependents.items(), key=lambda x: x[1], reverse=True)
```

## Database Dependencies

### Schema Dependency Analysis

```sql
-- PostgreSQL: Enhanced dependency query
WITH RECURSIVE dependency_tree AS (
    -- Base case: direct foreign keys
    SELECT 
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        1 as depth
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    
    UNION ALL
    
    -- Recursive case: transitive dependencies
    SELECT 
        dt.table_schema,
        dt.table_name,
        dt.column_name,
        ccu.table_schema,
        ccu.table_name,
        ccu.column_name,
        dt.depth + 1
    FROM dependency_tree dt
    JOIN information_schema.table_constraints tc
        ON tc.table_name = dt.foreign_table_name
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND dt.depth < 10  -- Prevent infinite recursion
)
SELECT * FROM dependency_tree
ORDER BY depth, table_schema, table_name;
```

### Migration Order Calculation

```python
from collections import defaultdict, deque
from typing import List, Dict, Set

class MigrationOrderCalculator:
    """
    Calculate safe migration order using topological sort
    with support for complex dependency graphs.
    """
    
    def __init__(self):
        self.graph = defaultdict(list)
        self.in_degree = defaultdict(int)
        self.nodes = set()
    
    def add_dependency(self, table: str, depends_on: str):
        """Add edge: table depends_on -> table"""
        self.graph[depends_on].append(table)
        self.in_degree[table] += 1
        self.nodes.add(table)
        self.nodes.add(depends_on)
        
        if depends_on not in self.in_degree:
            self.in_degree[depends_on] = 0
    
    def calculate_migration_order(self) -> List[str]:
        """
        Calculate safe migration order using Kahn's algorithm.
        Returns tables in order they should be migrated.
        """
        # Initialize with nodes having no dependencies
        queue = deque([t for t in self.nodes if self.in_degree[t] == 0])
        result = []
        
        while queue:
            table = queue.popleft()
            result.append(table)
            
            # Process dependents
            for dependent in self.graph[table]:
                self.in_degree[dependent] -= 1
                if self.in_degree[dependent] == 0:
                    queue.append(dependent)
        
        if len(result) != len(self.nodes):
            cycles = self._find_cycles()
            raise ValueError(f"Circular dependencies detected: {cycles}")
        
        return result
    
    def _find_cycles(self) -> List[List[str]]:
        """Find all cycles in the graph for error reporting"""
        cycles = []
        visited = set()
        path = []
        
        def dfs(node):
            if node in path:
                cycle_start = path.index(node)
                cycles.append(path[cycle_start:] + [node])
                return
            
            if node in visited:
                return
            
            visited.add(node)
            path.append(node)
            
            for neighbor in self.graph[node]:
                dfs(neighbor)
            
            path.pop()
        
        for node in self.nodes:
            dfs(node)
        
        return cycles
    
    def get_parallel_groups(self) -> List[Set[str]]:
        """
        Get groups of tables that can be migrated in parallel.
        Each group has no dependencies on each other.
        """
        order = self.calculate_migration_order()
        groups = []
        current_group = set()
        processed = set()
        
        for table in order:
            # Check if all dependencies are processed
            deps_satisfied = all(
                dep in processed 
                for dep in self._get_dependencies(table)
            )
            
            if deps_satisfied:
                current_group.add(table)
            else:
                if current_group:
                    groups.append(current_group)
                    processed.update(current_group)
                current_group = {table}
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _get_dependencies(self, table: str) -> Set[str]:
        """Get direct dependencies of a table"""
        deps = set()
        for t, dependents in self.graph.items():
            if table in dependents:
                deps.add(t)
        return deps
```

## CI/CD Integration (2026)

### Smart Test Selection

```yaml
# .github/workflows/smart-test.yml - 2026 Enhanced
name: Smart Test Selection

on: [pull_request]

jobs:
  analyze-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for dependency analysis
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Analyze Code Changes
        id: analyze
        run: |
          # Get changed files
          CHANGED_FILES=$(git diff --name-only HEAD^ HEAD | grep '\.py$' || true)
          echo "changed_files=$CHANGED_FILES" >> $GITHUB_OUTPUT
          
          # Build dependency graph
          python scripts/build_dependency_graph.py --output graph.json
          
          # Find impacted modules
          IMPACTED=$(python scripts/find_impacted.py \
            --graph graph.json \
            --changed-files "$CHANGED_FILES" \
            --output json)
          echo "impacted_modules=$IMPACTED" >> $GITHUB_OUTPUT
          
          # Detect circular dependencies in changed code
          CIRCULAR=$(python scripts/detect_circular.py \
            --graph graph.json \
            --scope changed)
          if [ "$CIRCULAR" != "[]" ]; then
            echo "::warning::Circular dependencies detected in changed code"
            echo "$CIRCULAR"
          fi
      
      - name: Select Tests
        id: select-tests
        run: |
          TESTS=$(python scripts/select_tests.py \
            --impacted-modules '${{ steps.analyze.outputs.impacted_modules }}' \
            --test-mapping tests/test_mapping.json)
          echo "tests=$TESTS" >> $GITHUB_OUTPUT
      
      - name: Run Impacted Tests
        run: |
          pytest ${{ steps.select-tests.outputs.tests }} \
            --cov=src \
            --cov-report=xml \
            --cov-fail-under=80
      
      - name: Check New Dependencies
        run: |
          # Check if PR introduces new third-party dependencies
          python scripts/check_new_dependencies.py \
            --requirements requirements.txt \
            --baseline main
      
      - name: Dependency Visualization
        if: failure()
        run: |
          # Generate dependency graph of failing area
          python scripts/visualize_dependencies.py \
            --graph graph.json \
            --highlight '${{ steps.analyze.outputs.impacted_modules }}' \
            --output dependency-graph.svg
          
          # Upload as artifact
          echo "::set-output name=visualization::dependency-graph.svg"
```

## Best Practices (2026 Update)

1. **Use Graph Databases for Large Projects**: For monorepos with 1000+ modules, consider using Neo4j or similar for dependency storage and queries

2. **Dependency Health Score**: Calculate and monitor a health score for each dependency based on:
   - Number of reverse dependencies
   - Frequency of changes
   - Test coverage
   - Circular dependency involvement

3. **Automated Refactoring Suggestions**: Use AI-assisted tools to suggest refactors that reduce coupling

4. **Contract Testing**: Implement consumer-driven contract tests for service dependencies

5. **Dependency Freeze Windows**: Implement freeze windows during critical migration periods

6. **Impact Analysis in PRs**: Automatically calculate and display blast radius in pull requests

7. **Measure Dependency Debt**: Track technical debt metrics related to dependencies

## Tools Summary (2026)

| Tool | Language | Purpose |
|------|----------|---------|
| `import-deps` | Python | Modern import analysis |
| `dependency-check` | Multi | Security vulnerability scanning |
| `snyk` | Multi | Dependency security monitoring |
| `nx` | JavaScript/TypeScript | Monorepo dependency graph |
| `deptrac` | PHP | Dependency analysis |
| `crane` | Go | Dependency analysis |
| `cargo-tree` | Rust | Dependency visualization |
| `pipdeptree` | Python | Dependency tree visualization |
| `npm ls` | JavaScript | Dependency tree |
| `madge` | JavaScript | Circular dependency detection |

## References

- NetworkX Documentation: https://networkx.org/documentation/stable/
- Martin Fowler - Dependency Management: https://martinfowler.com/articles/isolation-versus-healthy-dependencies.html
- Snyk - Dependency Management Best Practices: https://snyk.io/learn/dependency-management/
