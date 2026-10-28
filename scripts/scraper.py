import asyncio
import csv
import re
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

TARGET_URL = "https://votes26.bechirot.gov.il/"

async def scrape_election_data():
    async with async_playwright() as p:
        # Launch browser with arguments that help evade bot detection
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ]
        )
        
        # Configure context with real browser user-agent and desktop viewport
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900},
            locale="he-IL"
        )
        
        page = await context.new_page()
        
        # Apply stealth signatures
        await stealth_async(page)

        print(f"Navigating to {TARGET_URL}...")
        try:
            # Navigate and wait for DOM network idle to ensure WAF challenge passes
            await page.goto(TARGET_URL, wait_until="networkidle", timeout=60000)
            
            # Wait for table element to render
            await page.wait_for_selector("table.xx", timeout=30000)
            print("Page loaded successfully.")
            
            content = await page.content()
        except Exception as e:
            print(f"Error fetching page: {e}")
            await browser.close()
            return

        await browser.close()

    # Parse HTML using BeautifulSoup
    soup = BeautifulSoup(content, 'html.parser')
    
    # 1. Extract Summary Metrics
    summary_data = {}
    boxes = soup.select(".icn-boxes-data .container-box")
    for box in boxes:
        label = box.select_one("div > div:first-child")
        val = box.select_one("div.fw-bold")
        if label and val:
            summary_data[label.text.strip()] = val.text.strip()
            
    print("Summary Metrics extracted:", summary_data)

    # 2. Extract Party Results Table
    results = []
    rows = soup.select("table.xx tbody tr")
    for row in rows:
        cols = row.find_all("td")
        if len(cols) >= 4:
            party_name = cols[0].text.strip()
            party_letters = cols[1].text.strip()
            vote_pct = cols[2].text.strip()
            
            # Extract clean vote count from fourth column
            vote_count_span = cols[3].select_one("span.flex-fill")
            vote_count = vote_count_span.text.strip() if vote_count_span else cols[3].text.strip()
            
            results.append({
                "party_name": party_name,
                "letters": party_letters,
                "percentage": vote_pct,
                "votes": vote_count
            })

    # Save to CSV
    output_filename = "elections_results.csv"
    with open(output_filename, mode="w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["party_name", "letters", "percentage", "votes"])
        writer.writeheader()
        writer.writerows(results)

    print(f"Successfully scraped {len(results)} party records to {output_filename}")

if __name__ == "__main__":
    asyncio.run(scrape_election_data())
