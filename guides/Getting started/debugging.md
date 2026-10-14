---
title: Debugging
description: Where console output and errors go on the server and the client, what each kind of error does to a resource, and what to attach to a bug report.
sidebar:
  order: 130
---

The release server and client have no debugger to attach to resource scripts, so you debug with what your scripts log and what the runtime logs about them. This page covers where that output goes on each side and how to read it.

## Where output goes

| | Server | Client |
| --- | --- | --- |
| While it runs | The server console | Nowhere: release clients have no in-game console |
| On disk | `logs/hogwarts-mp.log` in the server's directory | `logs/HogwartsMP.log` in the client's directory, beside `HogwartsMPLauncher.exe` |

Every line a resource writes is prefixed with the resource's name:

```text
[12:34:56] [info] [Scripting] [my-gamemode] round started
```

Both files rotate at 10 MB and keep the ten files before it, as `hogwarts-mp.1.log` and so on. On the server, the few lines written before it has read its configuration go to `logs/framework.log` instead.

To follow the client log while you play, keep it open in an editor that reloads changed files, or tail it from PowerShell:

```powershell
Get-Content .\logs\HogwartsMP.log -Wait -Tail 50
```

## What `console` prints

`console` has `log`, `info`, `warn`, `error` and `debug`. There is no `console.table`, `console.trace` or `console.time`, and calling one throws. Arguments are joined with spaces and `%s`-style placeholders are not filled in.

Values are printed differently from a browser or Node.js:

| Value | Printed as |
| --- | --- |
| Object | Its JSON, or `[Object]` when it cannot be serialized, such as a circular structure |
| Array | `[Array(3)]`, its length only |
| Function | `[Function]` |
| `Error` | `{}`, because its message and stack are not serialized |

So log an array as JSON, and log an error's stack rather than the error:

```js
console.log("players", JSON.stringify(PlayerManager.getAll().map((player) => player.nickname)));

try {
  startRound();
} catch (error) {
  console.error("startRound failed:", error instanceof Error ? error.stack : String(error));
}
```

## What an error does to a resource

| Where the error is thrown | What is logged | What happens next |
| --- | --- | --- |
| While the resource's scripts first run: a syntax error or a throw at the top level | A line starting `Failed to start` with the error | The resource does not start. |
| Inside an event handler | `[my-gamemode] Event 'playerConnect' handler error:` and the stack | The resource keeps running. |
| Server: inside a timer or other callback, or a promise rejection nothing handles | `[my-gamemode] Runtime error: [uncaughtException]` or `[unhandledRejection]`, and the stack | The server applies the manifest's `errorBehavior`. |
| Client: inside a timer callback | `Timer callback error:` and the stack, without the resource's name | The resource keeps running. |
| Client: a promise rejection nothing handles | `Unhandled promise rejection:` and the rejected value, with no stack or resource name | The resource keeps running. |

`errorBehavior` applies on the server only. Because the client logs an unhandled rejection without saying where it came from, catch errors in asynchronous client code yourself and log them with enough context to find them.

When a reload with `ensure` or `restart` fails, the console still echoes the resource's name. See [When a reload fails](/guides/getting-started/local-server/#when-a-reload-fails).

## Errors on players' machines

Nothing reports a client script error to the server. During development you can read your own client log, but to hear about errors on players' machines a resource has to send them itself. Treat what arrives as untrusted text: log it, and never act on it.

```js
// client/main.js
function report(where, error) {
  const text = error instanceof Error ? String(error.stack) : String(error);
  console.error(where, text);
  Events.emitServer("my-gamemode:clientError", { where, text: text.slice(0, 2000) });
}
```

```js
// server/main.js
Events.onClient("my-gamemode:clientError", (player, payload) => {
  if (!payload || typeof payload.where !== "string" || typeof payload.text !== "string") return;
  console.warn(`client error from ${player.nickname} in ${payload.where}: ${payload.text.slice(0, 2000)}`);
});
```

Rate-limit a reporter like this before shipping it, since any client can send it as often as it likes.

## Web views

Web views have no developer tools window. The console output of a page goes to the client log as `[Web/JS]` lines with the source file and line, and the resource that owns the view receives it as the `browserConsoleMessage` event:

```js
// client/main.js
Events.on("browserConsoleMessage", (event) => {
  if (event.severity === "error") console.error(`page error at ${event.source}:${event.line}: ${event.message}`);
});
```

## Stuck controls

A client script that stops while it holds the player's controls, for example after an error or a reload in the middle of a scripted scene, can leave input locked or a menu that will not open. Press **Ctrl+Shift+F10** to release every control lock and clear a stuck menu.

## What to attach to a bug report

- From the server: `logs/hogwarts-mp.log`, and `logs/framework.log` if the server failed while starting up.
- From the client: `logs/HogwartsMP.log` and `logs/cef.log` from the client's directory.

Remove tokens, passwords, database URLs and players' addresses before sharing a log.

## Where to go next

- [Run a local server](/guides/getting-started/local-server/) for reloading a resource while the server keeps running.
- [Events](/guides/core-concepts/events/) for the client/server bridge and what to trust.
