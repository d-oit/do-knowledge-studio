# Optimize Prompt Template

```
PRODUCT: {{product_type}} with {{key_feature}}
TARGET USER: {{audience}}, {{platform}}, {{session_context}}
PLATFORM: {{platform}}, {{orientation}}, {{input_modality}}
INTERFACE MODEL: {{product_ui_mode}}

RESEARCH CONTEXT:
  {{#each research_context.domain_trends}}- {{this}}{{/each}}
  {{#each research_context.precedent_products}}- Precedent: {{name}} — {{pattern}}{{/each}}

DESIGN DNA:
  {{#each anti_slop_warnings.translations}}{{original}} → {{translated_to}}{{/each}}

TOKENS:
  Spacing: {{tokens.spacing}}
  Typography: display={{tokens.display}} heading={{tokens.heading}} body={{tokens.body}} label={{tokens.label}} mono={{tokens.mono}}
  Color: {{#each tokens.colors}}{{@key}}={{this}} {{/each}}
  Radius: {{tokens.radius}} | Elevation: {{tokens.elevation}} | Motion: {{tokens.motion}}

NAVIGATION: {{navigation_model.type}}
  Items: {{navigation_model.items}}
  Height: {{navigation_model.height}} | Active: {{navigation_model.active_state}}

SCREENS:
{{#each screen_or_state_map}}
  {{name}}: {{purpose}} | Layout: {{layout}}
{{/each}}

RESPONSIVE:
  {{#each responsive_behavior}}{{@key}}: {{this}}{{/each}}

ANTI-PATTERNS:
{{#each anti_patterns}}  - {{this}}{{/each}}

DELIVERABLES:
{{#each deliverables}}  - {{this}}{{/each}}
```

## Checklist
- [ ] All placeholders filled
- [ ] No banned adjectives
- [ ] Colors use semantic tokens
- [ ] Typography by role with values
- [ ] All 4 breakpoints specified
- [ ] Navigation items named
- [ ] Anti-patterns explicit
