---
title: Events
description: Listen and emit across resources and the client/server boundary, the runtime event catalog, and what to trust.
sidebar:
  order: 210
---

`Events` is the asynchronous, named event bus available to both server and client resources. Resources use it to react to runtime activity, communicate with other resources in the same environment, and exchange messages across the client/server boundary.

Event names are case-sensitive. Some names are emitted by the runtime, while custom events may use any name that does not conflict with a runtime event.

## Listening for events

Use `Events.on` for a persistent listener:

```js
const unsubscribe = Events.on("questCompleted", async (playerId, questId) => {
  await saveCompletion(playerId, questId);
});

// Remove this exact subscription when it is no longer needed.
unsubscribe();
```

Use `Events.once` when the handler should run at most once:

```js
Events.once("worldReady", () => {
  console.log("The world is ready");
});
```

`Events.off(eventName, handler)` removes a previously registered handler. It must receive the same function that was passed to `on` or `once`.

Handlers belong to the resource that registered them and are removed when that resource stops. A handler may be synchronous or asynchronous. `Events.emit` and the other in-process emitters return a promise that settles after every matching handler finishes and rejects with an `AggregateError` if one or more handlers fail.

## Event scopes

The event API has separate scopes for different kinds of communication:

| Scope | Subscribe | Emit | Delivery |
| --- | --- | --- | --- |
| Shared | `on`, `once` | `emit` | Every matching resource in the same server or client runtime |
| Targeted | `on`, `once` | `emitTo` | Matching handlers owned by one named resource |
| Resource-local | `onLocal` | `emitLocal` | Only the resource that emitted it |
| Client to server | `onClient`, `onceClient` | `emitServer` | From one client to the server's isolated client-event handlers |
| Server to clients | `on` on the client | `player.emit` or `emitAllClients` on the server | One client or every connected client |
| Runtime-generated | `on`, `once` | Runtime only | Native lifecycle, player, chat, and feature events |

The shared server bus and shared client bus are separate. Calling `Events.emit` on the server does not send anything to clients, and calling it on a client does not send anything to the server.

### Shared and targeted events

Use shared events for communication between resources running in the same environment:

```js
// Any resource in this server runtime may listen.
Events.on("housePointsAwarded", (house, points) => {
  console.log(`${house} received ${points} points`);
});

await Events.emit("housePointsAwarded", "Gryffindor", 10);
```

Use `emitTo` when only one resource should receive the event:

```js
await Events.emitTo("scoreboard", "housePointsAwarded", "Gryffindor", 10);
```

Use `onLocal` and `emitLocal` for private coordination inside one resource. Local events cannot be observed by other resources, even if they use the same event name.

## Client and server events

Network events carry one optional JSON payload. Objects passed to `emitServer` or `emitAllClients` are serialized by the runtime and delivered as parsed values. `Player.emit` accepts JSON text, so serialize its payload explicitly.

### Client to server

Client-originated events use a separate subscription table on the server. They cannot trigger handlers registered with the ordinary `Events.on` API.

```js
// client
Events.emitServer("requestFastTravel", {
  destination: "Hogsmeade",
});
```

```js
// server
Events.onClient("requestFastTravel", (player, payload) => {
  if (!payload || typeof payload.destination !== "string") return;

  // Check permissions and game state on the server before acting.
  requestFastTravel(player, payload.destination);
});
```

Client payloads are untrusted. Validate their shape, permissions, ownership, rate, and current server state before changing authoritative state.

### Server to one client

Use `Player.emit` to send an event to one client. The client subscribes with the ordinary `Events.on` API:

```js
// server
player.emit("questUpdated", JSON.stringify({
  questId: "FIRST_DAY",
  stage: 2,
}));
```

```js
// client
Events.on("questUpdated", (payload) => {
  Game.notify(`Quest stage: ${payload.stage}`);
});
```

### Server to every client

Use `Events.emitAllClients` for a broadcast:

```js
// server
Events.emitAllClients("seasonChanged", { name: "winter" });
```

```js
// client
Events.on("seasonChanged", (payload) => {
  Game.notify(`The season is now ${payload.name}`);
});
```

## Runtime-generated events

Runtime-generated events use the normal `Events.on` and `Events.once` subscriptions. They are raised by the framework or the native HogwartsMP module rather than by `Events.emit`. Avoid emitting custom events with these names.

The declarations type the handlers of the events in these tables, so an editor knows each argument. Events of your own, and the few native ones the declarations leave out, such as `chatSend` and the voice events, hand a TypeScript handler `unknown` arguments.

`resourceStart(resourceName)` and `resourceStop(resourceName)` are emitted by both the server and client resource managers when a JavaScript resource starts or is about to stop.

### Native server events

| Event | Handler arguments | When it fires |
| --- | --- | --- |
| `resourceStart` | `(resourceName)` | A JavaScript resource starts |
| `resourceStop` | `(resourceName)` | A JavaScript resource is about to stop |
| `playerConnecting` | `(connection)` | A player asks to join, before they hold a slot; `connection.reject()` turns them away, and a returned promise delays admission until it settles |
| `playerConnect` | `(player)` | A player connects |
| `playerDisconnect` | `(player)` | A player disconnects |
| `playerLocationChanged` | `(player, current, previous)` | A player's coordinate-space context becomes available, unavailable during world travel, or changes area, region, or confirmed destination; each location is a `PlayerLocation` object or `null` |
| `chatMessage` | `(player, message)` | A player sends a normal chat message |
| `chatCommand` | `(player, message, command, args)` | A player sends a slash command; `args` is a string array |
| `consoleCommand` | `(command, args)` | The server console receives a command not handled internally |
| `playerDied` | `(player)` | A player's native game state enters `IsDead` |
| `playerDowned` | `(player)` | A player enters the near-death kneeling state |
| `playerDownedEnd` | `(player)` | A player recovers from the downed state or respawns |
| `playerHoldEnded` | `(player, owner, reason)` | A server-owned hold ends; `reason` identifies why |
| `playerHoldStrained` | `(player, owner, distanceCm)` | A held player continues reporting positions beyond the hold boundary |
| `playerWandChanged` | `(player)` | The player's wand changes |
| `playerGearChanged` | `(player)` | What the player wears changes |
| `worldReady` | `(player)` | The player's world, pawn, and replication are ready |
| `loadingFinished` | `(player)` | The player's load screen is dismissed after `worldReady` |
| `playerInventoryChanged` | `(player, items)` | The player's reported native inventory changes; `items` is the full native inventory |
| `playerInventoryNativeDelta` | `(player, delta)` | A positive native acquisition not yet represented by the authoritative inventory is reported; the first report after connecting establishes a baseline and does not fire this event |
| `playerInventoryUpdated` | `(player, items, revision)` | The authoritative inventory model changes |
| `playerInventoryConsumed` | `(player, item, remaining)` | An accepted native consumable use updates authoritative inventory |
| `playerAppearanceChanged` | `(player, look, revision)` | The server accepts a new look from the player's game or `player.setLook`; `look` is the checked [look](/guides/players/appearance/#the-look) and `revision` increases for the connection |
| `playerTeleportComplete` | `(player, requestId, status, completion)` | A `player.teleport` request finishes; `completion` includes the normalized request, client-observed final transform, and ground-snap result |
| `playerFastTravelComplete` | `(player, requestId, status)` | A `player.fastTravel` request finishes or times out |
| `playerMapTravelComplete` | `(player, requestId, status, completion)` | A `player.travelToMap` or `player.travelToPlace` request finishes, once the player can play in the new map, or times out. See [Travel between places](/guides/players/travel/#loading-another-map) |
| `npcDied` | `(npcId, enemyId, killerId, damagerIds)` | A server-spawned NPC dies; `killerId` is the last player to damage it, or `null`, and `damagerIds` every player who did. See [Fighting NPCs](/guides/pve/fighting-npcs/#damage-and-death) |
| `npcDamaged` | `(npcId, attackerId, amount)` | A player reports damage to a server-spawned NPC |
| `beastCared` | `(beast, player, kind)` | A player pets or feeds a beast; return `false` synchronously to refuse it |
| `beastCaptureStart` | `(beast, player)` | A player's Nab-Sack starts drawing in a beast they may catch; return `false` synchronously to make it let go. See [Catching beasts](/guides/npcs-and-creatures/catching-beasts/#refereeing-a-catch) |
| `beastCaptureRequest` | `(beast, player)` | A player's Nab-Sack finished on a beast and the catch waits for the server; return `false` synchronously to refuse it |
| `beastCaptured` | `(player, captured)` | A catch landed: the beast is in the player's bag and has left the world |
| `beastReleased` | `(player, released, at)` | A player released a beast from their Field Guide; `at` is where they stood |
| `campActivated` | `(campId)` | A [camp](/guides/encounters/camps/)'s enemies spawn |
| `campCleared` | `(campId)` | Every enemy of an active camp is dead |
| `worldEventStarted` | `(spotId, kind)` | A [world event](/guides/encounters/world-events/) starts |
| `worldEventCleared` | `(spotId)` | Every enemy of a running world event is dead |
| `worldEventEnded` | `(spotId)` | A world event ends |
| `zoneEnter` | `(zone, entity)` | An entity comes into a [zone](/guides/encounters/zones/) |
| `zoneExit` | `(zone, entity, reason, entityId)` | An entity leaves a zone; `reason` is `"left"` or `"gone"` |
| `doorUnlockRequest` | `(player, door)` | A player tries to open a lock the server holds shut, by key or Alohomora |
| `lootableTaken` | `(player, lootableId, items)` | A player takes a server lootable; `items` is what it gave them |
| `housePointsChange` | `(house, points, previous)` | A house's points change |
| `housePointsRequest` | `(player, request)` | A player's game asks to change house points; return `false` synchronously to refuse it |
| `sanctuaryChanged` | `(id, revision, editor)` | An editor changes a [Room of Requirement](/guides/room-of-requirement/rooms/) room |
| `playerSanctuaryEnter` | `(player, id)` | A player enters a room |
| `playerSanctuaryLeave` | `(player, id)` | A player leaves a room |
| `pvpHit` | `(casterId, victimId, spell, damage)` | A PvP hit has passed server arbitration and policy and was relayed to its victim; `damage` is the final amount |
| `pvpDefeat` | `(victim, killer, kind)` | A player defeats another in [PvP](/guides/pvp/hits-and-defeat/#defeat); `kind` is `"death"` or `"kneel"` |
| `pvpRulesChanged` | `(rules)` | The PvP rules change |
| `pvpFlagChanged` | `(player, on)` | A player's PvP flag changes |
| `wandLinkEnded` | `(link, winner, reason)` | A [wand link](/guides/pvp/duels-and-wand-links/#wand-links) ends |
| `entityStateChange` | `(entity, key, value, previous)` | A script writes or removes one key of an entity's state or of `World.state`; `value` is `undefined` for a removal |

Some native server events originate in the connected player's game. The reserved `playerDied`, `playerDowned`, and `playerDownedEnd` messages use a dedicated native RPC and cannot be forged through `Events.emitServer`, but they are still client-authored observations. Location context, native inventory reports, request completions, and `npcDamaged` also cross the client/server boundary. Apply server-side validation appropriate to the consequences of the handler. In particular, adopt a `playerInventoryNativeDelta` with `player.inventory.adoptNative()` only under an explicit allowlist. `playerAppearanceChanged` is emitted after the server accepts and sanitizes an appearance, while `pvpHit` is a post-policy informational event; use `Pvp.setPolicy` to veto or reprice PvP hits.

For example:

```js
Events.on("playerConnect", (player) => {
  player.sendChat(`Welcome, ${player.nickname}!`);
});

Events.on("chatCommand", (player, message, command, args) => {
  if (command === "wave") {
    Chat.sendToAll(`${player.nickname} waves.`);
  }
});
```

### Native client events

These events are delivered only inside the client runtime. Receiving a native client event on the server requires an explicit client-to-server relay and an `Events.onClient` subscription; once relayed, it must be treated as untrusted client input.

#### Core and gameplay events

| Event | Handler arguments | When it fires |
| --- | --- | --- |
| `resourceStart` | `(resourceName)` | A client JavaScript resource starts |
| `resourceStop` | `(resourceName)` | A client JavaScript resource is about to stop |
| `chatMessage` | `({ author, text, color })` | A chat message arrives from the server |
| `chatSend` | `(text)` | The local player submits text through the chat overlay |
| `spellCast` | `(spellPath)` | The local player casts a spell; the path identifies its spell record |
| `playerRegionChanged` | `(region)` | The local player enters a named region |
| `creatorOpened` | `({})` | The character creator opens |
| `creatorConfirmed` | `({ first, last })` | The character creator closes after confirmation |
| `creatorCancelled` | `({})` | The character creator closes without confirmation |
| `creatorChanged` | `(state)` | A creator session's selections change |
| `abilityStatus` | `(handle)` | An ability the local player plays starts or settles |
| `spellAssignment` | `({ source, loadout, slot })` | A spell is assigned to a slot, from the game's menu or a script |
| `spellLearningFinished` | `(result)` | A spell lesson the resource started finishes; it grants no spell |
| `minimapChanged` | `(state, previous)` | The [minimap](/guides/user-interface/map-markers/#the-minimap) switches map, floor or tile |
| `pvpRelationChanged` | `(relation)` | The local player's [PvP relation](/guides/pvp/rules-and-relations/) to another player is resolved or changes |
| `localDowned` | `()` | The local player kneels after a PvP defeat |
| `localDownedEnd` | `({ wasDead })` | The local player gets up, from a kneel or a respawn |
| `entityStateChange` | `(entity, key, value, previous)` | A replicated state write or removal arrives on the client; `value` is `undefined` for a removal |

A `chatSend` handler may synchronously return `false` to prevent that line from being sent. An asynchronous return value cannot veto it.

The spell-cast and region hooks are installed automatically when their native signatures are available. `spellCast` is the exact event name; there is no `spellCasted` event.

```js
Events.on("spellCast", (spellPath) => {
  console.log(`Local spell cast: ${spellPath}`);
});
```

#### Armed combat events

Call `CombatEvents.arm()` before subscribing to the combat observations below. Arming is idempotent and returns whether the native watches were installed. `Races.watchEvents()` may add race lifecycle watches that are also delivered through `gameEvent`.

| Event | Handler arguments | When it fires |
| --- | --- | --- |
| `spellHit` | `(spellType, spellPath, victimClass, victimNpcId, victimIsLocal, casterClass, casterIsLocal)` | A watched spell hits an actor |
| `spellHitPlayer` | `(victimId, spellId, spellPath, damage)` | The local player's native spell impact hits another player's proxy |
| `damageReceived` | `(damage, targetClass, targetNpcId, targetIsLocal, instigatorClass, instigatorIsLocal)` | A watched actor receives damage |
| `gameEvent` | `(functionName, objectClass)` | Another explicitly watched native function fires |

```js
if (CombatEvents.arm()) {
  Events.on("spellHit", (spellType, spellPath, victimClass, victimNpcId) => {
    console.log(`${spellType || spellPath} hit ${victimClass} (${victimNpcId})`);
  });
}
```

`spellHitPlayer` is informational. The native client relays the impact separately for server arbitration; server resources can observe the resulting final hit through `pvpHit`.

`gameEvent` is not an unrestricted stream of every Unreal Engine event. It only reports functions installed by the available typed or feature-specific watchers.

#### Feature-specific native events

The native brewing and herbology hooks currently expose two additional events used by the bundled resources. Their payload is JSON text, so parse it before reading its fields.

| Event | Handler argument | Payload |
| --- | --- | --- |
| `brewingInput` | `(payloadJson)` | `{ action, siteUid, stationUid, potionId, yield }`; `action` is `begin`, `collect`, or `destroy` |
| `herbInput` | `(payloadJson)` | `{ action, plotUid, plantId, fertilizerId, state }`; `action` is `plant`, `fertilize`, `harvest`, or `destroy` |

`breakableState` fires with an object's id, `"broken"` or `"repaired"`, and its class when the local player breaks or repairs a repairable object, once `Breakables.arm()` has been called.

#### Web-view events

Native web-view lifecycle events are delivered only to the resource that owns the view. Each handler receives one object containing `viewId` and the fields listed below.

| Event | Additional fields | When it fires |
| --- | --- | --- |
| `browserCreated` | `url` | The view's browser is created |
| `browserLoadingStart` | `url`, `isMainFrame` | A frame starts loading |
| `browserDocumentReady` | `url` | The main document is ready to receive `Web.emit` |
| `browserLoadingFailed` | `url`, `description`, `errorCode`, `isMainFrame` | A frame fails to load |
| `browserNavigate` | `url`, `isMainFrame`, `blocked` | The page requests navigation |
| `browserPopup` | `url`, `openerUrl` | The page attempts to open a popup |
| `browserCursorChange` | `cursor`, `cursorType` | The page requests a different cursor |
| `browserTooltip` | `text` | The page requests or dismisses a tooltip |
| `browserInputFocusChange` | `focused` | An editable element gains or loses focus |
| `browserResourceBlocked` | `url`, `domain`, `reason` | The view rejects a navigation or foreign page event |
| `browserConsoleMessage` | `message`, `source`, `line`, `severity` | The page writes to its console |
| `browserOriginChange` | `origin`, `url` | The view's locked origin changes |

## Naming custom events

Use a stable namespace for events owned by your resources, especially when several resources may be installed together:

```js
Events.emit("quests:completed", { playerId, questId });
Events.emit("weather:changed", { preset });
```

Do not use a native event name for a different payload. Keep authoritative decisions on the server, and treat client events as requests or observations rather than proof that an action occurred.

## Where to go next

- [Your first resource](/guides/getting-started/first-resource/) — the manifest, script roles, and the resource lifecycle these events belong to.
