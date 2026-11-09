# Skills

This project loads agent skills from `.agents/skills/*`. Installed skills are tracked in `skills-lock.json`.

## Installed Skills

| Skill | Path | Description |
|-------|------|-------------|
| `ui-ux-pro-max` | `.agents/skills/ui-ux-pro-max/SKILL.md` | UI/UX design intelligence for web, mobile, and desktop interfaces |
| `web-design-guidelines` | `.agents/skills/web-design-guidelines/SKILL.md` | Web Interface Guidelines compliance reviews |

## Adding Skills

Place new skill folders under `.agents/skills/<skill-name>/SKILL.md` and register them in `skills-lock.json`. Skills are loaded automatically when their `SKILL.md` frontmatter declares a `name` field.

## Loading Skills in Tasks

When a task matches a skill's description, use the `skill` tool to load it by name:

```
skill --name ui-ux-pro-max
skill --name web-design-guidelines
```

This injects the skill's instructions into the current session.
