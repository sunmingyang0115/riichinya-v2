# RiichiDB Lifetime Progression Notes

Status: implemented against the bot source of truth, `rdb2.sql`.

## Why This File Lives Here

The `riichiElo` folder is useful as a reference/prototype repo, but the actual feature belongs to this Discord bot. The bot owns the commands, profile embed, and live `rdb2.sql` database. These notes should stay with the bot code and refer back to `riichiElo` where needed.

## Reference Files Read

- `riichiElo/plan.txt`
- `riichiElo/sql/simulateLifetime.ts`
- `riichiElo/sql/lifetimeTable.ts`
- `src/modules/riichidb.ts`
- `src/modules/riichidb/sql_db2.ts`
- `src/modules/riichidb/db_struct.ts`
- `src/modules/riichidb/query_struct.ts`
- `src/templates/playerProfile.ts`
- `src/scripts/migrate_riichidb.ts`

## Feature Goal

Add a lifetime progression system to RiichiDB so recorded club games have long-term meaning outside league prizes.

Expected user-facing pieces:

- A command to view lifetime ranks.
- Lifetime rank/progression shown on RiichiDB player profiles.
- Regular recorded games affect lifetime progression.
- League games do not affect lifetime progression; league submissions surface league rank and league adjusted total instead.

## Prototype Formula

The current prototype in `riichiElo/sql/simulateLifetime.ts` is not pure Elo. It is a cumulative progression system with permanent rank floors.

Current prototype constants:

```ts
participationPoints: 0
adjustedScoreDivisor: 1000
ranks:
  Novice    threshold 0     placementBonus [20, 10, 0, -10]
  Adept     threshold 100   placementBonus [20, 10, 0, -20]
  Expert    threshold 300   placementBonus [20, 10, 0, -30]
  Master    threshold 600   placementBonus [20, 10, 0, -35]
  Saint     threshold 1000  placementBonus [20, 10, 0, -40]
  Celestial threshold 1500  placementBonus [20, 10, 0, -45]
```

Per-player game delta:

```text
delta = participationPoints + adjustedScore / adjustedScoreDivisor + placementBonus[currentRank][placement]
```

After each game:

```text
points = max(currentRankFloor, points + delta)
```

If points meet a higher rank threshold, the player promotes. The new rank becomes permanent and the floor is raised to that rank threshold.

Important: `plan.txt` includes an example with larger placement bonuses such as `[35, 15, -5, rank-based 4th penalty]`, but the actual simulator currently uses `[20, 10, 0, rank-based 4th penalty]`.

## Prototype Details

The simulator reads old tables:

- `DataGame`
- `DataPlayer`

The bot no longer uses those as its active schema.

The simulator computes placements from raw score order, then uses adjusted score for progression. In the bot's current schema, `placement` is already stored on `ParticipantTable`, so the bot does not need to recompute it for normal use.

The simulator also computes `opponentDifficultyByPlayer`, but that is report-only. It does not affect rank point deltas.

## Current Bot Schema

The bot uses `rdb2.sql` through `src/modules/riichidb/sql_db2.ts`.

Current tables:

- `SeasonTable`
- `GameTable`
- `ParticipantTable`
- `ConfigTable`

Relevant data is already present:

- `GameTable.game_id`
- `GameTable.season_id`
- `GameTable.date`
- `ParticipantTable.player_id`
- `ParticipantTable.raw_score`
- `ParticipantTable.adj_score`
- `ParticipantTable.placement`

Observed live DB state during analysis:

- `SeasonTable`: 8 seasons
- `GameTable`: 541 games
- `ParticipantTable`: 2164 participants
- Date range: `2024-10-07T02:06:22.247Z` to `2026-06-23T00:45:35.596Z`
- `current_season`: `S26`
- `current_league_season`: `S26_L`

Season game counts:

```text
F24:    66
W25:    11
S25:   105
F25_1: 105
F25_2:  84
W26:   118
S26:    19
S26_L:  33
```

## Current Bot Command/Profile Flow

Main command module:

- `src/modules/riichidb.ts`

Existing user-facing commands:

- `ron rdb me`
- `ron rdb player @user`
- `ron rdb compare ...`
- `ron rdb league`
- `ron rdb ...leaderboard args...`

Existing season selectors:

- default: all seasons
- `--current` / `-c`
- `--league` / `-l`
- `--season <id>` / `-s <id>`

Existing insert flows:

- Message context menu `Insert Scores` inserts into current regular season.
- Message context menu `Insert League Scores` inserts into current league season.

Profile rendering:

- `src/templates/playerProfile.ts`
- Calls `RiichiDatabase.getPlayerProfile(...)`
- Calls `RiichiDatabase.getRecentGames(...)`
- Calls `RiichiDatabase.getOpponentDelta(...)`

The profile currently displays a field named `Rank`, but that rank is leaderboard position by total adjusted score, not lifetime progression rank.

## Key Mismatch

The prototype simulation output in `riichiElo/sql/LifetimeProgressionSimulation.txt` is based on `riichiElo/sql/Combined.sql`, not directly on the bot's live `rdb2.sql`.

That means we should not copy the output table as authoritative. We should port the calculation to the normalized bot schema and recompute from `GameTable` plus `ParticipantTable`.

## Suggested Implementation Shape

### 1. Add a Lifetime Progression Domain Module

Create a small bot-side module, probably under:

```text
src/modules/riichidb/lifetime_progression.ts
```

It should contain:

- Rank rules/constants.
- `rankName(...)`
- `rankFloor(...)`
- `rankForPoints(...)`
- `applyGame(...)`
- Types for player lifetime state and leaderboard rows.

Keep the formula outside `riichidb.ts` so commands and profiles can share it.

### 2. Add Database Queries Over Normalized Tables

In `RiichiDatabase`:

- Add a query to fetch all lifetime participant results in chronological order.
- Join `ParticipantTable` to `GameTable`.
- Order by `g.date asc, g.game_id asc`.
- Return rows with `game_id`, `date`, `player_id`, `raw_score`, `adj_score`, `placement`.

The lifetime calculation can be done in TypeScript from these rows.

This avoids adding derived tables at first and keeps the feature easy to tune while the formula is unsettled.

### 3. Add Lifetime Rank Query Helpers

Likely helpers:

- `getLifetimeLeaderboard(limit, offset)`
- `getLifetimePlayer(player_id)`
- Maybe `getLifetimePlayers()` internally, if the data set remains small.

The live database is small enough right now: 541 games and 2164 participant rows. Recomputing lifetime progression on command is acceptable initially.

If this grows or becomes slow, add a cached/materialized table later.

### 4. Add User-Facing Command

Add one explicit lifetime command to avoid overloading the existing score leaderboard:

```text
ron rdb ranks
```

Possible variants:

```text
ron rdb ranks
ron rdb ranks 50
ron rdb ranks m
```

Recommended displayed columns:

- rank position
- player mention
- lifetime rank name
- lifetime points
- games
- avg adjusted score
- avg placement

This should probably not use season selectors. It is lifetime by definition.

### 5. Add Lifetime Rank To Profiles

In `playerProfileCreator`, fetch lifetime state for the profiled user in parallel with the existing season-scoped profile data.

Suggested display:

- Rename current profile `Rank` field to `Leaderboard Rank` or `Adj Total Rank`.
- Add `Lifetime Rank`: `Master (687.8 pts)` or similar.

This avoids confusion between leaderboard placement and progression rank.

### 6. Decide Whether Lifetime Includes All Recorded Seasons

Current product intent says regular recorded games count for lifetime progression, while league games do not. The current database does not have a separate per-game boolean for "counts for lifetime", so the first implementation identifies league games by season id.

Simplest initial rule:

```text
All games in GameTable count except league seasons whose `season_id` ends with `_L`.
```

If historical/admin-entered exceptions matter, add a column later, for example:

```sql
counts_lifetime integer not null default 1
```

But that migration should only happen if there are known exceptions.

## Implemented Bot Changes

Implemented files:

- `src/modules/riichidb/lifetime_progression.ts`
- `src/modules/riichidb/query_struct.ts`
- `src/modules/riichidb/sql_db2.ts`
- `src/modules/riichidb.ts`
- `src/templates/playerProfile.ts`

Implemented behavior:

- Added a reusable lifetime progression calculator using the current prototype constants from `riichiElo/sql/simulateLifetime.ts`.
- Added `RiichiDatabase.getLifetimeGameResults()` over normalized `GameTable` plus `ParticipantTable` rows from `rdb2.sql`.
- Added `RiichiDatabase.getLifetimeLeaderboard(offset, limit)`.
- Added `RiichiDatabase.getLifetimePlayer(player_id)`.
- Added `ron rdb ranks`, with optional amount: `ron rdb ranks 50`.
- Added `ron rdb ranks all`, currently capped at 100 players.
- Added lifetime rank to RiichiDB profiles.
- Renamed the existing profile `Rank` field to `Leaderboard Rank` to distinguish it from lifetime progression rank.

Current command output columns:

```text
No. | Player | Pts | G | Adj Avg | Avg Pl
```

Lifetime ranks are grouped by lifetime rank name in the embed description, for example `Celestial` followed by that rank's player rows, then `Saint`, and so on.

Current score submission replies:

```text
Recorded Game (Season Name)
1 @player +42.1 | +62.1 -> Master 700/1000
```

```text
Recorded League Game (Season Name)
1 @player +42.1 | #2 | +126.4
```

Regular submission replies include a compact `Promotions` field when a player crosses a lifetime rank threshold. League submission replies intentionally do not mention lifetime rank.

Lifetime progression currently counts regular games in `GameTable` and excludes league seasons whose `season_id` ends with `_L`.

Verification run:

- `npm run build` passed after the lifetime rank/profile work and again after the score-submit display changes.
- A direct runtime check against `rdb2.sql` returned valid lifetime leaderboard rows from `RiichiDatabase.getLifetimeLeaderboard(...)`.

## Open Decisions

- Final formula: use the simulator constants exactly, or switch to the larger `[35, 15, -5, penalty]` example from `plan.txt`.
- Whether to include opponent difficulty as an informational column later. It is not part of the progression formula.
- Whether to add Discord roles for lifetime ranks. This is mentioned in `plan.txt` but is not required for the first bot implementation.
- Whether the formula should be treated as mutable while testing, or locked once published. The current implementation recomputes from history, so formula changes are retroactive.

## Risks And Gotchas

- The profile now labels the old total-adjusted leaderboard position as `Leaderboard Rank`; avoid reintroducing a generic `Rank` label there.
- Recomputing lifetime from historical games means any formula change updates everyone's rank retroactively unless we store snapshots.
- Permanent floors depend on chronological order. Ordering by date plus game id should be deterministic.
- Deleting or editing old games can change current lifetime points/ranks if ranks are recomputed live.
- `riichiElo/sql/simulateLifetime.ts` uses an old schema and should not be dropped directly into the bot.
- The checked-in `LifetimeProgressionSimulation.txt` may not match the current bot DB.

## Completed Engineering Steps

1. Ported the simulator calculation to a reusable bot-side TypeScript module using normalized participant rows.
2. Added `RiichiDatabase.getLifetimeGameResults()` plus leaderboard/player helpers.
3. Added `ron rdb ranks` command.
4. Added lifetime rank to player profiles and renamed the existing leaderboard rank field.
5. Ran `npm run build` successfully.
6. Verified the new lifetime query against live `rdb2.sql` data.
7. Updated score submission replies to be public and compact: regular submissions show lifetime delta/progress, while league submissions show league rank and adjusted total only.

