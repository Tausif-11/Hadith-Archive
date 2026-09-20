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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Unified Book Metadata Registry with Directory Paths & Categories
BOOK_METADATA = {
    # The 9 Books
    "bukhari": {"name": "Sahih al-Bukhari", "arabic": "صحيح البخاري", "folder": "the9books", "file": "bukhari.json", "category": "The 9 Books"},
    "muslim": {"name": "Sahih Muslim", "arabic": "صحيح مسلم", "folder": "the9books", "file": "muslim.json", "category": "The 9 Books"},
    "abudawud": {"name": "Sunan Abi Dawud", "arabic": "سنن أبي داود", "folder": "the9books", "file": "abudawud.json", "category": "The 9 Books"},
    "tirmidhi": {"name": "Jamiʿ at-Tirmidhi", "arabic": "جامع الترمذي", "folder": "the9books", "file": "tirmidhi.json", "category": "The 9 Books"},
    "nasai": {"name": "Sunan an-Nasa'i", "arabic": "سنن النسائي", "folder": "the9books", "file": "nasai.json", "category": "The 9 Books"},
    "ibnmajah": {"name": "Sunan Ibn Majah", "arabic": "سنن ابن ماجه", "folder": "the9books", "file": "ibnmajah.json", "category": "The 9 Books"},
    "malik": {"name": "Muwatta Malik", "arabic": "موطأ مالك", "folder": "the9books", "file": "malik.json", "category": "The 9 Books"},
    "ahmed": {"name": "Musnad Ahmad", "arabic": "مسند أحمد", "folder": "the9books", "file": "ahmed.json", "category": "The 9 Books"},
    "darimi": {"name": "Sunan ad-Darimi", "arabic": "سنن الدارمي", "folder": "the9books", "file": "darimi.json", "category": "The 9 Books"},

    # Other Primary Collections
    "aladab_almufrad": {"name": "Al-Adab Al-Mufrad", "arabic": "الأدب المفرد", "folder": "other_books", "file": "aladab_almufrad.json", "category": "Other Collections"},
    "bulugh_almaram": {"name": "Bulugh al-Maram", "arabic": "بلوغ المرام", "folder": "other_books", "file": "bulugh_almaram.json", "category": "Other Collections"},
    "mishkat_almasabih": {"name": "Mishkat al-Masabih", "arabic": "مشكاة المصابيح", "folder": "other_books", "file": "mishkat_almasabih.json", "category": "Other Collections"},
    "riyad_assalihin": {"name": "Riyad as-Salihin", "arabic": "رياض الصالحين", "folder": "other_books", "file": "riyad_assalihin.json", "category": "Other Collections"},
    "shamail_muhammadiyah": {"name": "Ash-Shama'il Al-Muhammadiyah", "arabic": "الشمائل المحمدية", "folder": "other_books", "file": "shamail_muhammadiyah.json", "category": "Other Collections"},

    # The 40s Collections
    "nawawi40": {"name": "40 Hadith Nawawi", "arabic": "الأربعون النووية", "folder": "theforties", "file": "nawawi40.json", "category": "The 40 Collections"},
    "qudsi40": {"name": "40 Hadith Qudsi", "arabic": "الأربعون القدسية", "folder": "theforties", "file": "qudsi40.json", "category": "The 40 Collections"},
    "shahwaliullah40": {"name": "40 Hadith Shah Waliullah", "arabic": "الأربعون شاه ولي الله", "folder": "theforties", "file": "shahwaliullah40.json", "category": "The 40 Collections"},
}

CACHE: Dict[str, Any] = {}

def get_book_data(collection: str) -> Dict[str, Any]:
    if collection in CACHE:
        return CACHE[collection]

    if collection not in BOOK_METADATA:
        raise HTTPException(status_code=400, detail=f"Invalid collection '{collection}'")

    meta = BOOK_METADATA[collection]
    file_path = os.path.join(BASE_DIR, "..", "db", "bybooks", meta["folder"], meta["file"])
    
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

        # Fallback chapter metadata grouping
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
            "metadata": meta,
            "chapters": chapters_map,
            "hadiths": hadith_list
        }

        CACHE[collection] = parsed_book
        return parsed_book
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing dataset: {str(e)}")


@app.get("/api/books")
def get_books():
    """Returns list of all available books grouped by category."""
    return [
        {
            "id": key,
            "name": meta["name"],
            "arabic": meta["arabic"],
            "category": meta["category"]
        }
        for key, meta in BOOK_METADATA.items()
    ]


@app.get("/api/chapters")
def get_chapters(collection: str = "bukhari"):
    book = get_book_data(collection)
    chapters_list = list(book["chapters"].values())
    chapters_list.sort(key=lambda x: int(x["id"]) if str(x["id"]).isdigit() else x["id"])
    
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
    
    filtered = [
        item for item in book["hadiths"]
        if isinstance(item, dict) and (item.get("chapterId") == chapter or item.get("chapter_id") == chapter)
    ]

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

@app.get("/api/search")
def search_hadiths(query: str, collection: str = "all"):
    """Full-text search across loaded Hadith collections."""
    if not query or len(query.strip()) < 2:
        return {"query": query, "results": []}

    q = query.strip().lower()
    results = []
    
    # Determine which collections to search
    target_collections = [collection] if collection != "all" and collection in BOOK_METADATA else list(BOOK_METADATA.keys())

    for col in target_collections:
        try:
            book = get_book_data(col)
        except Exception:
            continue  # Skip missing or unparseable files

        meta = book["metadata"]
        
        for idx, item in enumerate(book["hadiths"], 1):
            if not isinstance(item, dict):
                continue

            arabic_text = item.get("arabic", "")
            
            eng_text = ""
            eng_data = item.get("english")
            if isinstance(eng_data, dict):
                narrator = eng_data.get("narrator", "")
                text = eng_data.get("text", "")
                eng_text = f"{narrator} {text}".strip()
            elif isinstance(eng_data, str):
                eng_text = eng_data

            # Match query against English text, Arabic text, or Hadith number
            h_id = str(item.get("id") or idx)
            ch_id = item.get("chapterId") or item.get("chapter_id") or 1

            if q in eng_text.lower() or q in arabic_text or q == h_id:
                results.append({
                    "id": f"{col}_{h_id}",
                    "collection": col,
                    "bookName": meta["name"],
                    "hadithNumber": h_id,
                    "chapterId": ch_id,
                    "arabicText": arabic_text,
                    "englishText": eng_text or "Translation unavailable.",
                    "grade": "Sahih" if col in ["bukhari", "muslim"] else "Hasan / Sahih",
                    "reference": {
                        "inBook": f"Book {ch_id}, Hadith {idx}",
                        "uscMsa": f"Vol. {ch_id}, Book {ch_id}, Hadith {h_id}"
                    }
                })

            # Limit total search results to prevent huge paylod sizes
            if len(results) >= 100:
                break
        if len(results) >= 100:
            break

    return {"query": query, "count": len(results), "results": results}