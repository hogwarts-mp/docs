---
title: Chat and commands
description: Send chat to everyone or one player, take over relaying players' chat, handle slash commands, and replace the chat on the client.
sidebar:
  order: 310
---

The game's chat overlay carries both chat and slash commands. The server sees every line a player sends and decides what everyone else reads.

## Sending chat

| Call | Reaches |
| --- | --- |
| `Chat.sendToAll(text, options)` | Every connected player |
| `Chat.sendToPlayer(player, text, options)` | One player |
| `player.sendChat(text)` | One player, without options |

`options` can set an `author`, shown before the text, and a `color`: a `Color` built from components between 0 and 1, or a packed `0xRRGGBBAA` number:

```js
// server/main.js
Chat.sendToAll("The duel starts in 10 seconds.", { author: "Arena", color: 0xffd700ff });
Chat.sendToPlayer(player, "You are on Gryffindor.", { color: new Color(0.75, 0.15, 0.1) });
```

Chat ignores [virtual worlds](/guides/core-concepts/virtual-worlds/#what-ignores-worlds): to talk to one world, send to its players one at a time.

## Relaying players' chat

When a player sends a line that is not a command, the server raises `chatMessage` with the player and the text. If no resource listens for it, the server relays the line to everyone as `nickname: text`.

As soon as any resource listens for `chatMessage`, the server stops relaying chat itself. Your handler decides what everyone reads, so it has to send the line on, or nobody sees it:

```js
// server/main.js
const muted = new Set();
const lastLine = new Map();

Events.on("chatMessage", (player, message) => {
  if (muted.has(player.id)) {
    player.sendChat("You are muted.");
    return;
  }
  const now = Date.now();
  if (now - (lastLine.get(player.id) ?? 0) < 1000) return;
  lastLine.set(player.id, now);

  Chat.sendToAll(message.slice(0, 200), { author: player.nickname });
});
```

The server does not rate-limit chat for you, so a resource that relays it should, as above.

## Slash commands

A line that starts with `/` is a command. It raises `chatCommand` instead of `chatMessage`, and is never relayed:

- `message` is the whole line, `/` included.
- `command` is the first word after the `/`, exactly as typed.
- `args` are the remaining words. Words are split on whitespace only, with no quoting, so `/tp "Central Hogsmeade"` gives `args` of `"Central` and `Hogsmeade"`.

Nothing answers a command no handler recognizes, so tell the player yourself:

```js
// server/main.js
const commands = {
  help: (player) => player.sendChat("Commands: /help, /time"),
  time: (player) => player.sendChat(`It is ${World.hour}:${String(World.minute).padStart(2, "0")}.`),
};

Events.on("chatCommand", (player, message, command, args) => {
  const handler = commands[command.toLowerCase()];
  if (handler) handler(player, args);
  else player.sendChat(`Unknown command /${command}. Try /help.`);
});
```

Several resources can listen for `chatCommand` at once, and each sees every command, so let each one answer only the commands it owns. Check permissions inside the handler: a command is a request from the player's client like any other.

## On the client

Client scripts see the chat from the other side:

- The `chatMessage` client event receives each line the server sends, as `{ author, text, color }`.
- The `chatSend` event fires with the text when the local player submits a line. A handler that returns `false` synchronously keeps the line from being sent; a returned promise cannot.
- `Chat.send(text)` sends a line to the server without raising `chatSend`.
- `Chat.open()`, `Chat.close()` and `Chat.isOpen()` control the input field, and `Chat.setUIVisible(false)` hides the whole overlay for the rest of the session, for a resource that draws its own chat.

```js
// client/main.js
Events.on("chatSend", (text) => {
  if (text.trim().length === 0) return false;
});
```

## Where to go next

- [Join and spawn](/guides/players/join-and-spawn/) for the events around a player's visit.
- [Authority](/guides/core-concepts/authority/) for treating what a client sends as a claim.
