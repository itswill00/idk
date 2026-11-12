# Mayhem Machine

A chaotic 3D arena survival game for the browser, rendered with Three.js. You are a small blob with a gun,
the swarm never stops, and every few seconds the machine rolls a new rule:
bullet storms, black holes, reversed controls, disco, meteors, lights out and more.
Rules stack as the run goes on.

## Play

No build step. Three.js is vendored in `vendor/`, so there is nothing to install.
The game loads as an ES module, so it has to be served over HTTP rather than opened from disk:

```sh
npm run dev   # http://localhost:3000
```

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim (firing is automatic) |
| Space / Shift / right click | Dash (brief invulnerability) |
| P or Esc | Pause |
| M | Mute |
| Touch: drag | Move, with automatic aim |
| Touch: DASH button | Dash |

Chain kills to build the score multiplier, grab gems, hearts and the rare bomb.

## Tinkering

In the browser console, `mayhem.mutators` lists every rule and
`mayhem.force('disco')` triggers one immediately.
