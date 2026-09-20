import json
import os
from typing import Dict, List, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BOOK_METADATA = {
    "bukhari": {"name": "Sahih al-Bukhari", "arabic": "صحيح البخاري", "file": "bukhari.json"},
    "muslim": {"name": "Sahih Muslim", "arabic": "صحيح مسلم", "file": "muslim.json"},
    "abudawud": {"name": "Sunan Abi Dawud", "arabic": "سنن أبي داود", "file": "abudawud.json"},
    "tirmidhi": {"name": "Jamiʿ at-Tirmidhi", "arabic": "جامع الترمذي", "file": "tirmidhi.json"},
    "nasai": {"name": "Sunan an-Nasa'i", "arabic": "سنن النسائي", "file": "nasai.json"},
    "ibnmajah": {"name": "Sunan Ibn Majah", "arabic": "سنن ابن ماجه", "file": "ibnmajah.json"},
    "malik": {"name": "Muwatta Malik", "arabic": "موطأ مالك", "file": "malik.json"},
    "ahmed": {"name": "Musnad Ahmad", "arabic": "مسند أحمد", "file": "ahmed.json"},
    "darimi": {"name": "Sunan ad-Darimi", "arabic": "سنن الدارمي", "file": "darimi.json"},
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, "..", "db", "bybooks", "the9books")

CACHE: Dict[str, Any] = {}

def get_book_data(collection: str) -> Dict[str, Any]:
    if collection in CACHE:
        return CACHE[collection]

    if collection not in BOOK_METADATA:
        raise HTTPException(status_code=400, detail=f"Invalid collection '{collection}'")

    file_path = os.path.join(DB_DIR, BOOK_METADATA[collection]["file"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Dataset file missing at: {file_path}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        hadith_list = []
        chapters_map = {}

        if isinstance(raw_data, list):
            hadith_list = raw_data
        elif isinstance(raw_data, dict):
            if "hadiths" in raw_data:
                hadith_list = raw_data["hadiths"]
            elif "chapters" in raw_data:
                for ch in raw_data["chapters"]:
                    c_id = ch.get("id") or ch.get("chapterId")
                    c_title = ch.get("english") or ch.get("title") or f"Chapter {c_id}"
                    c_arabic = ch.get("arabic") or ""
                    chapters_map[c_id] = {"id": c_id, "title": c_title, "arabic": c_arabic}
                    if "hadiths" in ch:
                        hadith_list.extend(ch["hadiths"])
            else:
                for v in raw_data.values():
                    if isinstance(v, list):
                        hadith_list = v
                        break

        # Group chapter metadata if not explicitly provided
        if not chapters_map:
            for item in hadith_list:
                if isinstance(item, dict):
                    c_id = item.get("chapterId") or item.get("chapter_id") or 1
                    if c_id not in chapters_map:
                        chapters_map[c_id] = {
                            "id": c_id,
                            "title": f"Chapter {c_id}",
                            "arabic": item.get("chapterArabic", "")
                        }

        parsed_book = {
            "metadata": BOOK_METADATA[collection],
            "chapters": chapters_map,
            "hadiths": hadith_list
        }

        CACHE[collection] = parsed_book
        return parsed_book
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing dataset: {str(e)}")


@app.get("/api/books")
def get_books():
    """Returns list of available books with meta info."""
    return [
        {"id": key, "name": meta["name"], "arabic": meta["arabic"]}
        for key, meta in BOOK_METADATA.items()
    ]


@app.get("/api/chapters")
def get_chapters(collection: str = "bukhari"):
    book = get_book_data(collection)
    chapters_list = list(book["chapters"].values())
    chapters_list.sort(key=lambda x: int(x["id"]) if str(x["id"]).isdigit() else x["id"])
    
    # Calculate hadith counts per chapter
    counts = {}
    for item in book["hadiths"]:
        if isinstance(item, dict):
            c_id = item.get("chapterId") or item.get("chapter_id") or 1
            counts[c_id] = counts.get(c_id, 0) + 1

    for ch in chapters_list:
        ch["count"] = counts.get(ch["id"], 0)

    return {
        "collection": collection,
        "bookInfo": book["metadata"],
        "chapters": chapters_list
    }


@app.get("/api/hadiths")
def get_hadiths(collection: str = "bukhari", chapter: int = 1):
    book = get_book_data(collection)
    
    # Filter hadiths for the selected chapter
    filtered = [
        item for item in book["hadiths"]
        if isinstance(item, dict) and (item.get("chapterId") == chapter or item.get("chapter_id") == chapter)
    ]

    # Fallback if no matching chapter ID found
    if not filtered and chapter == 1:
        filtered = book["hadiths"][:50]

    chapter_info = book["chapters"].get(chapter, {"id": chapter, "title": f"Chapter {chapter}", "arabic": ""})

    formatted_hadiths = []
    for idx, item in enumerate(filtered, 1):
        if not isinstance(item, dict):
            continue

        eng_text = ""
        eng_data = item.get("english")
        if isinstance(eng_data, dict):
            narrator = eng_data.get("narrator", "")
            text = eng_data.get("text", "")
            eng_text = f"<b>{narrator}</b> {text}".strip()
        elif isinstance(eng_data, str):
            eng_text = eng_data

        h_id = item.get("id") or idx

        formatted_hadiths.append({
            "id": f"{collection}_{h_id}",
            "hadithNumber": h_id,
            "chapterId": chapter,
            "arabicText": item.get("arabic", ""),
            "englishText": eng_text or "Translation unavailable.",
            "grade": "Sahih" if collection in ["bukhari", "muslim"] else "Hasan / Sahih",
            "reference": {
                "inBook": f"Book {chapter}, Hadith {idx}",
                "uscMsa": f"Vol. {chapter}, Book {chapter}, Hadith {h_id}"
            }
        })

    return {
        "collection": collection,
        "bookInfo": book["metadata"],
        "chapterInfo": chapter_info,
        "count": len(formatted_hadiths),
        "hadiths": formatted_hadiths
    }

PUBLIC_DIR = os.path.join(BASE_DIR, "..", "public")
if os.path.isdir(PUBLIC_DIR):
    app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")