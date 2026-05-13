import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re

LINKS = [
  "https://indiankanoon.org/doc/501198/",
  "https://indiankanoon.org/doc/1152518/",
  "https://indiankanoon.org/doc/1766147/",
  "https://indiankanoon.org/doc/709776/",
  "https://indiankanoon.org/doc/1857950/",
  "https://indiankanoon.org/doc/1830927/",
  "https://indiankanoon.org/doc/1353689/",
  "https://indiankanoon.org/doc/1186368/",
  "https://indiankanoon.org/doc/477313/",
  "https://indiankanoon.org/doc/123456797/",
  "https://indiankanoon.org/doc/108920103/",
  "https://indiankanoon.org/doc/3966225/",
  "https://indiankanoon.org/doc/55966243/",
  "https://indiankanoon.org/doc/146016688/",
  "https://indiankanoon.org/doc/146549632/",
  "https://indiankanoon.org/doc/138264695/",
  "https://indiankanoon.org/doc/133647814/",
  "https://indiankanoon.org/doc/109788266/",
  "https://indiankanoon.org/doc/128108388/",
  "https://indiankanoon.org/doc/34859018/",
  "https://indiankanoon.org/doc/1766147/",
  "https://indiankanoon.org/doc/1031794/",
  "https://indiankanoon.org/doc/709776/",
  "https://indiankanoon.org/doc/91938676/",
  "https://indiankanoon.org/doc/168671544/",
  "https://indiankanoon.org/doc/101264378/",
  "https://indiankanoon.org/doc/125527568/",
  "https://indiankanoon.org/doc/9796957/",
  "https://indiankanoon.org/doc/1513693/",
  "https://indiankanoon.org/doc/299215/",
  "https://indiankanoon.org/doc/102741423/",
  "https://indiankanoon.org/doc/41420472/",
  "https://indiankanoon.org/doc/1288965/",
  "https://indiankanoon.org/doc/186425503/",
  "https://indiankanoon.org/doc/1292543/",
  "https://indiankanoon.org/doc/1775396/",
  "https://indiankanoon.org/doc/154958944/",
  "https://indiankanoon.org/doc/4526047/",
  "https://indiankanoon.org/doc/40715/",
  "https://indiankanoon.org/doc/1235595/",
  "https://indiankanoon.org/doc/168982055/",
  "https://indiankanoon.org/doc/223504/",
  "https://indiankanoon.org/doc/110813550/",
  "https://indiankanoon.org/doc/125596/",
  "https://indiankanoon.org/doc/591481/",
  "https://indiankanoon.org/doc/539407/",
  "https://indiankanoon.org/doc/80997184/",
  "https://indiankanoon.org/doc/1416283/",
  "https://indiankanoon.org/doc/1264252/",
  "https://indiankanoon.org/doc/1069536/",
  "https://indiankanoon.org/doc/1703207/",
  "https://indiankanoon.org/doc/31336209/",
  "https://indiankanoon.org/doc/352854/",
  "https://indiankanoon.org/doc/105430/",
  "https://indiankanoon.org/doc/131202146/",
  "https://indiankanoon.org/doc/57105555/",
  "https://indiankanoon.org/doc/14591172/",
  "https://indiankanoon.org/doc/193411084/",
  "https://indiankanoon.org/doc/1067991/"
]

OUTPUT_FILE = "../data/scraped.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
}

def scrape_case(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"  [FAILED] Status {response.status_code} for {url}")
            return None

        soup = BeautifulSoup(response.content, "html.parser")

        # Extract title
        title_tag = soup.find("h2", class_="doc_title") or soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else "Unknown"

        # Extract full judgment text
        doc_div = soup.find("div", id="judgments") or soup.find("div", class_="judgments")
        if not doc_div:
            # fallback: grab all paragraph text
            paragraphs = soup.find_all("p")
            full_text = "\n\n".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))
        else:
            full_text = doc_div.get_text(separator="\n", strip=True)

        # Clean up whitespace
        full_text = re.sub(r'\n{3,}', '\n\n', full_text).strip()

        doc_number = url.rstrip("/").split("/")[-1]

        return {
            "doc_id": doc_number,
            "url": url,
            "title": title,
            "full_text": full_text
        }

    except Exception as e:
        print(f"  [ERROR] {url}: {e}")
        return None


def main():
    # Load existing progress if any
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            cases = json.load(f)
        scraped_urls = {c["url"] for c in cases}
        print(f"Resuming — {len(cases)} already scraped.")
    else:
        cases = []
        scraped_urls = set()

    # Deduplicate input links
    unique_links = list(dict.fromkeys(LINKS))
    print(f"Total unique links: {len(unique_links)}")

    for i, url in enumerate(unique_links):
        if url in scraped_urls:
            print(f"[{i+1}/{len(unique_links)}] Skipping (already done): {url}")
            continue

        print(f"[{i+1}/{len(unique_links)}] Scraping: {url}")
        case = scrape_case(url)

        if case:
            # Deduplicate by title
            existing_titles = {c["title"] for c in cases}
            if case["title"] in existing_titles:
                print(f"  [DUPLICATE] Skipping — title already exists: {case['title']}")
            else:
                cases.append(case)
                print(f"  [OK] {case['title'][:80]}")
        
        # Save after every case (resume-safe)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(cases, f, ensure_ascii=False, indent=2)

        # Be polite to the server
        time.sleep(2)

    print(f"\nDone. {len(cases)} unique cases saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()