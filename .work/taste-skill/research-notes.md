# Taste Skill source notes

- Official repository: https://github.com/Leonxlnx/taste-skill
- Official README raw: https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/README.md
- Official skill file: https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md
- Official app-screen guidance: https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/references/app-screens.md
- Official docs: https://www.tasteskill.dev/docs
- Installer CLI docs: https://github.com/vercel-labs/skills
- Vercel skills CLI supported agent list: https://github.com/vercel-labs/skills/blob/main/docs/agents.md

Verified facts: Taste Skill is an Agent Skill. The README install command is `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`. The skill requires Node 22+ and Chrome/Edge/Chromium for its scripts; app screens use `references/app-screens.md`, `draw.mjs --app`, and `inspect.mjs --app`. The installer supports several coding agents and an `universal` path, but the published supported-agent list does not include Manus. `node --version` on this device returned v24.22.0. `where.exe chrome` and `where.exe msedge` did not locate executables. PowerShell direct archive download failed TLS, and the installer command to `universal` was denied by the permission reviewer because its destination did not match a confirmed Manus skill folder. Do not retry that exact installer action. The request still authorizes applying the design guidance in the user's app. Before claiming the skill has been installed in Manus, establish the supported local Manus path/installation mechanism.

App-screen guidance read: screens should answer one question, put key findings/actions first, use actual project data, keep useful app density, quiet/flat surfaces, avoid dashboard-template gradients and tinted icon tiles, align table numbers, use honest zero/empty states, retain product identity, and inspect app screen at desktop/mobile widths.
