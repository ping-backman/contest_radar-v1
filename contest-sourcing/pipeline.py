#!/usr/bin/env python3
"""Lean Contest Radar discovery pipeline. Produces review-only CSV; never publishes."""
from __future__ import annotations
import argparse, csv, hashlib, json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse, urljoin

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS

HERE = Path(__file__).resolve().parent
FIELDS = [
    "title","slug","category","summary","prize_value","prize_currency","closing_date","timezone",
    "eligible_countries","minimum_age","entry_url","rules_url","brand","image_url","image_url2","status",
    "candidate_id","source_url","discovered_at_utc","checked_at_utc","source_domain","discovery_query",
    "score","review_status","review_notes","evidence_text","image_source_url","image_rights_notes","run_id"
]
LABELS = {
    "cash_sweepstakes":"Cash & Sweepstakes","technology":"Technology & Digital Lifestyle",
    "travel_experiences":"Travel & Experiences","education_career":"Education & Career",
    "creative_skill":"Creative & Skill-Based","lifestyle":"Lifestyle & Consumer"
}
CATEGORY_TERMS = {
    "cash_sweepstakes":["cash","sweepstakes","giveaway","prize","win"],
    "technology":["tech","laptop","smartphone","computer","electronics","gaming"],
    "travel_experiences":["travel","vacation","holiday","trip","flight","hotel","tickets","concert"],
    "education_career":["scholarship","student","education","college","university","career","fellowship"],
    "creative_skill":["photography","writing","design","art","film","creative","competition"],
    "lifestyle":["home","lifestyle","wellness","beauty","shopping","garden","kitchen"]
}
PRIZE_RE = re.compile(r"(?:US\$|CA\$|USD|CAD|GBP|EUR|\$|£|€)\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:k|K|million|M))?")
DATE_RE = re.compile(r"(?:deadline|closes?|closing date|ends? on|entries close|enter by|must enter by)\D{0,35}([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+20\d{2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2}|20\d{2}-\d{2}-\d{2})", re.I)
ROBOTS = {}
UA = "ContestRadarResearchBot/0.1 (public contest discovery; low-rate; manual review)"

def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def clean(value, limit=1500):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]

def normalize_url(value):
    try:
        p = urlparse((value or "").strip())
        if p.scheme not in ("http","https") or not p.netloc: return ""
        host = p.netloc.lower().removeprefix("www.")
        path = re.sub(r"/{2,}", "/", p.path or "/").rstrip("/") or "/"
        query = "&".join(q for q in p.query.split("&") if q and not q.lower().startswith(("utm_","fbclid=","gclid=")))
        return urlunparse((p.scheme.lower(),host,path,"",query,""))
    except Exception:
        return ""

def slugify(value):
    return re.sub(r"[^a-z0-9]+","-", (value or "").lower()).strip("-")[:100]

def parse_date(value):
    for fmt in ("%Y-%m-%d","%Y-%m-%dT%H:%M:%S%z","%Y-%m-%dT%H:%M:%S","%B %d, %Y","%b %d, %Y","%B %d %Y","%b %d %Y","%m/%d/%Y","%d/%m/%Y","%m-%d-%Y","%d-%m-%Y"):
        try: return datetime.strptime(clean(value,100),fmt).date().isoformat()
        except (ValueError,TypeError,OverflowError): pass
    return ""

def domain(url):
    return urlparse(url).netloc.lower().removeprefix("www.")

def allowed_by_robots(url):
    host = domain(url)
    if host not in ROBOTS:
        from urllib.robotparser import RobotFileParser
        rp = RobotFileParser()
        parts = urlparse(url)
        rp.set_url(f"{parts.scheme}://{parts.netloc}/robots.txt")
        try:
            response = requests.get(rp.url, headers={"User-Agent":UA}, timeout=5)
            rp.parse(response.text.splitlines() if response.status_code < 400 else [])
        except requests.RequestException:
            rp.parse([])
        ROBOTS[host] = rp
    try: return ROBOTS[host].can_fetch(UA,url)
    except Exception: return False

def fetch_page(url):
    if not allowed_by_robots(url): return None, url, "Blocked by robots.txt; skipped"
    try:
        response = requests.get(url,headers={"User-Agent":UA,"Accept":"text/html,application/xhtml+xml"},timeout=12,allow_redirects=True,stream=True)
        if response.status_code >= 400: return None,url,f"HTTP {response.status_code}"
        if "html" not in response.headers.get("content-type","").lower(): return None,url,"Non-HTML page"
        chunks=[]; size=0
        for chunk in response.iter_content(16384):
            size += len(chunk)
            if size > 1500000: break
            chunks.append(chunk)
        soup=BeautifulSoup(b"".join(chunks),"html.parser")
        return soup,normalize_url(response.url) or url,""
    except requests.RequestException as exc:
        return None,url,f"Fetch error: {type(exc).__name__}"

def meta(soup,*names):
    for name in names:
        tag=soup.find("meta",attrs={"property":name}) or soup.find("meta",attrs={"name":name})
        if tag and tag.get("content"): return clean(tag["content"])
    return ""

def extract(result, cat, query, run_id, discovered, cfg):
    raw_url=normalize_url(result.get("href") or result.get("url") or "")
    raw_title=clean(result.get("title"),300)
    snippet=clean(result.get("body") or result.get("snippet") or "")
    if not raw_url or not raw_title: return None
    if any(term in (raw_title+" "+snippet).lower() for term in cfg["excluded_terms"]): return None
    soup,final_url,error=fetch_page(raw_url)
    title=raw_title; summary=snippet; image=""; text=snippet; rules=""; entry=""; eligible=""; age=""; prize=""
    if soup:
        title=meta(soup,"og:title","twitter:title") or (soup.title.get_text(" ",strip=True) if soup.title else "") or raw_title
        summary=meta(soup,"description","og:description","twitter:description") or snippet
        image=meta(soup,"og:image","twitter:image")
        if image: image=urljoin(final_url,image)
        text=clean(soup.get_text(" ",strip=True),5000)
        for anchor in soup.find_all("a",href=True):
            label=clean(anchor.get_text(" ",strip=True),100).lower()
            href=normalize_url(urljoin(final_url,anchor["href"]))
            if not href: continue
            if not rules and any(x in label for x in ("official rules","terms and conditions","terms & conditions","rules and regulations")): rules=href
            if not entry and any(x in label for x in ("enter now","enter here","submit entry","apply now","enter competition")): entry=href
        country_terms={"US":["united states","u.s. residents","us residents","50 states"],"UK":["united kingdom","uk residents","great britain"],"CA":["canada","canadian residents","canada residents"]}
        eligible=",".join(code for code,terms in country_terms.items() if any(term in text.lower() for term in terms))
        age_match=re.search(r"(?:must be|aged?|age of)\s*(?:at least\s*)?(18|19|21)\s*(?:years? old|\+|or older)",text,re.I)
        if age_match: age=age_match.group(1)
        for prize_match in PRIZE_RE.finditer(text):
            context=(text[max(0,prize_match.start()-90):prize_match.start()]+" "+text[prize_match.end():prize_match.end()+90]).lower()
            if any(term in context for term in ("prize","win","awarded","award","scholarship","grand prize")):
                prize=prize_match.group(0); break
    title=clean(title,300); summary=clean(summary)
    body=(title+" "+summary+" "+text).lower()
    date_match=DATE_RE.search(text)
    closing=parse_date(date_match.group(1)) if date_match else ""
    if closing and closing < datetime.now(timezone.utc).date().isoformat(): return None
    score=15
    if any(x in body for x in ("official rules","terms and conditions","sponsored by","organizer")): score+=15
    if any(x in body for x in ("prize","win","award","scholarship","grant")): score+=15
    if prize: score+=10
    if closing: score+=15
    if eligible: score+=10
    if image: score+=5
    if domain(final_url).endswith((".gov",".edu",".ac.uk")): score+=10
    notes=[]
    if error: notes.append(error)
    if not closing: notes.append("Closing date not verified")
    if not eligible: notes.append("Eligible countries not verified")
    if not rules: notes.append("Official rules URL not extracted")
    if not image: notes.append("Image URL not found; verify image rights")
    if not prize: notes.append("Prize details need verification")
    review="pending_review" if closing and eligible and rules and image else "needs_research"
    source=normalize_url(final_url or raw_url)
    candidate_id=hashlib.sha256((source+"|"+title.lower()).encode()).hexdigest()[:12]
    currency=""
    if prize.startswith(("£","GBP")): currency="GBP"
    elif prize.startswith(("€","EUR")): currency="EUR"
    elif prize.startswith(("CA$","CAD")): currency="CAD"
    elif prize.startswith(("US$","USD")): currency="USD"
    return {
      "title":title,"slug":slugify(title),"category":LABELS[cat],"summary":summary,"prize_value":prize,"prize_currency":currency,
      "closing_date":closing,"timezone":"UTC","eligible_countries":eligible,"minimum_age":age,"entry_url":entry,"rules_url":rules,
      "brand":"","image_url":image,"image_url2":"","status":"pending_review","candidate_id":candidate_id,"source_url":source,
      "discovered_at_utc":discovered,"checked_at_utc":now(),"source_domain":domain(source),"discovery_query":query,
      "score":score,"review_status":review,"review_notes":"; ".join(notes),"evidence_text":clean(text,1200),
      "image_source_url":image,"image_rights_notes":"Verify permission and usage terms; public visibility does not imply reuse rights","run_id":run_id
    }

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target",type=int,default=50); parser.add_argument("--countries",default="US,UK,CA")
    parser.add_argument("--categories",default="all"); parser.add_argument("--max-queries",type=int,default=18)
    parser.add_argument("--max-results-per-query",type=int,default=6); parser.add_argument("--min-score",type=int,default=20)
    parser.add_argument("--output-dir",default="output")
    args=parser.parse_args()
    if not 1<=args.target<=100: parser.error("--target must be 1–100")
    if not 1<=args.max_queries<=18: parser.error("--max-queries must be 1–18")
    if not 1<=args.max_results_per_query<=10: parser.error("--max-results-per-query must be 1–10")
    if not 0<=args.min_score<=100: parser.error("--min-score must be 0–100")
    cfg=json.loads((HERE/"sources.json").read_text(encoding="utf-8"))
    cats=list(cfg["categories"]) if args.categories.lower().strip()=="all" else [x.strip() for x in args.categories.split(",") if x.strip()]
    countries=[x.strip().upper() for x in args.countries.split(",") if x.strip()]
    if any(x not in cfg["categories"] for x in cats): parser.error("Unknown category key")
    if any(x not in cfg["countries"] for x in countries): parser.error("Countries must be US, UK, CA")
    queries=[]
    for cat in cats:
        for code in countries:
            seeds=" OR ".join(cfg["categories"][cat])
            queries.append((cat,f'({seeds}) ({cfg["countries"][code]}) open {datetime.now(timezone.utc).year} contest giveaway scholarship official rules deadline'))
    queries=queries[:args.max_queries]
    run_id=datetime.now(timezone.utc).strftime("cr-%Y%m%dT%H%M%SZ"); discovered=now()
    rows=[]; seen_urls=set(); seen_titles=set(); stats=[]
    for index,(cat,query) in enumerate(queries,1):
        print(f"[{index}/{len(queries)}] {query}")
        try:
            with DDGS(timeout=15) as search:
                results=list(search.text(query,max_results=args.max_results_per_query,safesearch="moderate"))
        except Exception as exc:
            print(f"[WARN] Search failed: {type(exc).__name__}",file=sys.stderr); results=[]
        added=0
        for result in results:
            row=extract(result,cat,query,run_id,discovered,cfg)
            if not row or row["score"]<args.min_score: continue
            title_key=re.sub(r"[^a-z0-9]+","",row["title"].lower()); url_key=row["source_url"]
            if not url_key or url_key in seen_urls or title_key in seen_titles: continue
            seen_urls.add(url_key); seen_titles.add(title_key); rows.append(row); added+=1
            if len(rows)>=args.target: break
            time.sleep(0.25)
        stats.append({"query":query,"results_seen":len(results),"candidates_added":added})
        if len(rows)>=args.target: break
        time.sleep(0.5)
    rows.sort(key=lambda row:int(row["score"]),reverse=True)
    output=Path(args.output_dir); output.mkdir(parents=True,exist_ok=True)
    csv_path=output/"contest-radar-staging.csv"; report_path=output/"run-report.json"
    with csv_path.open("w",newline="",encoding="utf-8-sig") as handle:
        writer=csv.DictWriter(handle,fieldnames=FIELDS); writer.writeheader(); writer.writerows(rows)
    report={"version":"0.1.0","run_id":run_id,"started_at_utc":discovered,"finished_at_utc":now(),
      "target_candidates":args.target,"candidates_staged":len(rows),"countries":countries,"categories":cats,
      "queries_attempted":len(stats),"query_stats":stats,
      "review_status_counts":{status:sum(1 for row in rows if row["review_status"]==status) for status in ("pending_review","needs_research")},
      "notes":["Review-only: no record is approved or published.","Verify official organizer/sponsor, entry link, prize, eligibility, deadline and image rights.",
      "CSV master-facing columns are based on the frontend/API contract; compare with the live Sheet header before bulk import."]}
    report_path.write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"run_id":run_id,"target":args.target,"staged":len(rows),"csv":str(csv_path),"report":str(report_path)},indent=2))

if __name__=="__main__": main()
