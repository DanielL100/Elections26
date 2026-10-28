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
    """Replicates PHP logic for timestamped backup filenames."""
    if "סופיות" in last_update_str:
        return "סופיות.json"
    
    clean_str = last_update_str.replace(":", ".").replace("/", ".")
    if len(clean_str) > 16:
        clean_str = clean_str[-16:]
    return f"{clean_str}.json"

async def scrape():
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Fetch Page with Playwright Stealth
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

            # Wait for either the info boxes container or parties table to render
            await page.wait_for_selector(".icn-boxes-data, table", timeout=45000)
            html_content = await page.content()
        except Exception as e:
            print(f"Error loading page: {e}")
            await browser.close()
            return

        await browser.close()

    soup = BeautifulSoup(html_content, 'html.parser')

    # 2. Extract LastUpdate string
    last_update_el = soup.select_one(".Content .d-flex .fs-h3-title")
    last_update = last_update_el.get_text(strip=True) if last_update_el else ""
    print(f"LastUpdate: '{last_update}'")

    # 3. File Update / Lock check
    need_to_change = False
    existing_data = {}

    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                existing_data = json.load(f)

            if "lastUpdate" in existing_data:
                print("Last update exist")
                if existing_data["lastUpdate"] != last_update:
                    print("Time changed, creating backup...")
                    backup_filename = sanitize_backup_filename(existing_data["lastUpdate"])
                    backup_path = os.path.join(DATA_DIR, backup_filename)
                    
                    with open(backup_path, "w", encoding="utf-8") as bf:
                        json.dump(existing_data, bf, ensure_ascii=False, indent=4)
                    
                    need_to_change = True
                else:
                    print("Time was not changed")
            else:
                print("Last update does not exist")
                need_to_change = True
        except Exception as e:
            print(f"Error reading existing file: {e}")
            need_to_change = True
    else:
        print("Creates File")
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

    # 5. Parse Parties Table (table.xx)
    parties = []
    parties_char = []
    percent_parties = []
    votes_parties = []

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
            
            votes_span = tds[3].select_one("span.text-start")
            votes = votes_span.get_text(strip=True) if votes_span else tds[3].get_text(strip=True)

            parties.append(party_name)
            parties_char.append(party_char)
            percent_parties.append(percent)
            votes_parties.append(votes)

    print(f"general is empty? {general_is_empty}")

    # 6. Save JSON Output (Exact Target Schema)
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

        print(f"Successfully saved to {JSON_PATH}")
    else:
        print("Didn't change since there is no data")

if __name__ == "__main__":
    asyncio.run(scrape())
