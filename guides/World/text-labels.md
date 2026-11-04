---
title: Text labels
description: Float text from the server over a place, a player or any other entity, styled with colours, outlines and plates, for every player near it to see.
sidebar:
  order: 512
---

`TextLabel` puts text into the world from the server: a sign over a shop, a name over an NPC, a countdown at a start line. Every player near it sees it. It is drawn over the game, the way nametags are, so it always faces the camera, and walls and the ground hide it unless you say otherwise.

Some text has a place of its own. World objects and characters carry a prompt in a fixed look, `Hud.showPrompt` floats one prompt on one player's screen, and a client can hang a passing line on a player's nametag with [`Nametags.setLabel`](/guides/user-interface/hud-and-nametags/#on-the-client). A text label is for anything else, in a look you choose.

## Creating a label

This hangs a sign over a shop, in parchment on a dark plate, for players within 40 m:

```js
// server/main.js
const SHOP = { x: 12000, y: -4500, z: 450 };

const sign = TextLabel.create(SHOP.x, SHOP.y, SHOP.z, "{b}Wands{/b}\nOpen from dawn to dusk", {
  markup: true,
  fontSize: 22,
  color: "#f3e3b5",
  style: "box",
  drawDistance: 4000,
});
```

`TextLabel.create(x, y, z, text, options)` places a label at world coordinates, in centimetres, and returns it. Every option can be left out. An unknown key, or a value of the wrong type or outside its range, throws a `TypeError` and creates nothing. The server holds at most 512 labels, from all resources together, and one more throws an `Error`.

The older form, `TextLabel.create(x, y, z, text, fontSize, drawDistance, virtualWorld)`, still works. It clamps a size or distance out of range instead of throwing.

## Options

| Option | Meaning |
| --- | --- |
| `text` | The text, up to 1024 bytes of UTF-8. Longer text is cut. `\n` starts a new line |
| `markup` | Reads colour, bold and italic tags in the text. See [Markup](#markup). `false` by default |
| `position` | Where it stands, as a `Vector3` or `{ x, y, z }` |
| `attachTo`, `offset` | Makes it follow an entity. See [Following an entity](#following-an-entity) |
| `fontSize` | Its size in pixels, from 1 to 512: 16 by default |
| `sizeMode` | `"screen"`, the default, keeps it `fontSize` pixels tall at any distance. `"world"` makes it `fontSize` pixels tall at 1 m on a 1080p screen, half that at 2 m, and so on, as a real sign would |
| `minSize`, `maxSize` | In world mode, the smallest and largest it gets, in pixels, up to 512. 0, the default, sets no limit. `minSize` cannot be more than `maxSize` |
| `color` | The text's colour: opaque white by default |
| `opacity` | From 0 to 1, multiplies every colour in the label: 1 by default |
| `style` | A preset look. See [Styles](#styles) |
| `outline`, `shadow`, `background` | The parts of its look. See [Styles](#styles) |
| `align` | How its lines line up with each other: `"left"`, `"center"` or `"right"`. `"center"` by default |
| `anchor` | Which part of the text sits on its point: `"center"`, the default, `"bottom"`, so the text grows upward from it, as a tag over a head does, or `"top"`, so it hangs below |
| `lineSpacing` | The height of a line as a multiple of the size, from 0.5 to 4: 1 by default |
| `maxWidth` | Wraps lines at a space once they pass this width, in pixels at `fontSize`, up to 4096. A word wider than the whole line is broken. 0, the default, never wraps |
| `drawDistance` | How far from the camera it is drawn, in centimetres, from 1 to 100000 (1 km): 3000 (30 m) by default. Players farther away are not sent it at all |
| `fadeDistance` | Where it starts fading out, in centimetres. It fades evenly to nothing at `drawDistance`. 0, the default, or a value that is not below `drawDistance`, starts the fade at 75% of `drawDistance` |
| `occlusion` | Whether walls and the ground hide it: `true` by default |
| `virtualWorld` | The virtual world it is in: 0 by default. See [Who sees a label](#who-sees-a-label) |

A colour is a `0xAARRGGBB` number, alpha first as for nametags, a `"#RRGGBB"` or `"#RRGGBBAA"` string, alpha last as in CSS, or a `Color`.

`minSize` and `maxSize` only change how big the text gets: a label smaller than 2 pixels is not drawn at all. In world mode, the outline, shadow and plate grow and shrink with the text.

## Changing a label

| Call | What it does |
| --- | --- |
| `label.update(options)` | Changes the options you pass and keeps the rest. A bad key throws a `TypeError` and changes nothing |
| `label.setText(text)` | Changes the text, cut to 1024 bytes |
| `label.setFontSize(size)` | Changes the size, clamped to 1 to 512 |
| `label.setDrawDistance(distance)` | Changes the draw distance, clamped to 1 to 100000 |
| `label.setFadeDistance(distance)` | Changes where the fade starts. 0 starts it at 75% of the draw distance |
| `label.setColor(color)` | Changes the text's colour, from a `Color`, or from red, green, blue and alpha bytes from 0 to 255, as `setColor(r, g, b, a)`. Alpha is 255 when left out |
| `label.setStyle(style)` | Resets the outline, shadow and plate to a [preset](#styles), by its number from 0 to 3. Other numbers are ignored |
| `label.attachTo(target, offset)`, `label.detach()` | Follows an entity, and stops. See [Following an entity](#following-an-entity) |
| `label.destroy()` | Removes it for everyone |

The setters clamp a value out of range where `update` would throw. `label.text`, `label.color`, `label.fontSize`, `label.drawDistance` and `label.fadeDistance` read the label back, with the colour as a `0xAARRGGBB` number. `label.style` is the preset nearest its look, as a number.

`label.getOptions()` returns every option in the shape `update` takes: colours as numbers, the style by name, `attachTo` as an id or `null`, and an outline, shadow or plate that is off as `false`. That makes one label's look easy to give another:

```js
// server/main.js
const wands = TextLabel.create(12000, -4500, 450, "Wands", { fontSize: 22, color: "#f3e3b5", style: "box" });
const { text, position, attachTo, offset, virtualWorld, ...look } = wands.getOptions();
TextLabel.create(12800, -4300, 450, "Apothecary", look);
```

Once a label is destroyed, `getOptions()` returns `null` and the other calls do nothing. `new TextLabel(id)` gives you a handle to an existing label from its id.

### A countdown

`setText` changes only the text. This counts down over a start line for the players in one world, then shows "Go!" in green and takes the label away two seconds later:

```js
// server/main.js
function countdown(at, seconds, world, onGo) {
  const label = TextLabel.create(at.x, at.y, at.z, String(seconds), {
    fontSize: 48,
    color: "#ffd24a",
    style: "outline",
    outline: { width: 2 },
    drawDistance: 6000,
    occlusion: false,
    virtualWorld: world,
  });
  let left = seconds;
  const timer = setInterval(() => {
    left -= 1;
    if (left > 0) {
      label.setText(String(left));
      return;
    }
    clearInterval(timer);
    label.update({ text: "Go!", color: "#60ff80" });
    setTimeout(() => label.destroy(), 2000);
    onGo();
  }, 1000);
}
```

Every change is sent to each player who has the label, so change a label when what it shows changes, not on every tick.

## Markup

With `markup: true`, these tags in the text change the text after them:

| Tag | Effect |
| --- | --- |
| `{#RRGGBB}`, `{#RRGGBBAA}` | Colours the text |
| `{#}` | Goes back to the label's `color` |
| `{b}`, `{/b}` | Starts and ends bold |
| `{i}`, `{/i}` | Starts and ends italic |
| `{{` | A literal `{` |

Anything else in braces is drawn as written. Bold and italic are drawn from the regular font, thickened and slanted.

Without `markup`, the text is drawn exactly as it is, braces and all. Text a player typed, such as their name, can carry tags of its own, so leave markup off for it, or double its braces with `name.replaceAll("{", "{{")` before putting it in a label that uses markup.

## Styles

`style` picks a preset, by name or number:

| `style` | Look |
| --- | --- |
| `"none"` (0) | The text alone |
| `"shadow"` (1) | A 1 px black shadow below and to the right. A new label has this look |
| `"outline"` (2) | A 1 px black outline |
| `"box"` (3) | A translucent black plate behind the text, with 4 px of padding and rounded corners |

`outline`, `shadow` and `background` set each part yourself:

| Option | Fields |
| --- | --- |
| `outline` | `width`, up to 4 px: 1 by default. `color`: black by default |
| `shadow` | `offsetX` and `offsetY`, from -32 to 32 px: 1 by default. `blur`, up to 8 px, approximated: 0 by default. `color`: black by default |
| `background` | `padding` and `radius`, the corners' radius, up to 64 px: 4 by default. `color`: translucent black, `0x99000000`, by default |

`true` turns a part on with its defaults, `false` or `null` turns it off, and an object sets it whole, so a field you leave out of it takes its default, not the value the label had. A preset sets all three parts, and parts given in the same call apply after it: `{ style: "box", outline: true }` is a plate with an outline. `label.style` and `getOptions().style` report the preset nearest the look: any plate counts as `"box"`, then any outline as `"outline"`, then any shadow as `"shadow"`.

## Following an entity

`attachTo` makes a label follow a player, NPC, beast, world object, effect, character or another label, given as its handle or its id. It works as an option or as `label.attachTo(target, offset)`, and throws a `TypeError` for an entity that does not exist and for the label itself. `attachTo: null` or `label.detach()` stops it.

`offset` is where the label sits from the entity, in centimetres, as `{ x, y, z }`. It does not turn with the entity.

- A player's offset counts from just above their head, where their nametag is. With no offset, the label sits on the nametag, so raise it, or hide the nametag with [`player.setNametagVisible(false)`](/guides/user-interface/hud-and-nametags/#nametags).
- An NPC's offset counts from its body's position.
- Anything else's counts from its position.

`label.attachTo(target)` without an offset sets it to none, while `update({ attachTo })` without one keeps the offset the label had.

An attached label goes where its entity goes, into another virtual world or map too, unlike an [effect](/guides/world/objects-and-effects/#attaching-effects). It is destroyed with the entity, for example when a player leaves. Each player's game draws it only while that game has the entity, so the label is hidden while the entity is out of the player's range. It is hidden over a player the server hides with `player.setVisible(false)` too. The player a label follows sees it as well.

The label's own position and world are kept while it is attached: `position` and `virtualWorld` in `update` change where it goes back to when it is detached. The coordinates given to `create` are that position.

This hangs a bounty over a player's head for everyone within 50 m:

```js
// server/main.js
const bounties = new Map();

function postBounty(player, galleons) {
  bounties.get(player.id)?.destroy();
  const tag = TextLabel.create(0, 0, 0, `{b}WANTED{/b}\n${galleons} Galleons`, {
    markup: true,
    attachTo: player,
    offset: { x: 0, y: 0, z: 30 },
    anchor: "bottom",
    color: "#ff5a40",
    outline: true,
    drawDistance: 5000,
  });
  bounties.set(player.id, tag);
}

function clearBounty(player) {
  bounties.get(player.id)?.destroy();
  bounties.delete(player.id);
}

Events.on("playerDisconnect", (player) => bounties.delete(player.id));
```

`anchor: "bottom"` keeps the two lines growing upward from the point, clear of the player's head.

## Who sees a label

A label is sent to the players within its `drawDistance` who are in its virtual world, and each of them draws it while their camera is within that distance. Players farther away are not sent it at all, so a label that only matters up close costs nothing to anyone far from it.

A label that is not attached is in Overland. `virtualWorld` and `label.setVirtualWorld(world)` take a world number and no map, so players in a dungeon or any other map never see it, whatever its coordinates. To label something in another map, attach the label to an entity there. A label in the global world, `4294967295`, is seen from every world and every map. See [Virtual worlds](/guides/core-concepts/virtual-worlds/).

`label.setVisibleTo(player)` shows a label to that one player alone, such as a marker only they should follow, and `label.setVisibleTo(null)` shows it to everyone again. [Showing an entity to one player](/guides/core-concepts/virtual-worlds/#showing-an-entity-to-one-player) covers how that setting behaves.

With `occlusion` on, each player's game checks several times a second whether anything stands between the camera and the label, and fades it out and back in. A label over a player is checked against their head and not their own body, as nametags are, so it does not give away a player behind cover. Turn `occlusion` off for a label that should show through walls, such as a marker over a goal. Labels are not drawn during a loading screen or while one of the game's menus covers the screen.

## Lifetime

Labels your resource creates are destroyed when it stops. They are not saved: create them again when your resource starts.

The 512 labels are shared by every resource on the server, so destroy the ones you no longer need.

## Where to go next

- [Objects and effects](/guides/world/objects-and-effects/) for props and effects every nearby player sees.
- [HUD, prompts and nametags](/guides/user-interface/hud-and-nametags/) for the names over players' heads and prompts on one player's screen.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for who sees what.
- [Shapes](/guides/world/shapes/) for rings, boxes and lines drawn on one player's screen.
