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

The current implementation is a cumulative progression system with a zero-point floor.

Current constants:

```ts
rawScoreDivisor: 1000
basePlacementBonus: [30, 10, -10, -30]
opponentRankDifferenceMultiplier: 0.5
rankParticipationBonus: [10, 5, 0, 0, 0, 0]
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
scoreMovement = (rawScore - seasonTarget + seasonOka) / 1000
delta = scoreMovement + lifetimeUma + difficultyBonus + participationBonus
```

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

Then add a small opponent difficulty adjustment to every placement:

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

Before raw score movement, that Expert's lifetime placement layer would be:

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

Before raw score movement, that Novice's lifetime placement layer would be:

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

Before raw score movement, that Celestial's lifetime placement layer would be:

```text
1st: +25.5
2nd: +5.5
3rd: -14.5
4th: -34.5
```

This difficulty adjustment is zero-sum across the table because every pairwise rank difference cancels out.

Early ranks also receive a participation bonus based on the player's rank before the game:

```text
Novice:    +10
Adept:     +5
Expert+:   +0
```

This intentionally makes lifetime progression slightly positive-sum in early ranks, so active newer players can climb out of Novice and Adept with enough games.

After each game:

```text
points = max(0, points + delta)
```

The rank shown is based on the player's current points. Promotion thresholds are not permanent floors, so players can drop to a lower rank if their points fall below that rank's threshold.

All players in a game use the ranks they had before that game is applied, so one player's promotion does not affect another player's result in the same game.

Stored adjusted score is still tracked for profile stats, but it no longer contributes directly to lifetime points because it already contains the season's uma. Lifetime points reconstruct score movement from raw score, target, and oka, then add lifetime-specific uma.

## Current Tie Handling

Tied placements split the occupied placement slots, similar to how tied uma is split.

Examples:

- Two-way tie for 1st: `(+30 + +10) / 2 = +20`.
- Two-way tie for 2nd: `(+10 + -10) / 2 = 0`.
- Two-way tie for 3rd: `(-10 + -30) / 2 = -20`.
- Three-way tie for 1st: `(+30 + +10 + -10) / 3 = +10`.
- Three-way tie for 2nd: `(+10 + -10 + -30) / 3 = -10`.
- Four-way tie: `(+30 + +10 + -10 + -30) / 4 = 0`.

Then apply each player's own difficulty bonus.

This keeps the base placement system zero-sum even with ties, and the difficulty adjustment remains zero-sum across the table.

## Why This Formula Is Cleaner

The previous formula combined two placement-sensitive systems:

- `adjustedScore / 1000`, where adjusted score already includes season uma.
- A separate lifetime placement bonus of `20/10/0/-30`.

The new formula is easier to explain:

```text
Lifetime ranks use score movement plus +30/+10/-10/-30 lifetime uma, adjusted slightly by opponent rank difficulty, with small early-rank participation bonuses.
```

Benefits:

- It keeps league scoring and lifetime progression separate.
- It avoids using stored adjusted score, which already contains season uma.
- It still rewards bigger wins through raw score movement.
- It makes placement matter more than `15/5/-5/-15`.
- It keeps all base placement points zero-sum.
- It rewards beating stronger tables and softens losses against stronger tables.
- It lets active Novice and Adept players make progress without making higher ranks attendance-based.
- It reduces the special online-style 4th-place punishment.
- It is easier to tune because there are only two main knobs: placement points and difficulty multiplier.

## Previous Formula

The previous implemented formula was:

```text
delta = adjustedScore / 1000 + 20/10/0/-30 placement bonus
```

It also adjusted only the 4th-place penalty by `sum(opponentRank - playerRank) * 5`.

## Point Floor

Points cannot go below zero.

Current behavior:

```text
points = max(0, points + delta)
```

This avoids discouraging negative totals while preventing old lucky streaks from permanently protecting a higher rank threshold.

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

- Whether rank thresholds need retuning after the formula changes.
- Whether scrubbed/fake player IDs need special display names in profile and leaderboard output.
- Whether formula changes should remain retroactive while testing, or become locked once published.
- Discord roles are intentionally out of scope for now.

## Risks And Gotchas

- Recomputing lifetime from historical games means formula changes update everyone's rank retroactively.
- Rank and participation calculations depend on chronological order. Ordering by date plus game id should stay deterministic.
- Deleting or editing old games can change current lifetime points/ranks.
- The profile should keep distinguishing lifetime rank from adjusted-score leaderboard rank.
- Fake scrub IDs may render as broken Discord mentions unless display formatting handles them.
- Old `riichiElo` prototype files use an older schema and should not be copied directly into the bot.
