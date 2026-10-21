// plate.mjs — assemble the switchboard plate in the browser.
//
// The geometry is the same modules the Node build audits, so what the page
// draws is what passed the audit. The audited painter order travels as
// keys.json; without it the plate falls back to plain depth order.

import { buildWorld } from "./world.mjs";
import { computeCamera, buildFigure, FIGURE_CSS } from "./figure.mjs";
import { ISO_CSS, plateHtml } from "../../iso/iso-kit.mjs";

export function buildPlate(data, keys = {}) {
  const world = buildWorld(data);
  const P = computeCamera(world);
  const fig = buildFigure(world, { P, keys });

  const lit = world.stations.filter((s) => s.online).length;
  const readout = `${lit} of ${world.stations.length} lamps lit · ${world.conns.length} cords`;
  const caption =
    `A cord switchboard for the AcharyLab: ${world.bays.length} tier bays and a home box, one jack and lamp per service, ` +
    `one patch cord per connection. Lamps read live health — dark means offline or unplugged.`;

  const html = plateHtml({
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
    body: `<style>${ISO_CSS}${FIGURE_CSS}</style><div class="iso-stage mc-stage" tabindex="0" role="group" aria-label="Cord switchboard. Tab to the plate, then use arrow keys to move between jacks, Enter to trace a call, Escape to clear.">${fig.svg}</div>`,
  });

  return { html, world };
}
