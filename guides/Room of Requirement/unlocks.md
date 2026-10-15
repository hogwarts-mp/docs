---
title: Wings, vivariums and recipes
description: Open the Room of Requirement's expansions, vivarium biomes and lighting, and give players the conjuration recipes.
sidebar:
  order: 570
---

In the game, missions open the Room of Requirement's expansions and vivariums and teach the conjuration recipes. A server has no story to do it, so your script opens them itself: the parts of a room through its layout's `locks`, and recipes through each player's own locks.

## The room's locks

A layout's `locks` map holds every part of the room that can be closed, as the game's lock ids:

| Lock | Opens |
| --- | --- |
| `Nurture_SancExpansion01`, `Nurture_SancExpansion02`, `Nurture_SancExpansion03` | The room's three expansions |
| `DEV_Nurture_SancExpansion03Available` | The third expansion's availability flag: open it together with `Nurture_SancExpansion03` |
| `Nurture_BiomeUnlock_Forest`, `Nurture_BiomeUnlock_Grasslands`, `Nurture_BiomeUnlock_Coastal`, `Nurture_BiomeUnlock_Swamp` | The four vivarium biomes |
| `Nurture_SancInitialDressing01` to `Nurture_SancInitialDressing04` | The room's starting dressing. The game opens `01` from the start |
| `SanctuaryLightingAvailable` | The choice of lighting styles |

`true` opens a part and `false` closes it. List all thirteen in every layout you load: a lock left out keeps whatever the player's game had from the last room they were in. A room with everything open:

```js
// server/main.js
const ROOM_LOCKS = [
  "Nurture_SancExpansion01", "Nurture_SancExpansion02", "Nurture_SancExpansion03",
  "DEV_Nurture_SancExpansion03Available",
  "Nurture_BiomeUnlock_Forest", "Nurture_BiomeUnlock_Grasslands",
  "Nurture_BiomeUnlock_Coastal", "Nurture_BiomeUnlock_Swamp",
  "Nurture_SancInitialDressing01", "Nurture_SancInitialDressing02",
  "Nurture_SancInitialDressing03", "Nurture_SancInitialDressing04",
  "SanctuaryLightingAvailable",
];

const ALL_OPEN = Object.fromEntries(ROOM_LOCKS.map((lock) => [lock, true]));

Sanctuary.load("great-room", { version: 1, objects: [], locks: ALL_OPEN, lighting: "Default" });
```

The locks belong to the server. A player with edit rights can decorate a room but not open or close its parts, so the `locks` that `Sanctuary.get(id)` returns are always the ones you loaded, and they are saved with the rest of the layout.

## Opening a part later

To open or close a part of a room that is already loaded, load it again with its current layout and the changed lock:

```js
// server/main.js
function setRoomLock(id, lock, open) {
  const layout = Sanctuary.get(id);
  if (!layout) return false;
  return Sanctuary.load(id, { ...layout, locks: { ...layout.locks, [lock]: open } });
}

setRoomLock("great-room", "Nurture_SancExpansion02", true);
```

A change to a room's locks or lighting takes everyone inside back into it behind the game's loading screen, so they see the change at once. Players in other rooms are not affected. Pieces that sit in a part you close stay in the layout.

## Conjuration recipes

Recipes belong to the player, not the room. Each is a lock of the game's own: `Transfiguration_Category_*` locks open the categories of the conjuring menu and `Transfiguration_Item_*` locks open single pieces. There are 307 in all, listed [below](#the-recipe-locks).

Recipe locks live in the player's game, so they are opened on their client with `Doors.setLock(lockId, true)`. `Doors.isUnlocked(lockId)` reads one back. They are not saved anywhere: open them again every time a player joins. The server decides who gets them and the client opens them:

```js
// server/main.js
Events.on("loadingFinished", (player) => {
  if (mayConjure(player)) player.emit("recipes:open", "{}");
});
```

```js
// client/main.js
const RECIPE_LOCKS = [
  "Transfiguration_Category_Architecture",
  "Transfiguration_Category_Biome_BeastFeedingStationLarge",
  // ... the rest of the list below
];

Events.on("recipes:open", () => {
  for (const lockId of RECIPE_LOCKS) Doors.setLock(lockId, true);
});
```

`mayConjure` stands for your own rule: everyone, a group, or what a character has earned. The list lives in the client script so the event carries nothing but the signal.

Conjuring still costs moonstones, as in the game. Give them like any other item with `player.inventory.give("Moonstone", count)`; a stack holds at most 999.

## The recipe locks

Every conjuration lock in the game, for `RECIPE_LOCKS`:

```json
[
  "Transfiguration_Category_Architecture",
  "Transfiguration_Category_Biome_BeastFeedingStationLarge",
  "Transfiguration_Category_Biome_Bench_01",
  "Transfiguration_Category_Biome_Bench_02",
  "Transfiguration_Category_Biome_Bench_03",
  "Transfiguration_Category_Biome_BillywigHive",
  "Transfiguration_Category_Biome_Bush_Palette_01",
  "Transfiguration_Category_Biome_Bush_Palette_02",
  "Transfiguration_Category_Biome_CreaturePen",
  "Transfiguration_Category_Biome_Fence_Palette_01",
  "Transfiguration_Category_Biome_Fence_Palette_02",
  "Transfiguration_Category_Biome_Fence_Palette_03",
  "Transfiguration_Category_Biome_Fence_Palette_04",
  "Transfiguration_Category_Biome_GroundLarge_Palette_01",
  "Transfiguration_Category_Biome_GroundLarge_Palette_02",
  "Transfiguration_Category_Biome_GroundLarge_Palette_03",
  "Transfiguration_Category_Biome_GroundLarge_Palette_04",
  "Transfiguration_Category_Biome_GroundMedium_Palette_01",
  "Transfiguration_Category_Biome_GroundMedium_Palette_02",
  "Transfiguration_Category_Biome_GroundMedium_Palette_03",
  "Transfiguration_Category_Biome_GroundMedium_Palette_04",
  "Transfiguration_Category_Biome_HeroDioramaLarge_02",
  "Transfiguration_Category_Biome_HeroDioramaLarge_03",
  "Transfiguration_Category_Biome_HeroDioramaLarge_04",
  "Transfiguration_Category_Biome_HeroDioramaLarge_Palette",
  "Transfiguration_Category_Biome_MagicChime",
  "Transfiguration_Category_Biome_ManmadeDioramaLarge_Palette",
  "Transfiguration_Category_Biome_ManmadeDioramaLarge_Palette_02",
  "Transfiguration_Category_Biome_ManmadeDioramaLarge_Palette_03",
  "Transfiguration_Category_Biome_ManmadeDioramaLarge_Palette_04",
  "Transfiguration_Category_Biome_ManmadeMedium_Palette_01",
  "Transfiguration_Category_Biome_ManmadeMedium_Palette_02",
  "Transfiguration_Category_Biome_ManmadeMedium_Palette_03",
  "Transfiguration_Category_Biome_ManmadeMedium_Palette_04",
  "Transfiguration_Category_Biome_ManmadeMisc_Palette_01",
  "Transfiguration_Category_Biome_ManmadeMisc_Palette_02",
  "Transfiguration_Category_Biome_ManmadeMisc_Palette_03",
  "Transfiguration_Category_Biome_ManmadeSmall_Palette_01",
  "Transfiguration_Category_Biome_ManmadeSmall_Palette_02",
  "Transfiguration_Category_Biome_ManmadeSmall_Palette_03",
  "Transfiguration_Category_Biome_ManmadeSmall_Palette_04",
  "Transfiguration_Category_Biome_Metric_1mFloor",
  "Transfiguration_Category_Biome_Metric_1mWallLow",
  "Transfiguration_Category_Biome_Metric_2mFloor",
  "Transfiguration_Category_Biome_Metric_2mStairsLow",
  "Transfiguration_Category_Biome_Metric_2mWallLow",
  "Transfiguration_Category_Biome_Metric_3mArchMid",
  "Transfiguration_Category_Biome_Metric_3mButtSlide",
  "Transfiguration_Category_Biome_Metric_3mFloorCornerMid",
  "Transfiguration_Category_Biome_Metric_3mFloorMid",
  "Transfiguration_Category_Biome_Metric_3mPillar",
  "Transfiguration_Category_Biome_Metric_3mStairsMid",
  "Transfiguration_Category_Biome_Metric_3mWallMid",
  "Transfiguration_Category_Biome_Metric_3m_Crawlspace",
  "Transfiguration_Category_Biome_Metric_6mArchHigh",
  "Transfiguration_Category_Biome_Metric_6mButtslide",
  "Transfiguration_Category_Biome_Metric_6mFloorHigh",
  "Transfiguration_Category_Biome_Metric_6mPillarMid",
  "Transfiguration_Category_Biome_Metric_6mTowerHigh",
  "Transfiguration_Category_Biome_Metric_SpireTower",
  "Transfiguration_Category_Biome_NaturalDioramaLarge_Palette",
  "Transfiguration_Category_Biome_NaturalDioramaLarge_Palette_02",
  "Transfiguration_Category_Biome_NaturalDioramaLarge_Palette_03",
  "Transfiguration_Category_Biome_NaturalDioramaLarge_Palette_04",
  "Transfiguration_Category_Biome_NaturalDioramaMedium_Palette_01",
  "Transfiguration_Category_Biome_NaturalDioramaMedium_Palette_02",
  "Transfiguration_Category_Biome_NaturalDioramaMedium_Palette_03",
  "Transfiguration_Category_Biome_NaturalDioramaMedium_Palette_04",
  "Transfiguration_Category_Biome_SurfaceLarge_Palette_08",
  "Transfiguration_Category_Biome_SurfaceMedium_Palette_01",
  "Transfiguration_Category_Biome_SurfaceMedium_Palette_02",
  "Transfiguration_Category_Biome_SurfaceMedium_Palette_03",
  "Transfiguration_Category_Biome_SurfaceMedium_Palette_04",
  "Transfiguration_Category_Biome_SurfaceMedium_Palette_05",
  "Transfiguration_Category_Biome_SurfaceMedium_Palette_06",
  "Transfiguration_Category_Biome_SurfaceMedium_Palette_07",
  "Transfiguration_Category_Biome_ToyBox",
  "Transfiguration_Category_Biome_TreeSingle_Palette_01",
  "Transfiguration_Category_Biome_TreeSingle_Palette_02",
  "Transfiguration_Category_Biome_TreeSingle_Palette_03",
  "Transfiguration_Category_Biome_TreeSingle_Palette_04",
  "Transfiguration_Category_Sanc_3SeaterSofa_01_Dwiz",
  "Transfiguration_Category_Sanc_3SeaterSofa_01_Hbgst",
  "Transfiguration_Category_Sanc_3SeaterSofa_01_Mzoo",
  "Transfiguration_Category_Sanc_3SeaterSofa_01_Potnr",
  "Transfiguration_Category_Sanc_AmbientPainting_01",
  "Transfiguration_Category_Sanc_AmbientPainting_02",
  "Transfiguration_Category_Sanc_AmbientPainting_03",
  "Transfiguration_Category_Sanc_AmbientPainting_04",
  "Transfiguration_Category_Sanc_AmbientPainting_05",
  "Transfiguration_Category_Sanc_AmbientPainting_06",
  "Transfiguration_Category_Sanc_AmbientPainting_07",
  "Transfiguration_Category_Sanc_AmbientPainting_08",
  "Transfiguration_Category_Sanc_AmbientPainting_09",
  "Transfiguration_Category_Sanc_AmbientPainting_10",
  "Transfiguration_Category_Sanc_AmbientPainting_11",
  "Transfiguration_Category_Sanc_AmbientPainting_12",
  "Transfiguration_Category_Sanc_AmbientPainting_13",
  "Transfiguration_Category_Sanc_AmbientPainting_14",
  "Transfiguration_Category_Sanc_AmbientPainting_LS_01",
  "Transfiguration_Category_Sanc_AmbientPainting_LS_02",
  "Transfiguration_Category_Sanc_ArmChair",
  "Transfiguration_Category_Sanc_ArmChair_Dwiz",
  "Transfiguration_Category_Sanc_ArmChair_Hbgst",
  "Transfiguration_Category_Sanc_ArmChair_Mzoo",
  "Transfiguration_Category_Sanc_ArmilarySphere",
  "Transfiguration_Category_Sanc_ArmilarySphere_02",
  "Transfiguration_Category_Sanc_BiomeLandscape_Wall",
  "Transfiguration_Category_Sanc_BiomeLandscape_Wall_02",
  "Transfiguration_Category_Sanc_BiomeLandscape_Wall_03",
  "Transfiguration_Category_Sanc_BiomeLandscape_Wall_04",
  "Transfiguration_Category_Sanc_Bookcase_01_Dwiz",
  "Transfiguration_Category_Sanc_Bookcase_01_Hbgst",
  "Transfiguration_Category_Sanc_Bookcase_01_Mzoo",
  "Transfiguration_Category_Sanc_Bookcase_01_Potnr",
  "Transfiguration_Category_Sanc_BooksAndCauldronsShelve_Wall",
  "Transfiguration_Category_Sanc_Bookstand_01",
  "Transfiguration_Category_Sanc_Cabinet_01_Dwiz",
  "Transfiguration_Category_Sanc_Cabinet_01_Hbgst",
  "Transfiguration_Category_Sanc_Cabinet_01_Mzoo",
  "Transfiguration_Category_Sanc_Cabinet_01_Potnr",
  "Transfiguration_Category_Sanc_Chair_01_Dwiz",
  "Transfiguration_Category_Sanc_Chair_01_Hbgst",
  "Transfiguration_Category_Sanc_Chair_01_Mzoo",
  "Transfiguration_Category_Sanc_Chair_01_Potnr",
  "Transfiguration_Category_Sanc_ChoppingStation",
  "Transfiguration_Category_Sanc_ChristmasTree",
  "Transfiguration_Category_Sanc_CircularFrame_Wall_01",
  "Transfiguration_Category_Sanc_CircularFrame_Wall_02",
  "Transfiguration_Category_Sanc_CircularFrame_Wall_03",
  "Transfiguration_Category_Sanc_CreepyOdditiesShelve_Wall_01",
  "Transfiguration_Category_Sanc_Crests_Wall",
  "Transfiguration_Category_Sanc_Crests_Wall_02",
  "Transfiguration_Category_Sanc_Crests_Wall_03",
  "Transfiguration_Category_Sanc_Crests_Wall_04",
  "Transfiguration_Category_Sanc_Crests_Wall_05",
  "Transfiguration_Category_Sanc_DearSkull_Wall",
  "Transfiguration_Category_Sanc_Desk_01_Dwiz",
  "Transfiguration_Category_Sanc_Desk_01_Hbgst",
  "Transfiguration_Category_Sanc_Desk_01_Mzoo",
  "Transfiguration_Category_Sanc_Desk_01_Potnr",
  "Transfiguration_Category_Sanc_Diagrams_Wall_01",
  "Transfiguration_Category_Sanc_Diagrams_Wall_02",
  "Transfiguration_Category_Sanc_Diagrams_Wall_03",
  "Transfiguration_Category_Sanc_Diagrams_Wall_04",
  "Transfiguration_Category_Sanc_DragonStuffy",
  "Transfiguration_Category_Sanc_DressingScreen_01_Dwiz",
  "Transfiguration_Category_Sanc_DressingScreen_01_Hbgst",
  "Transfiguration_Category_Sanc_DressingScreen_01_Mzoo",
  "Transfiguration_Category_Sanc_DressingScreen_01_Potnr",
  "Transfiguration_Category_Sanc_DungComposter",
  "Transfiguration_Category_Sanc_ErumpentHorn_Wall_01",
  "Transfiguration_Category_Sanc_FelinePlates_Wall_01",
  "Transfiguration_Category_Sanc_FelinePlates_Wall_02",
  "Transfiguration_Category_Sanc_FelinePlates_Wall_03",
  "Transfiguration_Category_Sanc_FlowerBox_Wall",
  "Transfiguration_Category_Sanc_Footstool_01",
  "Transfiguration_Category_Sanc_Footstool_02",
  "Transfiguration_Category_Sanc_FreeStandingClock_01_Dwiz",
  "Transfiguration_Category_Sanc_FreeStandingClock_01_Hbgst",
  "Transfiguration_Category_Sanc_FreeStandingClock_01_Mzoo",
  "Transfiguration_Category_Sanc_FreeStandingClock_01_Potnr",
  "Transfiguration_Category_Sanc_FrogChoir",
  "Transfiguration_Category_Sanc_GardenerTools_Wall_01",
  "Transfiguration_Category_Sanc_Globe_01",
  "Transfiguration_Category_Sanc_Globe_02",
  "Transfiguration_Category_Sanc_Globe_03",
  "Transfiguration_Category_Sanc_HalloweenPumpkins",
  "Transfiguration_Category_Sanc_HerbologyTrophy",
  "Transfiguration_Category_Sanc_HoppingPot",
  "Transfiguration_Category_Sanc_HouseBanner_FreeStanding_01",
  "Transfiguration_Category_Sanc_HouseBanner_FreeStanding_02",
  "Transfiguration_Category_Sanc_HouseBanner_FreeStanding_03",
  "Transfiguration_Category_Sanc_HouseBanner_FreeStanding_04",
  "Transfiguration_Category_Sanc_HouseBanner_Wall_01",
  "Transfiguration_Category_Sanc_HouseBanner_Wall_02",
  "Transfiguration_Category_Sanc_HouseBanner_Wall_03",
  "Transfiguration_Category_Sanc_HouseBanner_Wall_04",
  "Transfiguration_Category_Sanc_HouseElfTrophy_Wall",
  "Transfiguration_Category_Sanc_HouseElfTrophy_Wall_02",
  "Transfiguration_Category_Sanc_HouseElfTrophy_Wall_03",
  "Transfiguration_Category_Sanc_HouseElfTrophy_Wall_04",
  "Transfiguration_Category_Sanc_HouseElfTrophy_Wall_05",
  "Transfiguration_Category_Sanc_HouseRules_Wall",
  "Transfiguration_Category_Sanc_HouseRules_Wall_Small_01",
  "Transfiguration_Category_Sanc_HouseRules_Wall_Small_02",
  "Transfiguration_Category_Sanc_Houserules_Wall_Big_01",
  "Transfiguration_Category_Sanc_Houserules_Wall_Big_02",
  "Transfiguration_Category_Sanc_KegShelve_Wall_01",
  "Transfiguration_Category_Sanc_Landscape_Wall_02",
  "Transfiguration_Category_Sanc_Landscape_Wall_03",
  "Transfiguration_Category_Sanc_Landscape_Wall_04",
  "Transfiguration_Category_Sanc_Landscape_Wall_Horizontal",
  "Transfiguration_Category_Sanc_LargeTable_01_Hbgst",
  "Transfiguration_Category_Sanc_LargeTable_01_Mzoo",
  "Transfiguration_Category_Sanc_LargeTable_01_Potnr",
  "Transfiguration_Category_Sanc_LargeTable_Big",
  "Transfiguration_Category_Sanc_LargeTable_Big_Decorated",
  "Transfiguration_Category_Sanc_LargeTable_Decorated_01_Hbgst",
  "Transfiguration_Category_Sanc_LargeTable_Decorated_01_Mzoo",
  "Transfiguration_Category_Sanc_LargeTable_Decorated_01_Potnr",
  "Transfiguration_Category_Sanc_LightFixtureFreeStanding_01_Dwiz",
  "Transfiguration_Category_Sanc_LightFixtureFreeStanding_01_Hbgst",
  "Transfiguration_Category_Sanc_LightFixtureFreeStanding_01_Mzoo",
  "Transfiguration_Category_Sanc_LightFixtureFreeStanding_01_Potnr",
  "Transfiguration_Category_Sanc_Loom",
  "Transfiguration_Category_Sanc_Mannequin_F_Dwiz_01",
  "Transfiguration_Category_Sanc_Mannequin_F_Hbgst_01",
  "Transfiguration_Category_Sanc_Mannequin_F_Mzoo_01",
  "Transfiguration_Category_Sanc_Mannequin_F_Potnr_01",
  "Transfiguration_Category_Sanc_Mannequin_M_Dwiz_01",
  "Transfiguration_Category_Sanc_Mannequin_M_Hbgst_01",
  "Transfiguration_Category_Sanc_Mannequin_M_Mzoo_01",
  "Transfiguration_Category_Sanc_Mannequin_M_Potnr_01",
  "Transfiguration_Category_Sanc_MaterialRefiner",
  "Transfiguration_Category_Sanc_MediumTable_01_Dwiz",
  "Transfiguration_Category_Sanc_MediumTable_01_Hbgst",
  "Transfiguration_Category_Sanc_MediumTable_01_Mzoo",
  "Transfiguration_Category_Sanc_MediumTable_01_Potnr",
  "Transfiguration_Category_Sanc_MediumTable_Decorated_01",
  "Transfiguration_Category_Sanc_MediumTable_Decorated_01_Dwiz",
  "Transfiguration_Category_Sanc_MediumTable_Decorated_01_Hbgst",
  "Transfiguration_Category_Sanc_MediumTable_Decorated_01_Mzoo",
  "Transfiguration_Category_Sanc_Mirrors_Wall_01",
  "Transfiguration_Category_Sanc_Mirrors_Wall_02",
  "Transfiguration_Category_Sanc_Mirrors_Wall_03",
  "Transfiguration_Category_Sanc_Mirrors_Wall_Horizontal_01",
  "Transfiguration_Category_Sanc_MissionRewards_WallHanging",
  "Transfiguration_Category_Sanc_MultipleTotems_Wall_01",
  "Transfiguration_Category_Sanc_OdditiesShelve_Wall_01",
  "Transfiguration_Category_Sanc_OrnamentStand_01_Dwiz",
  "Transfiguration_Category_Sanc_OrnamentStand_01_Hbgst",
  "Transfiguration_Category_Sanc_OrnamentStand_01_Mzoo",
  "Transfiguration_Category_Sanc_OrnamentStand_01_Potnr",
  "Transfiguration_Category_Sanc_OrnamentStand_Decorated_01_Dwiz",
  "Transfiguration_Category_Sanc_OrnamentStand_Decorated_01_Hbgst",
  "Transfiguration_Category_Sanc_OrnamentStand_Decorated_01_Mzoo",
  "Transfiguration_Category_Sanc_OrnamentStand_Decorated_Potnr",
  "Transfiguration_Category_Sanc_PlanterLarge1",
  "Transfiguration_Category_Sanc_PlanterLarge2",
  "Transfiguration_Category_Sanc_PlanterMedium1",
  "Transfiguration_Category_Sanc_PlanterMedium2",
  "Transfiguration_Category_Sanc_PlanterMedium3",
  "Transfiguration_Category_Sanc_PlanterSmall3",
  "Transfiguration_Category_Sanc_PlanterSmall5",
  "Transfiguration_Category_Sanc_Portraits_Wall_01",
  "Transfiguration_Category_Sanc_Portraits_Wall_02",
  "Transfiguration_Category_Sanc_PotionStationMedium",
  "Transfiguration_Category_Sanc_PotionStationT",
  "Transfiguration_Category_Sanc_PotioneerTools_Wall",
  "Transfiguration_Category_Sanc_QuidditchDiagram_Wall_01",
  "Transfiguration_Category_Sanc_QuidditchEquipment_Wall",
  "Transfiguration_Category_Sanc_RugLarge_01_Dwiz",
  "Transfiguration_Category_Sanc_RugMedium_01_Dwiz",
  "Transfiguration_Category_Sanc_RugMedium_01_Hbgst",
  "Transfiguration_Category_Sanc_RugMedium_01_Mzoo",
  "Transfiguration_Category_Sanc_RugMedium_01_Potnr",
  "Transfiguration_Category_Sanc_RugSmall_01_Dwiz",
  "Transfiguration_Category_Sanc_RugSmall_01_Hbgst",
  "Transfiguration_Category_Sanc_RugSmall_01_Mzoo",
  "Transfiguration_Category_Sanc_RugSmall_01_Potnr",
  "Transfiguration_Category_Sanc_Rug_Large",
  "Transfiguration_Category_Sanc_Rug_LargeSquare_01_Potnr",
  "Transfiguration_Category_Sanc_Rug_LargeSquare_Mzoo",
  "Transfiguration_Category_Sanc_SkullAndCandles_Wall",
  "Transfiguration_Category_Sanc_SmallTable_01_Dwiz",
  "Transfiguration_Category_Sanc_SmallTable_01_Hbgst",
  "Transfiguration_Category_Sanc_SmallTable_01_Mzoo",
  "Transfiguration_Category_Sanc_SmallTable_01_Potnr",
  "Transfiguration_Category_Sanc_SmallTable_Decorated_01_Dwiz",
  "Transfiguration_Category_Sanc_SmallTable_Decorated_01_Hbgst",
  "Transfiguration_Category_Sanc_SmallTable_Decorated_01_Mzoo",
  "Transfiguration_Category_Sanc_SmallTable_Decorated_01_Potnr",
  "Transfiguration_Category_Sanc_SquareFrame_Wall_01",
  "Transfiguration_Category_Sanc_SquareFrame_Wall_02",
  "Transfiguration_Category_Sanc_SquareFrame_Wall_03",
  "Transfiguration_Category_Sanc_StatueArmor",
  "Transfiguration_Category_Sanc_StatueArmor_02",
  "Transfiguration_Category_Sanc_Taxidermy_Wall_01",
  "Transfiguration_Category_Sanc_Taxidermy_Wall_02",
  "Transfiguration_Category_Sanc_Taxidermy_Wall_03",
  "Transfiguration_Category_Sanc_Taxidermy_Wall_04",
  "Transfiguration_Category_Sanc_Telescope_01",
  "Transfiguration_Category_Sanc_TotemSolo_Wall_01",
  "Transfiguration_Category_Sanc_WoodenMaiden",
  "Transfiguration_Item_Sanc_DiricawlStatue_01",
  "Transfiguration_Item_Sanc_FwooperStatue_01",
  "Transfiguration_Item_Sanc_GPTStatue_01",
  "Transfiguration_Item_Sanc_GraphornStatue_01",
  "Transfiguration_Item_Sanc_HippogriffStatue_01",
  "Transfiguration_Item_Sanc_JobbStatue_01",
  "Transfiguration_Item_Sanc_KneazleStatue_01",
  "Transfiguration_Item_Sanc_MooncalfStatue_01",
  "Transfiguration_Item_Sanc_NifflerStatue_01",
  "Transfiguration_Item_Sanc_PhoenixStatue_01",
  "Transfiguration_Item_Sanc_PlanterSmall1_Dwiz",
  "Transfiguration_Item_Sanc_PlanterSmall1_Hbgst",
  "Transfiguration_Item_Sanc_PlanterSmall1_Mzoo",
  "Transfiguration_Item_Sanc_PlanterSmall1_Potnr",
  "Transfiguration_Item_Sanc_PotionStationSmall_01_Dwiz",
  "Transfiguration_Item_Sanc_PotionStationSmall_01_Hbgst",
  "Transfiguration_Item_Sanc_PotionStationSmall_01_Mzoo",
  "Transfiguration_Item_Sanc_PotionStationSmall_01_Potnr",
  "Transfiguration_Item_Sanc_PuffStatue_01",
  "Transfiguration_Item_Sanc_ThestralStatue_01",
  "Transfiguration_Item_Sanc_UnicornStatue_01",
  "Transfiguration_Sanc_IdentificationStation"
]
```

## Where to go next

- [Rooms](/guides/room-of-requirement/rooms/) for loading, decorating and saving rooms.
- [Doors and visits](/guides/room-of-requirement/doors-and-visits/) for getting players in and out of rooms.
- [Inventory](/guides/players/inventory/) for giving players moonstones and other materials.
