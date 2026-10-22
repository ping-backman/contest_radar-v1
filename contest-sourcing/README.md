# Contest Radar Sourcing Pipeline v0.1.0

A lean, manually triggered Python discovery prototype. It searches public web results for contest, sweepstakes, scholarship, creative and consumer-opportunity leads; extracts available page metadata; filters obvious duplicates and parsed expired dates; and exports a CSV plus JSON report.

**It never approves or publishes a listing.** All candidates remain review-only. There is no Google Sheets API connection, no server, and no required API key.

## Run from GitHub

1. Open **Actions** in the repository.
2. Select **Contest Radar Sourcing** and click **Run workflow**.
3. Start with target 50, countries US/UK/CA, all categories, 18 queries, 6 results/query and minimum score 20.
4. Download the artifact named `contest-radar-staging-<run-id>`. It contains `contest-radar-staging.csv` and `run-report.json`.

## CSV fields

The export includes the frontend/API concepts currently observed in the repository: title, slug, category, summary, prize value/currency, closing date/timezone, eligible countries, minimum age, entry URL, rules URL, brand, image URL/image URL 2, and status. Research columns preserve source URL, source domain, discovery query, score, evidence text, image provenance, review state, notes, timestamps and run ID.

The exact live Google Sheet header row is not present in this repository. **Before bulk copy/import into the master sheet, compare the first 16 CSV columns with the actual sheet headers and order.** This tool intentionally does not connect to Google Sheets.

## Quality rules and limitations

- Search results are leads, not verification. Confirm each opportunity on the official organizer/sponsor page and read its official rules.
- Missing facts stay blank and the row is marked `needs_research`; the tool does not invent a date, eligibility, prize or entry URL.
- Parsed expired dates are excluded, but date extraction is heuristic and can miss dates or interpret ambiguous numeric dates incorrectly.
- Image URLs are leads, not permission to reuse. Verify rights and terms before publication.
- The crawler checks each host's `robots.txt`, uses a descriptive user agent, limits page size and adds delays. If a page is disallowed or blocked, it is skipped.
- DDGS search can be throttled or change behavior; results may be fewer than the requested target. The tool does not lower screening standards to force a count.
- The first release has no LLM calls and no paid API dependency. AI/search-grounding support should be added only as an explicit opt-in after checking current free limits and billing settings.
- Keep secrets out of source files. Never change `status` to `approved` until a person has verified the candidate.

## Local run

```bash
python -m pip install -r contest-sourcing/requirements.txt
python contest-sourcing/pipeline.py --target 50 --countries US,UK,CA --categories all --max-queries 18 --max-results-per-query 6 --min-score 20 --output-dir output
python -m unittest discover -s contest-sourcing/tests -v
```

Download and archive each CSV before its GitHub Actions artifact expires (30 days by default).
