# OS 158 map-version link incident

## Read-only findings

Production was queried inside a read-only transaction on 2026-09-10.

| Check | Result |
| --- | ---: |
| Service-order plot links | 63 |
| Distinct plot IDs | 63 |
| Active plot links | 33 (1,168.54 ha) |
| Soft-deleted plot links | 30 (1,051.04 ha) |
| Total registered area shown | 2,219.58 ha |
| Active applications | 24 on 23 plots |
| Applications on soft-deleted candidates | 0 |
| Farm links | 1 distinct active farm |

The 30 original plots were created on 2026-09-02. A farm KML update at 2026-09-10
15:26 UTC soft-deleted all 30 and created a new 33-plot map version. The service order
was edited at 15:55 UTC and retained the original links while adding all current plots.

## Root cause

`FormEditServiceOrder` put only the service-order plot version inside each initial farm.
`FormRegisterNewServiceOrder` then deduplicated farms by farm ID, discarding the current
farm version returned by the farms query. Its bulk selection merged current active plot
IDs into the existing selection. It did not remove known historical IDs from that farm.

All three symptoms came from those persisted links:

- planned area summed both map versions;
- the pending report included historical links whose status remained pending;
- strategic maps correctly drew the full set of links supplied by the service order.

The update endpoint did not create farms or plots. KML farm replacement created the new
plot records; service-order editing only created the additional relationships.

## Prevention

- Preserve an untouched service order's linked plot IDs, including historical records.
- Merge farm plot lists by plot ID instead of dropping either map version.
- Replace every known plot version for a farm when selecting its current plots in bulk.
- Normalize repeated relationship IDs at the API boundary.
- Apply set differences to farms, pilots, and plots inside the existing transaction so
  unchanged relationship rows and plot statuses remain intact.
- Use the canonical derived plot status for detail-page filters and pending reports.

Manual plot renaming remains identity-preserving: it changes `plots.name` on the same ID
and sets `name_overridden`, so later KML imports cannot overwrite the corrected name.

## Recovery guardrails

Run a read-only audit:

```sh
npm run service-order:links:audit -- --service-order-number=158 --remove-deleted-links --expected-final-area=1168.54
```

The dry-run projected 33 links and 1,168.54 ha after removing all 30 historical links.
The initially reported 1,109.79 ha was later confirmed to be a sample value, and
1,168.54 ha was explicitly approved as the canonical final area.

The script writes the complete pre-change relationship rows to `artifacts/`. Apply mode
requires `--apply`, `--remove-deleted-links`, `--expected-final-area`, and
`--confirm=OS-158`. It refuses candidates with active applications and an area mismatch.
The captured `restoreRows` are the rollback source for reinserting the exact relationship
IDs, statuses, completion timestamps, overrides, and actors if an approved repair must be
reversed.

## Applied repair

The approved repair was committed on 2026-09-10. The script wrote the pre-change backup
before deletion, removed exactly 30 historical relationships, checked every invariant
inside the transaction, and only then committed.

An independent read-only reconciliation after the commit returned:

| Check | Result |
| --- | ---: |
| Service-order plot links | 33 |
| Distinct plot IDs | 33 |
| Soft-deleted plot links | 0 |
| Registered area | 1,168.54 ha |
| Completed plots | 21 |
| Pending plots | 12 |
| Active applications | 24 on 23 plots (824.97 ha) |
| Applications outside OS plot links | 0 |
| Farm links | 1 distinct farm |
