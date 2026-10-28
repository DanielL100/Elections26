import asyncio
import json
import os
import re
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from playwright_stealth import Stealth  # <-- Updated import

URL = "https://votes26.bechirot.gov.il/"
DATA_DIR = "data"
JSON_PATH = os.path.join(DATA_DIR, "data.json")

def sanitize_filename(filename):
    """Sanitizes timestamp string for valid OS filename creation."""
    clean_str = filename.replace(":", ".").replace("/", ".")
    if len(clean_str) > 16:
        clean_str = clean_str[-16:]
    return f"{clean_str}.json"

async def scrape():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Wrap the Playwright instance with Stealth 2.x API
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
            # Navigate and wait until network idle (allows Cloudflare JS challenge to complete)
            await page.goto(URL, wait_until="networkidle", timeout=60000)
            
            # Wait for content or table elements to ensure DOM is fully rendered
            await page.wait_for_selector("table", timeout=30000)
            html_content = await page.content()
        except Exception as e:
            print(f"Failed to fetch page or pass challenge: {e}")
            await browser.close()
            return
        
        await browser.close()

    soup = BeautifulSoup(html_content, 'html.parser')

    # Extract LastUpdate text
    last_update_el = soup.select_one(".LastUpdate")
    last_update = last_update_el.get_text(strip=True) if last_update_el else ""

    print(f"Extracted LastUpdate: '{last_update}'")

    # Check existing data to evaluate if an update is needed
    need_to_change = False
    existing_json = {}
    
    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                existing_json = json.load(f)
                
            prev_last_update = existing_json.get("lastUpdate", "")
            if prev_last_update:
                print("Last update exists in file.")
                if prev_last_update != last_update:
                    print("Time changed, backing up old data...")
                    
                    if "סופיות" in prev_last_update:
                        backup_filename = "סופיות.json"
                    else:
                        backup_filename = sanitize_filename(prev_last_update)
                        
                    backup_path = os.path.join(DATA_DIR, backup_filename)
                    with open(backup_path, "w", encoding="utf-8") as bf:
                        json.dump(existing_json, bf, ensure_ascii=False, indent=4)
                        
                    need_to_change = True
                else:
                    print("Time was not changed. Skipping rewrite.")
            else:
                need_to_change = True
        except Exception as e:
            print(f"Error reading existing JSON: {e}")
            need_to_change = True
    else:
        print("Data file does not exist. Creating new file.")
        need_to_change = True

    if not need_to_change:
        return

    # Parse Tables Logic
    tables = soup.find_all("table")
    if not tables:
        print("No tables found on page.")
        return

    general = {}
    parties = []
    parties_char = []
    percent_parties = []
    votes_parties = []
    general_is_empty = True

    # Parse General Info Table (Table 0)
    general_table_rows = tables[0].find_all("tr")
    if len(general_table_rows) >= 2:
        headers = [th.get_text(strip=True) for th in general_table_rows[0].find_all("th")]
        cells = [td.get_text(strip=True) for td in general_table_rows[1].find_all("td")]
        
        for key, val in zip(headers, cells):
            general[key] = val
            if val != "" and val != "0":
                general_is_empty = False

    # Parse Parties Table
    parties_table_idx = 1 if len(tables) > 1 else 0
    if len(tables) > 2 and len(tables[1].find_all("tr")) == 1:
        parties_table_idx = 2

    parties_table_rows = tables[parties_table_idx].find_all("tr")
    for row in parties_table_rows:
        th = row.find("th")
        tds = row.find_all("td")
        
        if th and tds:
            party_name = th.get_text(strip=True)
            for idx, cell in enumerate(tds):
                cell_text = cell.get_text(strip=True)
                if idx == 0:
                    parties.append(party_name)
                    parties_char.append(cell_text)
                elif idx == 1:
                    percent_parties.append(cell_text)
                elif idx == 2:
                    div = cell.find("div")
                    div_text = div.get_text(strip=True) if div else cell_text
                    votes_parties.append(div_text)

    if not general_is_empty:
        output_data = {
            "url": URL,
            "lastUpdate": last_update,
            "general": general,
            "parties": parties,
            "partiesChar": parties_char,
            "precentParties": percent_parties,
            "votesParties": votes_parties
        }

        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=4)
        print(f"Successfully updated {JSON_PATH}")
    else:
        print("General data table was empty. No changes written.")

if __name__ == "__main__":
    asyncio.run(scrape())
