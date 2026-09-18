---
title: Overview
group: Guides
---

HogwartsMP resources run JavaScript in one of two environments:

- **Server resources** run in Node.js and own authoritative game state.
- **Client resources** run in a sandboxed V8 context and control local presentation and input.

Use the navigation to browse the globals available to the selected environment. The same declarations that generate this reference can be loaded by an editor for autocomplete and type checking.

## Finding your way

**Start here:**

- [Your first resource](/guides/getting-started/) — the manifest, script roles, load order, and sharing code between resources.

**The idea everything builds on:**

- [Events](/guides/events/) — listeners, the client/server bridge, the runtime event catalog, and the trust boundary.

## Server example

```js
Events.on("playerConnect", (player) => {
  player.sendChat(`Welcome to Hogwarts, ${player.nickname}!`);

  const npc = NPC.create("Goblin_Grunt", 250, 120, 0, "hostile");
  if (npc) {
    npc.setMaxHealth(500);
  }
});
```

## Server-authoritative inventory

Server resources load and save inventory however they choose. The framework only owns the connected session shadow and its projection into the native client:

```js
Events.on("playerConnect", (player) => {
  loadInventory(player, (items) => {
    player.inventory.replace(items, (error) => {
      if (error) player.kick(`Inventory sync failed: ${error.code}`);
    });
  });
});

function reward(player, itemId, count) {
  player.inventory.give(itemId, count, {}, (error, result) => {
    if (error) {
      console.error(error.code, error.message);
      return;
    }
    console.log(`inventory revision ${result.revision} sent`);
  });
}
```

`player.inventory.list()`, `count()`, and `has()` read only server memory. Client inventory state never grants items to the server inventory.

## Client example

```js
Events.on("season", (payload) => {
  Game.notify(`The season is now ${payload.name}`);
});

const pos = LocalPlayer.getPosition();
if (pos) {
  console.log(pos.x, pos.y, pos.z);
}

const view = Camera.capture();
if (view) {
  Camera.activate(view);
  Camera.orbit(view.position, { radius: 300, height: 100, speed: 25 });
}

Camera.restore({ duration: 0.5, curve: "easeOut" });
```

> Server and client declarations must be loaded separately. A global shown in one environment is not automatically available in the other.
