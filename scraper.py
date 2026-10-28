import asyncio
import json
import os
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

URL = "https://votes26.bechirot.gov.il/"
DATA_DIR = "data"
JSON_PATH = os.path.join(DATA_DIR, "data.json")

def sanitize_backup_filename(last_update_str):
    """Replicates backup logic for timestamped JSON files."""
    if "סופיות" in last_update_str:
        return "סופיות.json"
    
    clean_str = last_update_str.replace(":", ".").replace("/", ".")
    if len(clean_str) > 16:
        clean_str = clean_str[-16:]
    return f"{clean_str}.json"

async def scrape():
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Fetch Page with Playwright Stealth (Evades WAF & Cloudflare challenges)
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900},
            locale="he-IL"
        )
        
        page = await context.new_page()

        print(f"Navigating to {URL}...")
        try:
            response = await page.goto(URL, wait_until="networkidle", timeout=60000)
            status_code = response.status if response else 0
            
            if status_code not in [200, 202]:
                print(f"HTTP Status: {status_code}. Expected 200 or 202.")
                await browser.close()
                return

            # Wait for content or tables to fully render in the DOM
            await page.wait_for_selector(".icn-boxes-data, table", timeout=45000)
            html_content = await page.content()
        except Exception as e:
            print(f"Error loading page: {e}")
            await browser.close()
            return

        await browser.close()

    soup = BeautifulSoup(html_content, 'html.parser')

    # 2. Extract LastUpdate string (targeting second .fs-h3-title element)
    last_update = ""
    update_elements = soup.select(".fs-h3-title")
    
    if len(update_elements) >= 2:
        last_update = update_elements[1].get_text(strip=True)
    elif len(update_elements) == 1:
        last_update = update_elements[0].get_text(strip=True)

    print(f"LastUpdate extracted: '{last_update}'")

    # 3. File Update / Timestamp Comparison
    need_to_change = False
    existing_data = {}

    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                existing_data = json.load(f)

            if "lastUpdate" in existing_data:
                print("Last update exists in file.")
                if existing_data["lastUpdate"] != last_update:
                    print("Time changed, backing up previous data...")
                    backup_filename = sanitize_backup_filename(existing_data["lastUpdate"])
                    backup_path = os.path.join(DATA_DIR, backup_filename)
                    
                    with open(backup_path, "w", encoding="utf-8") as bf:
                        json.dump(existing_data, bf, ensure_ascii=False, indent=4)
                    
                    need_to_change = True
                else:
                    print("Time was not changed. Skipping rewrite.")
            else:
                print("Last update does not exist.")
                need_to_change = True
        except Exception as e:
            print(f"Error reading existing data file: {e}")
            need_to_change = True
    else:
        print("Creating new data file...")
        need_to_change = True

    if not need_to_change:
        return

    # 4. Parse General Summary Section (div.row.icn-boxes-data)
    general = {}
    general_is_empty = True

    general_container = soup.select_one("div.row.icn-boxes-data")
    if general_container:
        boxes = general_container.select(".container-box")
        for box in boxes:
            label_el = box.select_one(".info-box > div > div:nth-child(1)")
            val_el = box.select_one(".info-box > div > .fs-2")
            if label_el and val_el:
                label = label_el.get_text(strip=True)
                val = val_el.get_text(strip=True)
                general[label] = val
                if val and val != "0":
                    general_is_empty = False

    # 5. Parse Parties Table into Array of Objects (table.xx)
    parties = []

    table = soup.select_one("table.xx")
    if table:
        rows = table.select("tbody tr")
        for row in rows:
            tds = row.find_all("td")
            if len(tds) < 4:
                continue

            party_name = tds[0].get_text(strip=True)
            party_char = tds[1].get_text(strip=True)
            percent = tds[2].get_text(strip=True)
            
            votes_span = tds[3].select_one("span.flex-fill")
            votes = votes_span.get_text(strip=True) if votes_span else tds[3].get_text(strip=True)
            
            # Remove formatting commas so JavaScript Number() parses cleanly
            clean_votes = votes.replace(",", "").replace(" ", "")

            # Object structure expected by core.js
            parties.append({
                "name": party_name,
                "char": party_char,
                "percent": percent,
                "votes": clean_votes
            })

    print(f"Is general summary empty? {general_is_empty}")

    # 6. Save JSON Output with exact core.js schema
    if not general_is_empty:
        # Extract accepted votes count for seat allocation calculations
        accepted_votes_str = general.get("קולות כשרים עד עתה", "0").replace(",", "").replace(" ", "")

        output_data = {
            "url": URL,
            "lastUpdate": last_update,
            "acceptedVotes": accepted_votes_str,
            "general": general,
            "parties": parties
        }

        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=4)

        print(f"Successfully updated {JSON_PATH} with {len(parties)} party entries.")
    else:
        print("General data section was empty. Skipping JSON write.")

if __name__ == "__main__":
    asyncio.run(scrape())
