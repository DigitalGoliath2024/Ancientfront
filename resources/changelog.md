# Marauder's Sea 0.1.3

Brand-new update: the **Tender**. An unarmed repair hull so a fleet can stay on station instead of steaming home every time the wood splinters.

## Tender

- **Build it** — $1,000,000 each, unlimited. Spawns from the nearest Port. Place from water like a Warship or Marauder. She parks on that tile instead of wandering a warship box — click to move her if you want a new station.
- **Hull** — 1,200 hit points. Two black sails, two pixels skinnier and two pixels longer than a Warship. No guns, no captures, no shore bombardment.
- **Heal** — Friendly Warships and Marauders in a 30-tile bubble gain 1 HP per tick. Another Tender in that bubble only heals at 15% of that rate. She does not patch her own hull. Does not stack with Port heal; if you are in range of a Port, the Port wins.
- **Circle** — Click a Tender (same select as a Warship) to see the mint heal circle. It follows the hull. Box-select several Tenders to see every bubble.
- **Wounded navy** — Ships already in the bubble stay and fight instead of running to Port. If they are hurt and a Tender on the same water is closer than the Port, they steam to her, hold in the circle until full, then return to their patrol. No Tender in reach, or already in Port heal range: they still dock at Port as before. Hurt Tenders still run to Port, not to another Tender.
- **Threats** — Mines, Port Guns, and enemy ships can sink a Tender. A mine chips 70% of max HP, same as a Warship — it does not one-shot her.

## Guide

- Tender tab in the in-game Guide, with the Tender icon, heal circle, and repair-retreat rules.

## Wiki

- Tender page on the buildings roster, with Port and mine notes updated.

## Trains

- **Sprites** — One locomotive, not two. New top-down engine (black nose, yellow windows, gray coupler). Carriages look the same as before.

## Nations

- **Cities** — Bots place a city before they start stacking armories and batteries, so they actually grow.

---

# Marauder's Sea 0.1.2

Brand-new update: **Inland Battery**. Land artillery for this era. No nukes.

## Inland Battery

- **Build it** — Place on land you own. Costs $1,500,000 to place or upgrade. Caps at level 10. Hotbar key **8**.
- **How it fires** — Reloads every **15 seconds**. Each volley fires one shell per level (one at level 1, ten at level 10). Range starts at 100 tiles and grows to 210 at level 10. A timer bar fills under the gun.
- **Auto or manual** — New guns auto-fire. Nations always auto-fire. On your battery, the radial menu switches Auto / Manual. When Manual and the bar is full, click **Fire**, then click the map. A **green** circle is in range; **red** is not. Aiming does not send your troops to attack.
- **Landing pattern** — Shells land randomly with an 80% chance of hitting a target, and a 20% chance of hitting troops.
- **What the shells do** — They scorch **enemy** land in a 4-tile blast. Your land and allied land stay safe. Water is a dud: shots can fly over ocean, but they do nothing if they land in it. The gun will not aim close enough to blow itself up.
- **Capture** — If someone takes the tile, the battery is destroyed, not stolen. Same rule as a defense post.
- **Guide** — Inland battery page in the in-game Guide.

## Era

- **No SAMs, silos, or nukes** — Those units stay out of this era. Nations can no longer place SAM sites.

---

# Marauder's Sea 0.1.1

## Combat and buildings

- **Building health** — Structures take hit points at every level. Damage shows on a health bar. The building is destroyed at zero hit points.
- **Port guns** — Cap at level 10. Fire in volleys. Repairman heals high-level batteries on the health bar.
- **Bulk ships** — Buy several warships or marauders at once from the radial menu. They spawn about two seconds apart.

## Audio

- **Music** — Original score on the menu and in match, with separate music and sound-effect volume sliders.
- **In-game announcer** — Its own volume slider. Calls out land attacks on enemy players, your warship or marauder going down, your city, port, port gun, or factory being destroyed, and when you are eliminated and drop into spectator.

## World

- **Terrain** — Stronger default land and ocean colors so the map is easier to read at a glance.

## Icons and mines

- **HUD icons** — New silhouettes for navy, battleships, marauders, ports, port guns, factories, armories, cities, defense posts, and naval mines in the Guide, Help, and build menus. The same icons appear on buildings on the map.
- **Naval mines on the map** — Team mines still show as a single pixel, but they draw black so they do not disappear into blue water.

---

# Marauder's Sea 0.1.0

Marauder's Sea is an independent modified version of OpenFront. Modified by [Flying V Studios](https://flyingveestudios.netlify.app/) beginning in 2026. © OpenFront and Contributors. Marauder's Sea is not affiliated with or endorsed by OpenFront Inc.

## What's new

- **Navy** — Age-of-sail warships with shore bombardment and veterancy
- **Naval mines** — Place mines to control sea lanes
- **Buildings** — Ports can take damage and be destroyed
- **Guide** — In-game Guide covering navy, combat, and buildings
- **Maps** — New and recategorized maps
