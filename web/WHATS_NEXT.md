# What's next

The prototype plays the whole loop — sow, walk, bloom, harvest, spend — on one device. Ordered by
what would add the most, with the smallest step first.

## Next

1. **A native wrapper for background steps.** The web can only count steps while the page is open;
   the whole point of the game is the walk you take with the phone in your pocket. `StepSource`
   already has `claimBanked()` and `useWalkMode` already drip-feeds banked steps through the
   throttle — a Capacitor shell over the OS pedometer (as `aoprisan/click` has) is the missing half.
2. **Health-platform import.** Apple Health / Google Fit as a second step source, so a day's steps
   count even when the app never ran. Same seam.
3. **More of the garden.** Paths, fences, a pond, and pots that hold a plant off-grid — the brief
   calls the garden something you *design*, not just fill. Cells already carry x/y, so decoration
   is another thing a cell can hold.
4. **Seasons and weather.** A cosmetic first pass (light, sky, ground tint by month), then a
   gameplay one: species that only bloom in a season, rain that tends for you.

## Later

5. **Neighbours.** Visit another garden, gift a seed, see what bloomed. The `GameClient` seam is
   where a server plugs in; nothing in the UI assumes a single player.
6. **Photo mode.** Spin the plot, hide the HUD, export a picture — the collection is the point, and
   it should be shareable.
7. **Richer sprites.** The procedural draw is deliberately data-only (a CSV row is a plant), but
   per-family silhouettes — grasses, shrubs, climbers on a trellis — would go a long way.
8. **Achievements against the almanac.** "Every common species", "a full bed of one family",
   "10,000 steps in a day" — the counters already exist on the gardener.

## Known limits

- Steps stop when the screen locks (a browser limit, not a bug) — see #1.
- The plot is a fixed grid; there is no expansion to earn yet.
- Everything is local to one browser: clearing site data starts the garden over.
