---
title: Web views
description: Draw your own interfaces in HTML over the game, ship their pages with your resource, and pass messages between a page and your client script.
sidebar:
  order: 600
---

A web view is a browser page drawn over the game. Client scripts create and control views with the `Web` global, and a page talks back to its script through a `callEvent` function the view gives it. Menus, shops and scoreboards are usually web views.

## Shipping a page

A page is a set of files in your resource. List them under `files` in the manifest so they reach players along with your client scripts:

```json
{
  "name": "wand-shop",
  "mafiahub": {
    "clientScripts": ["client/main.js"],
    "serverScripts": ["server/main.js"],
    "files": ["ui/**"]
  }
}
```

A shipped file's address is `fw://resources/<resource>/<path>`, so this resource's `ui/index.html` is `fw://resources/wand-shop/ui/index.html`. Pass that full address: `Web.createView` does not resolve a path such as `ui/index.html` against your resource. Inside the page, load your styles, scripts and images by relative paths such as `style.css`. A path starting with `/` points at another resource.

A view can also load a site over `https://`, or a development server such as `http://localhost:5173` while you work on a page.

## Creating a view

`Web.createView(url, options)` creates a view and returns its id, which the other `Web` calls take:

```js
// client/main.js
const scoreboard = Web.createView("fw://resources/wand-shop/ui/scoreboard.html", { width: 400, height: 300, x: 40, y: 40 });
```

| Option | Default | Meaning |
| --- | --- | --- |
| `width`, `height` | 0 | Size in pixels. Leaving both at 0 fills the screen and follows the window's size. |
| `x`, `y` | 0 | Position of the top-left corner in pixels. |
| `zIndex` | 0 | Stacking order: higher views are drawn on top. |
| `visible` | `true` | Whether the view starts on screen. |
| `focus` | `false` | Whether the view starts with the player's input. |

`createView` throws if the view cannot be created. A page's background is transparent unless the page paints one, so only what it draws covers the game. Pages render without the GPU, so leave heavy animation and WebGL out.

`Web.showView` and `Web.hideView` put a view on and off screen, `Web.resizeView` and `Web.setViewPosition` move it, and `Web.getScreenSize()` returns the screen's size in pixels. Resizing a full-screen view yourself stops it following the window.

A view belongs to the resource that created it. It is destroyed when that resource stops and when the player disconnects, and `Web.destroyView(id)` destroys it earlier along with its handlers. During a loading screen, views stay off screen and come back once it is gone.

## Messages between page and script

The page calls `callEvent(name, payload)` to send your script an event. It takes exactly two arguments: the event name, and JSON text or `null`. Your script listens with `Web.on(view, name, handler)`, and the handler receives the payload already parsed.

Your script calls `Web.emit(view, name, payload)` to send the page an event. The page receives it as a `CustomEvent` on `window`, with the payload in `detail`. The payload is serialized for you, so pass objects as they are.

An event sent before the page listens for it is lost, so have the page say when it is ready. In this shop, `ui/index.html` holds an empty list with the id `wands` and a Close button with the id `close`, and loads `ui/shop.js`, which shows the wands it is sent and reports which one the player picks:

```js
// ui/shop.js, running in the page
window.addEventListener("shop:stock", (event) => {
  const items = event.detail.map((wand) => {
    const item = document.createElement("li");
    item.textContent = `${wand.name}: ${wand.price} Galleons`;
    item.addEventListener("click", () => callEvent("shop:buy", JSON.stringify({ wandId: wand.id })));
    return item;
  });
  document.getElementById("wands").replaceChildren(...items);
});

document.getElementById("close").addEventListener("click", () => callEvent("shop:close", null));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") callEvent("shop:close", null);
});

callEvent("shop:ready", null);
```

The client script opens the page when the server says so, and passes the player's choice on:

```js
// client/main.js
const SHOP_URL = "fw://resources/wand-shop/ui/index.html";
let shopView = null;

Events.on("shop:open", (payload) => {
  if (shopView !== null) return;
  const view = Web.createView(SHOP_URL, { focus: true });
  shopView = view;

  Web.on(view, "shop:ready", () => Web.emit(view, "shop:stock", payload.wands));
  Web.on(view, "shop:buy", (choice) => Events.emitServer("shop:buy", { wandId: choice.wandId }));
  Web.on(view, "shop:close", () => {
    Web.destroyView(view);
    shopView = null;
  });
});
```

Any text that parses as JSON arrives parsed, so `"42"` arrives as the number 42. Send plain text through `JSON.stringify` so it arrives as a string. `Web.off(view, name, handler)` removes a handler.

What a page sends is a request from the player's machine, like any client event. The server checks that the player can afford the wand and is at the shop before handing it over; [Authority](/guides/core-concepts/authority/) covers handling what a client sends.

## Focus and input

A focused view receives all of the player's keyboard and mouse input, Escape included, and the game receives none. While a view has focus, the controls stay locked and the cursor shows, so there is no need to call [`Game.lockControls`](/guides/user-interface/keys-and-menus/#locking-the-controls) around it, and [key bindings](/guides/user-interface/keys-and-menus/#binding-keys) do not fire.

`Web.focusView(view)` gives a view focus, and `Web.focusView(view, false)` takes it away. Hiding or destroying a view also takes its focus away, and so does stopping its resource.

- A page cannot give up focus by itself. Always give it a way to ask your script, as the Close button and Escape key do above.
- A focused view takes every click anywhere on screen, transparent areas included, so focus a view only while the player is using it.
- Do not focus a hidden view: it blocks the game's input with nothing on screen to click.
- The Enter key reaches a page as a key press but types no character. Handle it in a `keydown` listener rather than relying on a form to submit itself.

## Where a view may go

Each view is locked to the origin of the address it was created with: its scheme, host and port. The view refuses to navigate to another origin, including through a redirect, and raises `browserResourceBlocked` with the reason `"cross-origin"`. It ignores `callEvent` from a page of another origin. To move a view to another origin on purpose, `Web.loadURL(view, url)` navigates it and locks it to the new one. Your `Web.on` handlers stay, but the page starts again, so wait for it to be ready again.

Pages cannot open popups or new windows; `browserPopup` reports the attempt with the address.

Every resource's pages share the one origin `fw://resources`, so they can read each other's files and browser storage. Keep nothing in a page that another resource must not see.

## Lifecycle events

The resource that owns a view receives events about it, each with the view's id as `viewId`. Among them are `browserDocumentReady` when its page has loaded, `browserLoadingFailed` when a load fails, and `browserConsoleMessage` for what the page logs. [Events](/guides/core-concepts/events/#web-view-events) lists all of them, and [Debugging](/guides/getting-started/debugging/#web-views) covers reading a page's console.

## Drawing on objects

`Web.setViewOffscreen(view, true)` keeps a hidden view painting, so something else can sample it, such as a render target that draws the page onto an object in the world. A view that is merely hidden stops painting, and anything sampling it freezes.

## From the server

`player.showUI`, `player.hideUI` and `player.sendUI` ask a client resource named `ui` to open, close and message a view, and do nothing without one. Neither the release nor HMP Foundations includes that resource, so send your own events with `player.emit`, as above, and keep views in your client scripts.

## Where to go next

- [Keys and menus](/guides/user-interface/keys-and-menus/) for opening your interface from a key and keeping the game's own menus shut.
- [HUD, prompts and nametags](/guides/user-interface/hud-and-nametags/) for what the game draws itself.
