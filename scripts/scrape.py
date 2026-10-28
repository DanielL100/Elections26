#!/usr/bin/env python3
"""Scrape national results from https://votes26.bechirot.gov.il -> data/data.json

Usage:
  python scripts/scrape.py                 # live (plain HTTP, falls back to headless browser on WAF challenge)
  python scripts/scrape.py page.html       # parse a saved page (testing)
  USE_BROWSER=1 python scripts/scrape.py   # force headless browser
"""
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "data.json"
DEBUG_PATH = ROOT / "data" / "debug.html"
META_PATH = ROOT / "data" / "debug-meta.json"

ELECTION_URL = os.environ.get("ELECTION_URL", "https://votes26.bechirot.gov.il").rstrip("/")
URLS = [ELECTION_URL + "/", ELECTION_URL + "/nationalresults?lang=he"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1",
}

WAF_RE = re.compile(r"AwsWafIntegration|awsWafCookieDomainList|token\.awswaf\.com")


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def to_int(s):
    digits = re.sub(r"\D", "", s or "")
    return int(digits) if digits else 0


def is_waf(html):
    return bool(WAF_RE.search(html))


def parse(html):
    soup = BeautifulSoup(html, "lxml")

    # 1. Timestamp: <div class="fs-h3-title">תוצאות נכון ל- 28/10/2026 05:13</div>
    last_update = ""
    for el in soup.select(".fs-h3-title"):
        t = clean(el.get_text())
        if "נכון ל" in t:
            last_update = t
            break
    if not last_update and "ממתינים לספירת הקולות" in html:
        last_update = "ממתינים לספירת הקולות"

    # 2. Summary boxes: .info-box > div > [label div][.fw-bold value div]
    summary = {}
    for box in soup.select("#ContentPlaceHolder1_ShowTotal1_TotalTags .info-box"):
        value_el = box.select_one(".fw-bold")
        label_el = value_el.find_previous_sibling() if value_el else None
        if not value_el or not label_el:
            continue
        label, raw = clean(label_el.get_text()), clean(value_el.get_text())
        if "בעלי זכות" in label:
            summary["eligibleVoters"] = to_int(raw)
        elif label.startswith("קולות כשרים"):
            summary["acceptedVotes"] = to_int(raw)
        elif label.startswith("קולות פסולים"):
            summary["invalidVotes"] = to_int(raw)
        elif label.startswith("קלפיות"):
            summary["ballotsCounted"] = to_int(raw)
        elif "שיעור הצבעה" in label:
            summary["turnout"] = raw
        elif label.startswith("קולות") or "מספר מצביעים" in label:
            summary["totalVotes"] = to_int(raw)

    # 3. Parties: header-driven so an extra column (e.g. מנדטים) will not shift anything
    parties = []
    table = soup.select_one("#tableDiv table")
    if table:
        heads = [clean(th.get_text()) for th in table.select("thead th")]

        def idx(s):
            return next((i for i, h in enumerate(heads) if s in h), -1)

        col = {
            "name": idx("שם הרשימה"),
            "char": idx("אותיות"),
            "seats": idx("מנדטים"),
            "percent": idx("אחוז"),
            "votes": idx("קולות כשרים"),
        }
        for row in table.select("tbody tr"):
            tds = row.find_all("td", recursive=False)
            if len(tds) < len(heads) or col["name"] < 0:
                continue
            name_cell = tds[col["name"]]
            name = clean(name_cell.get("title") or name_cell.get_text())
            char = clean(tds[col["char"]].get_text())
            votes_cell = tds[col["votes"]]
            votes_el = votes_cell.select_one("span.flex-fill") or votes_cell
            party = {
                "name": name,
                "char": char,
                "votes": to_int(votes_el.get_text()),
                "percent": clean(tds[col["percent"]].get_text()),
            }
            if col["seats"] >= 0:
                party["seats"] = to_int(tds[col["seats"]].get_text())
            if name and char:
                parties.append(party)

    return last_update, summary, parties


def save_debug(url, status, headers, html):
    DEBUG_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEBUG_PATH.write_text(html or "", encoding="utf-8")
    META_PATH.write_text(
        json.dumps({"url": url, "status": status, "bodyLength": len(html or ""), "headers": dict(headers)},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def fetch_with_browser(url):
    """Real headless Chromium: runs the WAF challenge JS like any browser."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(locale="he-IL")
            page.goto(url, wait_until="networkidle", timeout=60000)
            try:
                # the challenge page gets a token, then reloads itself into the real page
                page.wait_for_function(
                    "() => document.querySelector('#tableDiv table') || "
                    "/ממתינים לספירת הקולות/.test(document.body.innerText)",
                    timeout=45000,
                )
            except Exception:
                pass
            return page.content()
        finally:
            browser.close()


def load_html():
    if len(sys.argv) > 1:
        return "file:" + sys.argv[1], Path(sys.argv[1]).read_text(encoding="utf-8")

    force_browser = os.environ.get("USE_BROWSER") == "1"
    for url in URLS:
        for attempt in range(1, 4):
            try:
                print(f"Fetching {url} (attempt {attempt})")
                status, headers = "browser", {}
                if force_browser:
                    html = fetch_with_browser(url)
                else:
                    r = requests.get(url, headers=HEADERS, timeout=30)
                    status, headers, html = r.status_code, r.headers, r.text
                print(f"  status={status} bodyLength={len(html)} "
                      f"server={headers.get('server', '-') if headers else '-'}")
                print(f"  start: {clean(html)[:200] or '(EMPTY BODY)'}")

                if 'id="tableDiv"' in html:
                    return url, html

                if is_waf(html) and not force_browser:
                    print("  AWS WAF JS challenge detected; retrying in headless browser (Playwright)...")
                    try:
                        bhtml = fetch_with_browser(url)
                        print(f"  browser bodyLength={len(bhtml)} challengeStillShown={is_waf(bhtml)}")
                        if 'id="tableDiv"' in bhtml:
                            return url, bhtml
                        save_debug(url, "browser", {}, bhtml)
                    except Exception as e:  # noqa: BLE001
                        print(f"  browser fallback failed: {e}")
                    break  # do not hammer a challenge page

                save_debug(url, status, headers, html)
                if html:
                    break  # real page without a table: counting not started
                time.sleep(2 * attempt)
            except Exception as e:  # noqa: BLE001
                print(f"  failed: {e}")
                time.sleep(2 * attempt)
    return None, None


def main():
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    url, html = load_html()
    if not html:
        print("No usable page; keeping existing data.json.")
        if not DATA_PATH.exists():
            DATA_PATH.write_text(json.dumps(
                {"url": URLS[0], "lastUpdate": "ממתינים לספירת הקולות", "acceptedVotes": 0, "parties": []},
                ensure_ascii=False, indent=2), encoding="utf-8")
        return

    last_update, summary, parties = parse(html)
    if not parties:
        print("Table found but 0 parties parsed; keeping existing data.json.")
        DEBUG_PATH.write_text(html, encoding="utf-8")
        return

    party_sum = sum(p["votes"] for p in parties)
    accepted = summary.get("acceptedVotes") or party_sum
    if summary.get("acceptedVotes") and abs(party_sum - summary["acceptedVotes"]) / summary["acceptedVotes"] > 0.005:
        print(f"Sanity check: party votes sum {party_sum} vs accepted {summary['acceptedVotes']}")

    now = datetime.now(ZoneInfo("Asia/Jerusalem")).strftime("%d/%m/%Y, %H:%M")
    out = {
        "url": url,
        "lastUpdate": last_update or f"עדכון - {now}",
        "acceptedVotes": accepted,
        **{k: v for k, v in summary.items() if k != "acceptedVotes"},
        "parties": parties,
    }
    DATA_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote data.json: {len(parties)} parties, lastUpdate=\"{out['lastUpdate']}\", accepted={accepted}")


if __name__ == "__main__":
    main()
