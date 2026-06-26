# RiichiDB Lifetime Progression Notes

Status: implemented, but the points formula is still being evaluated.

## Product Goal

Lifetime progression gives recorded club games long-term meaning outside league prizes.

The system should:

- Show a player's lifetime rank on RiichiDB profiles.
- Provide a lifetime ranks command.
- Count regular recorded games toward lifetime progression.
- Keep league scoring separate from lifetime progression.
- Avoid Discord role automation for now.

League games should still use the normal league uma, currently `15/5/-5/-15`, because that keeps league standings more comeback-friendly after one big result.

Lifetime progression does not need to use the same scoring shape as league.

## Current Bot Behavior

Implemented files:

- `src/modules/riichidb/lifetime_progression.ts`
- `src/modules/riichidb/sql_db2.ts`
- `src/modules/riichidb/query_struct.ts`
- `src/modules/riichidb.ts`
- `src/templates/playerProfile.ts`

Current user-facing pieces:

- `ron rdb ranks`
- `ron rdb ranks 50`
- `ron rdb ranks all`
- Lifetime rank/progress on player profiles.
- Regular score submissions show lifetime delta/progress.
- League score submissions show league rank/total, not lifetime progress.

Current season-scope behavior for RiichiDB commands:

- Default: current league season.
- `-l` / `--league`: current league season.
- `-c` / `--current`: current regular season.
- `-a` / `--all`: all seasons.
- `-s <id>` / `--season <id>`: explicit season.

Shortcut profile/compare commands:

- `ron rdb @player`: profile.
- `ron rdb @player1 @player2`: comparison.
- Seasonal tags still work, for example `ron rdb @player -c` or `ron rdb @player1 @player2 -a`.

Lifetime progression currently counts regular games and excludes league seasons whose `season_id` ends with `_L`.

## Current Implemented Formula

The current implementation is a cumulative progression system with permanent rank floors.

Current constants:

```ts
participationPoints: 0
adjustedScoreDivisor: 1000
basePlacementBonus: [20, 10, 0, -30]
opponentRankDifferenceMultiplier: 5
ranks:
  Novice    threshold 0
  Adept     threshold 100
  Expert    threshold 300
  Master    threshold 600
  Saint     threshold 1000
  Celestial threshold 1500
```

Per-player game delta:

```text
delta = adjustedScore / 1000 + placementBonus
```

The base placement bonus is:

```text
1st: +20
2nd: +10
3rd: +0
4th: -30
```

For 4th place only, the penalty is adjusted by table difficulty:

```text
opponentRankDifference = sum(opponentRank - playerRank)
placementBonus = -30 + opponentRankDifference * 5
```

Example: Expert vs Adept, Master, and Novice:

```text
Expert rank = 3
Opponents = 2, 4, 1
opponentRankDifference = (2 - 3) + (4 - 3) + (1 - 3) = -2
4th place penalty = -30 + (-2 * 5) = -40
```

Example: Celestial vs three Experts:

```text
Celestial rank = 6
Opponents = 3, 3, 3
opponentRankDifference = (3 - 6) + (3 - 6) + (3 - 6) = -9
4th place penalty = -30 + (-9 * 5) = -75
```

After each game:

```text
points = max(currentRankFloor, points + delta)
```

If points meet a higher rank threshold, the player promotes. The new rank becomes permanent and the floor is raised to that rank threshold.

All players in a game use the ranks they had before that game is applied, so one player's promotion does not affect another player's result in the same game.

## Current Tie Handling

Tied placements split the occupied placement slots, similar to how tied uma is split.

Examples:

- Two players tied for 1st occupy 1st and 2nd, so both get `(20 + 10) / 2 = 15`.
- Two players tied for 2nd occupy 2nd and 3rd, so both get `(10 + 0) / 2 = 5`.
- Two players tied for 3rd occupy 3rd and 4th, so each gets `(0 + their own adjusted 4th penalty) / 2`.
- Three players tied for 1st occupy 1st, 2nd, and 3rd, so all get `(20 + 10 + 0) / 3 = 10`.
- Three players tied for 2nd occupy 2nd, 3rd, and 4th, so each gets `(10 + 0 + their own adjusted 4th penalty) / 3`.
- Four players tied occupy 1st, 2nd, 3rd, and 4th, so each gets `(20 + 10 + 0 + their own adjusted 4th penalty) / 4`.

Because the current adjusted 4th-place penalty is player-specific, tied players can receive different lifetime bonuses when the tie includes 4th place.

## Formula Concerns

The current formula is somewhat confusing because it combines two placement-sensitive systems:

- `adjustedScore / 1000`, where adjusted score already includes season uma.
- A separate lifetime placement bonus of `20/10/0/-30`.

This makes placement matter, but it can feel like uma is being counted twice. It also makes the lifetime system harder to explain because regular seasons, league seasons, adjusted score, placement bonus, and opponent rank penalty are all mixed together.

The last-place penalty was originally inspired by online ladder systems, where harsh 4th-place punishment discourages disconnecting or reckless play. That problem is less relevant for in-person club games.

## Proposed Next Formula

Keep league scoring unchanged, but make lifetime progression its own zero-sum placement system.

Base lifetime placement points:

```text
1st: +30
2nd: +10
3rd: -10
4th: -30
```

This is zero-sum:

```text
+30 +10 -10 -30 = 0
```

Then add a small opponent difficulty adjustment:

```text
difficultyBonus = 0.5 * sum(opponentRank - playerRank)
delta = placementPoints + difficultyBonus
```

Rank numbers:

```text
Novice    = 1
Adept     = 2
Expert    = 3
Master    = 4
Saint     = 5
Celestial = 6
```

Example: Expert vs Adept, Master, and Novice:

```text
Expert rank = 3
Opponents = 2, 4, 1
sum = (2 - 3) + (4 - 3) + (1 - 3)
    = -1 + 1 - 2
    = -2
difficultyBonus = -1.0
```

So that Expert's lifetime deltas would be:

```text
1st: +29
2nd: +9
3rd: -11
4th: -31
```

Example: Novice vs three Experts:

```text
Novice rank = 1
Opponents = 3, 3, 3
sum = (3 - 1) + (3 - 1) + (3 - 1) = 6
difficultyBonus = +3.0
```

So that Novice's lifetime deltas would be:

```text
1st: +33
2nd: +13
3rd: -7
4th: -27
```

Example: Celestial vs three Experts:

```text
Celestial rank = 6
Opponents = 3, 3, 3
sum = (3 - 6) + (3 - 6) + (3 - 6) = -9
difficultyBonus = -4.5
```

So that Celestial's lifetime deltas would be:

```text
1st: +25.5
2nd: +5.5
3rd: -14.5
4th: -34.5
```

This difficulty adjustment is zero-sum across the table because every pairwise rank difference cancels out.

## Proposed Tie Handling

For the proposed formula, tied placements should still average the occupied placement slots.

Examples:

- Two-way tie for 1st: `(+30 + +10) / 2 = +20`.
- Two-way tie for 2nd: `(+10 + -10) / 2 = 0`.
- Two-way tie for 3rd: `(-10 + -30) / 2 = -20`.
- Three-way tie for 1st: `(+30 + +10 + -10) / 3 = +10`.
- Three-way tie for 2nd: `(+10 + -10 + -30) / 3 = -10`.
- Four-way tie: `(+30 + +10 + -10 + -30) / 4 = 0`.

Then apply each player's own difficulty bonus.

This keeps the base placement system zero-sum even with ties, and the difficulty adjustment remains zero-sum across the table.

## Why The Proposed Formula Is Cleaner

The proposed formula is easier to explain:

```text
Lifetime ranks use +30/+10/-10/-30 placement points, adjusted slightly by opponent rank difficulty.
```

Benefits:

- It keeps league scoring and lifetime progression separate.
- It avoids double-counting season uma through adjusted score.
- It makes placement matter more than `15/5/-5/-15`.
- It keeps all base placement points zero-sum.
- It rewards beating stronger tables and softens losses against stronger tables.
- It reduces the special online-style 4th-place punishment.
- It is easier to tune because there are only two main knobs: placement points and difficulty multiplier.

## Rank Floors

Rank floors should remain.

Current behavior:

```text
points = max(currentRankFloor, points + delta)
```

Promotion raises the player's permanent floor to the new rank threshold.

This keeps lifetime ranks feeling like progression instead of a volatile leaderboard.

## Data Model

The bot uses `rdb2.sql` through `src/modules/riichidb/sql_db2.ts`.

Current tables:

- `SeasonTable`
- `GameTable`
- `ParticipantTable`
- `ConfigTable`

Relevant fields:

- `GameTable.game_id`
- `GameTable.season_id`
- `GameTable.date`
- `ParticipantTable.player_id`
- `ParticipantTable.raw_score`
- `ParticipantTable.adj_score`
- `ParticipantTable.placement`

The current implementation recomputes lifetime progression from historical rows instead of storing a derived lifetime table.

This is acceptable while the formula is still being tuned. If the database grows or the formula becomes stable, a cached/materialized table can be added later.

## Scrubbing Cheaters

If a player needs to be scrubbed from historical results, prefer replacing their `ParticipantTable.player_id` with a reserved fake numeric ID instead of deleting games.

Recommended approach:

- Use an admin-only script or command like `scrub_player oldDiscordId newScrubId`.
- Update only `ParticipantTable.player_id`.
- Keep games, raw scores, adjusted scores, placements, and seasons intact.
- Refuse to scrub into an ID that already exists unless explicitly forced.
- Keep an audit record with old ID, scrub ID, reason, and date.

This preserves everyone else's game history and still separates the scrubbed player from their real Discord identity.

## Open Decisions

- Whether to replace the current implemented formula with the proposed `30/10/-10/-30 + 0.5 * rank difference` formula.
- Whether difficulty should apply to every placement, as proposed, or only to losses.
- Whether lifetime should ignore adjusted score entirely under the proposed formula.
- Whether rank thresholds need retuning after the formula changes.
- Whether scrubbed/fake player IDs need special display names in profile and leaderboard output.
- Whether formula changes should remain retroactive while testing, or become locked once published.
- Discord roles are intentionally out of scope for now.

## Risks And Gotchas

- Recomputing lifetime from historical games means formula changes update everyone's rank retroactively.
- Permanent floors depend on chronological order. Ordering by date plus game id should stay deterministic.
- Deleting or editing old games can change current lifetime points/ranks.
- The profile should keep distinguishing lifetime rank from adjusted-score leaderboard rank.
- Fake scrub IDs may render as broken Discord mentions unless display formatting handles them.
- Old `riichiElo` prototype files use an older schema and should not be copied directly into the bot.

