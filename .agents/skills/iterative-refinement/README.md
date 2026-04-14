# Iterative Refinement Skill

Multi-file skill for systematic iterative refinement with validation loops.

## File Structure

```
iterative-refinement/
├── SKILL.md                        # Main skill file (core workflow)
├── README.md                       # This file
├── patterns.md                     # Advanced patterns and convergence
├── web-search-integration.md       # Research integration guide
└── tools/
    ├── python.md                   # Python validation tools
    ├── javascript.md               # JavaScript/TypeScript tools
    ├── rust.md                     # Rust validation tools
    ├── java.md                     # Java validation tools (create as needed)
    ├── go.md                       # Go validation tools (create as needed)
    ├── cpp.md                      # C/C++ validation tools (create as needed)
    ├── ruby.md                     # Ruby validation tools (create as needed)
    ├── php.md                      # PHP validation tools (create as needed)
    └── dotnet.md                   # C#/.NET validation tools (create as needed)
```

## File Sizes

- `SKILL.md`: ~200 lines (core workflow)
- `patterns.md`: ~180 lines (advanced usage)
- `web-search-integration.md`: ~200 lines (research guide)
- `tools/*.md`: ~150-200 lines each (language-specific)

**Total loaded**: Variable based on usage (200-600 lines typical)

## How It Works

### Progressive Disclosure

The skill uses progressive disclosure to minimize token usage:

1. **SKILL.md** is always loaded (core instructions)
2. **Language tools** loaded only when relevant (e.g., only `tools/python.md` for Python projects)
3. **Advanced patterns** loaded only when needed (convergence, multi-phase)
4. **Web search guide** loaded only when researching

### Typical Token Usage

**Simple iteration loop** (Python project):
- SKILL.md: ~200 lines
- tools/python.md: ~180 lines
- **Total: ~380 lines** (vs 350 lines in single file)

**Complex iteration with research** (Python project):
- SKILL.md: ~200 lines
- tools/python.md: ~180 lines
- patterns.md: ~180 lines
- web-search-integration.md: ~200 lines
- **Total: ~760 lines** (only when needed)

**Multi-language project**:
- SKILL.md: ~200 lines
- tools/python.md: ~180 lines
- tools/javascript.md: ~180 lines
- **Total: ~560 lines** (load multiple tool files)

## Usage Patterns

### Basic Usage

```markdown
User: "Fix all test failures in my Python project"

Claude loads:
- SKILL.md (core workflow)
- tools/python.md (pytest, coverage commands)

Claude executes:
- Define configuration
- Run iterations (pytest → fix → pytest)
- Report results
```

### Advanced Usage

```markdown
User: "Optimize performance until diminishing returns"

Claude loads:
- SKILL.md (core workflow)
- patterns.md (convergence detection)
- tools/python.md (if Python project)

Claude executes:
- Define convergence criteria
- Run optimization iterations
- Detect convergence
- Report results with convergence analysis
```

### Research-Enhanced Usage

```markdown
User: "Set up comprehensive quality checks for my new TypeScript project"

Claude loads:
- SKILL.md (core workflow)
- web-search-integration.md (research guide)
- tools/javascript.md (TypeScript tools)

Claude executes:
1. Research TypeScript best practices (web search)
2. Configure validators based on research
3. Run quality improvement iterations
4. Report results with research impact
```

## Benefits of Multi-File Structure

### Token Efficiency
- Only load relevant content
- Python project doesn't load Rust tools
- Simple iterations don't load advanced patterns
- Significant token savings for focused tasks

### Maintainability
- Add new languages without modifying core
- Update tool guides independently
- Each file under 200 lines (easy to read)
- Clear separation of concerns

### Scalability
- Easy to add more language tools
- Can expand patterns without bloating core
- Research guide independent of iteration logic
- Support new use cases without refactoring

### User Experience
- Faster responses (less context to process)
- More relevant information shown
- Can reference specific files when needed
- Progressive complexity (simple → advanced)

## Adding New Languages

To add a new language (e.g., Go):

1. Create `tools/go.md`
2. Follow the template from existing tool files
3. Include:
   - Test frameworks
   - Linters
   - Formatters
   - Type checkers (if applicable)
   - Build tools
   - Common validation sequences
   - Iteration example script
   - Best practices
4. Add reference in SKILL.md under "Language-Specific Tools"

## File Templates

### Language Tool File Template

```markdown
# [Language] Tools

Validation tools and commands for [Language] iterative refinement.

## Test Frameworks
[Test framework commands and usage]

## Linters
[Linter commands and usage]

## Formatters
[Formatter commands and usage]

## Type Checkers (if applicable)
[Type checker commands and usage]

## Build Tools
[Build commands and usage]

## Code Coverage
[Coverage tool commands]

## Common Validation Sequences
[Typical validation command combinations]

## Iteration Example
[Complete validation script]

## Best Practices
[DO/DON'T lists]
```

## Best Practices for This Skill

### DO:
✓ Reference specific files when needed ("See patterns.md for convergence")
✓ Load only relevant tool files
✓ Keep SKILL.md focused on core workflow
✓ Update individual files independently
✓ Add new languages as separate files

### DON'T:
✗ Load all files for every task
✗ Duplicate content across files
✗ Let individual files exceed 200 lines
✗ Mix language-specific content in SKILL.md
✗ Create deeply nested file references

## Version History

- v1.0: Initial multi-file structure
  - Core workflow in SKILL.md
  - Advanced patterns separated
  - Language tools modularized
  - Web search integration added

## Contributing

When updating this skill:

1. Keep SKILL.md under 200 lines
2. Keep individual tool files under 200 lines
3. Follow consistent formatting
4. Test with actual projects
5. Update README when adding files
6. Maintain progressive disclosure pattern

## Summary

Multi-file structure enables:
- **Token efficiency**: Load only what's needed
- **Maintainability**: Update files independently
- **Scalability**: Add languages without refactoring
- **User experience**: Progressive complexity

Core workflow stays consistent while supporting complex use cases through optional files.