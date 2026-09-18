import os
import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS for local testing and Vercel execution
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUNNAH_API_KEY = os.getenv("SUNNAH_API_KEY", "")
BASE_URL = "https://api.sunnah.com/v1"

HEADERS = {
    "x-api-key": SUNNAH_API_KEY
}

@app.get("/api/collections")
def get_collections():
    """Fetch list of available Hadith collections"""
    if not SUNNAH_API_KEY:
        # Fallback dummy data if API Key isn't configured yet
        return [
            {"name": "bukhari", "title": "Sahih al-Bukhari"},
            {"name": "muslim", "title": "Sahih Muslim"},
            {"name": "abudawud", "title": "Sunan Abi Dawud"},
            {"name": "tirmidhi", "title": "Jami' at-Tirmidhi"},
            {"name": "nasai", "title": "Sunan an-Nasa'i"},
            {"name": "ibnmajah", "title": "Sunan Ibn Majah"}
        ]
    
    response = requests.get(f"{BASE_URL}/collections", headers=HEADERS)
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch collections")
    return response.json()

@app.get("/api/hadiths")
def get_hadiths(collection: str = "bukhari", page: int = 1, limit: int = 20):
    """Fetch hadiths for a given collection"""
    url = f"{BASE_URL}/collections/{collection}/hadiths?page={page}&limit={limit}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="Hadiths not found")
    return response.json()

@app.get("/api/search")
def search_hadith(q: str = Query(...)):
    """Search hadiths across collections"""
    url = f"{BASE_URL}/search?q={q}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Search failed")
    return response.json()