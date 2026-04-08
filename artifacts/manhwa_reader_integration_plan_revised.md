# System Architect Report & Implementation Plan: Manhwa Reader Integration (Revised)

## 0. Codebase Analysis (Current State)
Existing system is a React/Vite + Express/Mongo tracker with strong UI/UX and metadata proxying. It lacks internal reading capability and relies on external redirects.

---
## 1. Key Upgrades (Added)

### 1.1 Global ID + Normalization Layer (NEW - CRITICAL)
Problem: Same manhwa has different slugs across providers.

Solution:
```ts
GlobalManhwa {
  id: string // hash(normalizedTitle)
  titles: string[]
  providers: {
    asura?: string
    comix?: string
    manhuaus?: string
    mgdemon?: string
  }
}
```

Responsibilities:
- unify search results
- enable cross-provider fallback
- prevent duplicate entries

---
### 1.2 Chapter Normalization (NEW)
Problem: inconsistent numbering (175 vs 175.5 vs 174.9)

Solution:
```ts
normalizedChapter = Math.round(chapter * 10) / 10
```

Merge strategy:
```ts
Map<number, Chapter[]>
```

Pick best chapter per number based on provider score.

---
### 1.3 Provider Health Scoring (NEW)
Replace static selection with scoring:

```ts
score =
  + chapterCoverage
  + responseSpeed
  - failureRate
```

Persist scores in cache.

Use for:
- provider selection
- smarter fallback

---
## 2. Updated Architecture

```text
Providers → Aggregator → Normalizer → Cache → API
```

New Layer Added:
- Normalizer (critical for dedupe + mapping)

---
## 3. Backend Enhancements

### 3.1 Caching Strategy (UPDATED)
Use Redis (production requirement)

Cache Keys:
```text
search:{query}
chapters:{globalId}
pages:{provider}:{chapterId}
providerScore:{provider}
```

Benefits:
- avoids re-scraping
- prevents IP bans
- improves latency

---
### 3.2 Cloudflare Strategy (REFINED)

Use Puppeteer ONLY for:
- initial cookie/session extraction

Then:
```ts
axios requests with stored cookies
```

Avoid full-time Puppeteer usage (performance critical)

---
## 4. Aggregation Layer (Updated Logic)

Steps:
1. Query all providers in parallel
2. Normalize titles → generate globalId
3. Merge results into GlobalManhwa
4. Attach provider availability

Output:
```json
{
  "id": "global_hash",
  "title": "Solo Leveling",
  "providersAvailable": ["asura", "comix"]
}
```

---
## 5. Chapter Resolution Flow (Improved)

1. Fetch chapters from all providers
2. Normalize numbers
3. Group by normalized chapter
4. Select best provider per chapter using score

Fallback:
- auto-switch if image fails

---
## 6. Frontend Changes (Refined)

### Reader Behavior
- vertical scroll
- lazy load images
- prefetch next 2–3 pages

### New States
```ts
currentProvider
fallbackProviders[]
readingProgress
```

### UX Rule
Do NOT show missing providers explicitly

Instead:
- show only available providers
- optional hint: "Available on X sources"

---
## 7. API Adjustments

### GET /search
Returns normalized aggregated results

### GET /manhwa/:id/chapters
Returns merged chapters

### GET /chapter/:id/pages
Supports provider switching

---
## 8. Reliability Improvements

- partial results on failure
- provider-level error logging
- cached fallback usage

---
## 9. Final Implementation Order (Updated)

1. Build Normalization Layer
2. Implement AsuraProvider
3. Add Redis caching
4. Add ComixProvider
5. Implement provider scoring
6. Build reader UI
7. Add fallback switching

---
## 10. Summary

System is now:
- provider-agnostic
- resilient to failures
- scalable
- optimized for multi-source aggregation

Key addition:
Normalization + scoring layer (core to stability)

