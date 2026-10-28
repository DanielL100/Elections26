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
    
    # Replicates: substr(str_replace(":", ".", str_replace("/", ".", $data["lastUpdate"])), strlen($data["lastUpdate"]) - 16)
    clean_str = last_update_str.replace(":", ".").replace("/", ".")
    if len(clean_str) > 16:
        clean_str = clean_str[-16:]
    return f"{clean_str}.json"

async def scrape():
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Fetch Page with Playwright Stealth (Cloudflare / WAF Evasion)
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
            
            if status_code != 200:
                print(f"HTTP Status: {status_code}. Expected 200.")
                await browser.close()
                return

            await page.wait_for_selector("table", timeout=30000)
            html_content = await page.content()
        except Exception as e:
            print(f"Error loading page: {e}")
            await browser.close()
            return

        await browser.close()

    soup = BeautifulSoup(html_content, 'html.parser')

    # 2. Extract LastUpdate string
    last_update_el = soup.select_one(".LastUpdate")
    last_update = last_update_el.get_text(strip=True) if last_update_el else ""
    print(f"LastUpdate: '{last_update}'")

    # 3. Check if JSON needs updating (PHP file lock & lastUpdate comparison logic)
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

    # 4. Parse Tables matching your PHP logic
    tables = soup.find_all("table")
    general = {}
    parties = []
    parties_char = []
    percent_parties = []
    votes_parties = []
    general_is_empty = True

    try:
        t1_rows = tables[1].find_all("tr") if len(tables) > 1 else []
        t1_th_count = len(t1_rows[0].find_all("th")) if t1_rows and t1_rows[0].find_all("th") else 0

        if t1_th_count == 5:
            print("Website - ENDED")
            gen_table_idx = 0
            parties_table_idx = 2 if len(t1_rows) == 1 else 1
        else:
            print("Website - STILL RUNNING")
            gen_table_idx = 0
            parties_table_idx = 1

        # Extract General Summary Table
        gen_rows = tables[gen_table_idx].find_all("tr")
        if len(gen_rows) >= 2:
            th_cells = gen_rows[0].find_all("th")
            td_cells = gen_rows[1].find_all("td")
            for idx, th in enumerate(th_cells):
                header_name = th.get_text(strip=True)
                val = td_cells[idx].get_text(strip=True) if idx < len(td_cells) else ""
                general[header_name] = val
                if val != "" and val != "0":
                    general_is_empty = False

        # Extract Parties Table
        parties_rows = tables[parties_table_idx].find_all("tr")
        for row in parties_rows:
            tds = row.find_all("td")
            th = row.find("th")
            if not tds or not th:
                continue

            party_name = th.get_text(strip=True)
            
            for key, cell in enumerate(tds):
                cell_text = cell.get_text(strip=True)
                if key == 0:
                    parties.append(party_name)
                    parties_char.append(cell_text)
                elif key == 1 and t1_th_count != 5:
                    percent_parties.append(cell_text)
                elif key == 2:
                    if t1_th_count == 5:
                        percent_parties.append(cell_text)
                    else:
                        div = cell.find("div")
                        votes_parties.append(div.get_text(strip=True) if div else cell_text)
                elif key == 3 and t1_th_count == 5:
                    div = cell.find("div")
                    votes_parties.append(div.get_text(strip=True) if div else cell_text)

    except Exception as e:
        print(f"NO DATA AVAILABLE: {e}")

    print(f"general is empty? {general_is_empty}")

    # 5. Save JSON Output (Exact PHP Schema)
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
