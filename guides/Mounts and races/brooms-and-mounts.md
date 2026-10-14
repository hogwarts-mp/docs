---
title: Brooms and mounts
description: Give players brooms and creatures to ride, put them on and take them off from a client script, change how a broom flies, and keep riders out of an area.
sidebar:
  order: 800
---

Players fly brooms and ride the game's creatures, and everyone else sees them do it without any script. Client scripts control the local player's riding with `Broom`, `FlyingMount` and `GroundMount`. The server decides what each player owns, through their [inventory](/guides/players/inventory/), and has no call of its own for riding.

## What players own

A player can only ride what is in their inventory, and a joining player starts with an empty one, so give them a broom or a creature first:

| Kind | Item ids |
| --- | --- |
| Brooms | `BroomHouse`, `BroomFamilyAntique`, `BroomFlyingClass1` to `BroomFlyingClass3`, `BroomAeromancer`, `BroomBrightSpark`, `BroomDarkWizard1`, `BroomDarkWizard2`, `BroomEmberDash`, `BroomInfiltrator`, `BroomLicketySwift`, `BroomMoonTrimmer`, `BroomNightDancer`, `BroomSilverArrow`, `BroomSkyScythe`, `BroomWildFire`, `BroomWindWisp`, `BroomYewWeaver` |
| Flying creatures | `HippogriffMount`, `OnyxHippogriffMount`, `ThestralMount` |
| Ground creature | `GraphornMount` |

The first broom a player is given goes straight into their active slot, ready to ride; later ones go into storage. The same goes for each kind of creature. The onyx hippogriff and the thestral need the game's add-ons that unlock them.

```js
// server/main.js
Events.on("loadingFinished", (player) => {
  if (!player.inventory.has("BroomHouse")) player.inventory.give("BroomHouse", 1);
});
```

Taking the item away is how the server keeps a player from summoning it; a player already riding is taken off by their client, as in [Keeping riders out](#keeping-riders-out). The server cannot see whether a player is riding, and no event fires when anyone mounts or dismounts, so client scripts check for themselves.

## Riding a broom

`Broom.mount()` gets the local player on the broom in their active slot, and `Broom.equip(itemId)` picks which of their brooms that is. `mount` returns whether the game accepted the request, not whether the player is riding: they settle on the broom over a second or so, and the first request can be turned down while the game loads the broom, so ask again until they are on.

| Call | Returns |
| --- | --- |
| `Broom.mounted()` | Whether the player is on a broom or getting on |
| `Broom.state().mountSettled` | Whether they are seated and flying |
| `Broom.canMount()` | Whether the game lets them fly here and now; it does not check that they own a broom |
| `Broom.isEquipped()` | Whether a broom is in their active slot |

```js
// client/main.js
Events.on("broom:mount", () => {
  if (!Broom.isEquipped()) Broom.equip();
  let attempts = 0;
  const timer = setInterval(() => {
    if (Broom.state().mountSettled || ++attempts > 10) {
      clearInterval(timer);
      return;
    }
    if (!Broom.mounted()) Broom.mount();
  }, 500);
});
```

`Broom.dismount()` takes the player off at once, wherever they are, so a player in the air falls. `Broom.dismount(true)` asks the game to land them the normal way instead, which does nothing where the game will not let them land. Both return `false` until the player is seated. `equip` and `unequip` refuse while the player is riding.

## Changing how a broom flies

| Call | Does |
| --- | --- |
| `Broom.setMaxSpeed(speed)` | Caps the speed, in centimetres per second |
| `Broom.setMaxHeight(z)` | Caps how high the broom can climb, as a world height; `clearMaxHeight()` lifts it |
| `Broom.setInputDisabled(disabled)` | Stops the rider steering |
| `Broom.setForceLand(forceLand)` | Brings the broom down |
| `Broom.addBoost(fraction)` | Fills part of the boost meter; `boost()` and `inTurbo()` read it |
| `Broom.setCastingAllowed(allowed)` | Lets the rider cast spells other than heavy ones while flying |
| `Broom.teleport(x, y, z, yaw)` | Moves a rider and stops them dead; leaving out `yaw` faces them to 0, not their heading |

These belong to the client, not to your resource, and stay until something changes them. `Broom.resetOverrides()` undoes every one of them set through `Broom`, so call it when your game ends and as your resource stops. Set the speed again after the player switches broom.

A knock out of the sky, without dismounting:

```js
// client/main.js
Events.on("broom:stun", () => {
  Broom.setInputDisabled(true);
  Broom.setForceLand(true);
  setTimeout(() => {
    Broom.setForceLand(false);
    Broom.setInputDisabled(false);
  }, 3000);
});
```

## Creatures

`FlyingMount` rides the hippogriffs and the thestral, and `GroundMount` the graphorn. They work like `Broom`:

- `equip(itemId)` puts one of the player's creatures in the active slot, and `mount(options)` summons it. `mount` returns whether the request was accepted, so check `mounted()`, which only turns true once the player is seated, and `summoning()` for the summon in between.
- `mount({ transition: false })` skips the summon animation, and `FlyingMount.mount({ inFlight: true })` starts the player in the air.
- `dismount()` takes the player off. Called during a summon, it cancels the summon instead, so call it again.
- `canMount()` asks the game whether creatures are allowed here. It can return `false` because another player stands somewhere creatures are not allowed, so treat `false` as a maybe.

A rider on a flying creature can be steered with `FlyingMount.takeoff()`, `FlyingMount.land()` and `FlyingMount.setAutoLanding(enabled)`, and `FlyingMount.setFlyingGait(gait)` sets the slowest pace the rider can drop to: `"stop"`, `"hover"`, `"slow"` or `"fast"`. `takeoff` is a request, so check `FlyingMount.isFlying()` and ask again.

```js
// client/main.js
Events.on("hippogriff:fly", () => {
  FlyingMount.equip("HippogriffMount");
  FlyingMount.mount({ inFlight: true });
});
```

`state()` on either reports the creature's `species`, whether the player is `mounted`, and for flying creatures whether they are `flying`.

## Keeping riders out

To keep players off brooms and creatures in an arena, take the items away on the server while they are inside, and have their client dismount them and keep the game's tool wheel, where players summon them, shut:

```js
// client/main.js
Events.on("arena:enter", () => {
  Game.setToolWheelEnabled(false);
  if (Broom.mounted()) Broom.dismount();
  if (FlyingMount.mounted()) FlyingMount.dismount();
  if (GroundMount.mounted()) GroundMount.dismount();
});

Events.on("arena:leave", () => Game.setToolWheelEnabled(true));
```

The server's part is the one that holds: a client script can be changed by its player, an inventory cannot.

## Where to go next

- [Races](/guides/mounts-and-races/races/) for running the game's broom races on tracks of your own.
- [Inventory](/guides/players/inventory/) for giving and taking items.
