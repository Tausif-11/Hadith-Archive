# Hadith Library

A lightweight web interface for reading and searching Hadith collections with English translations and Arabic text in Indo-Pak Naskh script.

## Setup Instructions

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt

1. Set your environment variable:


      export SUNNAH_API_KEY="your_api_key_here"

2.Run locally:
      uvicorn api.index:app --reload

3.Deploy to Vercel:

      Import the GitHub repository into Vercel.

            Set SUNNAH_API_KEY under Project Settings -> Environment Variables.