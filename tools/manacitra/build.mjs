// build.mjs — renders the Manacitra switchboard plate and its painter keys.
//   node tools/manacitra/build.mjs            → figures + keys.json
//   node tools/manacitra/build.mjs --audit    → geometry audit before exit
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../src/iso/iso-kit.mjs";
import { buildWorld } from "../../src/manacitra/figure/world.mjs";
import { computeCamera, buildFigure, FIGURE_CSS } from "../../src/manacitra/figure/figure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const A = await import(join(homedir(), ".config/opencode/skills/anatomy/kit/audit.mjs"));

const data = JSON.parse(readFileSync(join(ROOT, "public/manacitra/data.json"), "utf8"));
const world = buildWorld(data);
const P = computeCamera(world);

const R = A.recorder(P);
const fig = buildFigure(world, { P, A, R, settle: A.settle });
A.auditOrExit(R, P, {
  crowd: [
    ['plug*', 'plate.*'],
    ['plug*', 'skirt.*'],
    ['plug*', 'strip.*'],
    ['cord*', 'plug*'],
    ['cord*', 'plate.*'],
    ['cord*', 'skirt.*'],
    ['cord*', 'strip.*'],
    ['cord*', 'stand.desk'],
    ['coil*', 'stand.desk'],
    ['cord*', 'duct.*'],
    ['cord13*', 'cord2*'],
    ['cord12*', 'cord3*'],
    ['cord9*', 'cord*'],
    ['cord*', 'cord0*'],
  ],
  // depth order: these are stable crossovers in isometric at near-equal k; allow
  // the recorder's remaining small interlock pairs
  rest: [],
  allow: [
    ['cord:10:1.item', 'cord:3:1.item'],
    ['cord:10:1.item', 'cord:9:0.item'],
    ['cord:19:0.item', 'cord:6:0.item'],
  ],
  cover: ['stand.*'],
});

writeFileSync(join(ROOT, "public/manacitra/keys.json"), JSON.stringify(fig.keys));

const readout = `${world.stats.online} of ${world.stats.services} lamps lit · ${world.conns.length} cords · polled ${(world.stats.generated_at || "").slice(0, 16).replace("T", " ")}`;
const caption =
  `A cord switchboard for the AcharyLab: ${world.bays.length} tier bays and a home box, one jack and lamp per service, ` +
  `one patch cord per connection. Lamps read live health — dark means offline or unplugged.`;

for (const theme of ["dark", "light"]) {
  const body = k.plateHtml({
    fig: "Fig 1",
    title: "Manacitra",
    hint: "Click a jack to trace a call",
    readout,
    keys: [
      { mark: "lit", label: "Lamp lit: service online" },
      { mark: "flat", label: "Lamp dark: service offline" },
      { mark: "line", label: "Cord: connection, jack to jack" },
    ],
    caption,
    body: `<style>${FIGURE_CSS}</style><div class="iso-stage mc-stage" tabindex="0" role="group" aria-label="Cord switchboard. Tab to the plate, then use arrow keys to move between jacks, Enter to trace a call, Escape to clear.">${fig.svg}</div>`,
  });
  const file = theme === "light" ? "switchboard-light.html" : "switchboard.html";
  writeFileSync(join(HERE, file), k.pageHtml({ title: "Manacitra switchboard", theme, body, width: 860 }));
  console.log("wrote", file);
}
console.log(`${Object.keys(fig.keys).length} painter keys → public/manacitra/keys.json`);
