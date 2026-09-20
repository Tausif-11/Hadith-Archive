import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAW_CDN_BASE = "https://raw.githubusercontent.com/AhmedBaset/hadith-json/v1.2.0/db/by_book/the_9_books"

COLLECTION_MAP = {
    "bukhari": "bukhari.json",
    "muslim": "muslim.json",
    "abudawud": "abudawud.json",
    "tirmidhi": "tirmidhi.json",
    "nasai": "nasai.json",
    "ibnmajah": "ibnmajah.json"
}

# Simple memory cache to prevent fetching full JSON files repeatedly
data_cache = {}

def get_collection_data(collection: str):
    if collection not in COLLECTION_MAP:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection in data_cache:
        return data_cache[collection]
    
    url = f"{RAW_CDN_BASE}/{COLLECTION_MAP[collection]}"
    res = requests.get(url)
    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch dataset")
    
    data = res.json()
    data_cache[collection] = data
    return data

@app.get("/api/hadiths")
def get_hadiths(collection: str = "bukhari", page: int = 1, limit: int = 20):
    raw_data = get_collection_data(collection)
    
    # Calculate pagination slice
    start = (page - 1) * limit
    end = start + limit
    sliced = raw_data[start:end]
    
    formatted_hadiths = []
    for item in sliced:
        formatted_hadiths.append({
            "id": item.get("id"),
            "hadithNumber": item.get("id"),
            "arabicText": item.get("arabic", ""),
            "englishText": f"{item.get('english', {}).get('narrator', '')} {item.get('english', {}).get('text', '')}".strip(),
            "grades": [{"grade": "Sahih" if collection in ["bukhari", "muslim"] else "Hasan/Sahih"}]
        })
        
    return {
        "page": page,
        "limit": limit,
        "total": len(raw_data),
        "hadiths": formatted_hadiths
    }

@app.get("/api/search")
def search_hadith(q: str = Query(...)):
    query = q.lower()
    results = []
    
    # Search across Sahih Bukhari and Sahih Muslim by default
    for col in ["bukhari", "muslim"]:
        dataset = get_collection_data(col)
        for item in dataset:
            eng_text = f"{item.get('english', {}).get('narrator', '')} {item.get('english', {}).get('text', '')}".lower()
            arabic_text = item.get("arabic", "")
            hadith_id = str(item.get("id"))
            
            if query in eng_text or query in arabic_text or query == hadith_id:
                results.append({
                    "id": f"{col}_{item.get('id')}",
                    "hadithNumber": item.get("id"),
                    "arabicText": item.get("arabic", ""),
                    "englishText": f"{item.get('english', {}).get('narrator', '')} {item.get('english', {}).get('text', '')}".strip(),
                    "grades": [{"grade": "Sahih"}]
                })
                if len(results) >= 30: # Limit initial search results
                    break
        if len(results) >= 30:
            break
            
    return {"hadiths": results}