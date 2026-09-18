let currentCollection = 'bukhari';

document.addEventListener("DOMContentLoaded", () => {
  loadHadiths(currentCollection);
});

function selectCollection(collectionName, element) {
  document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  
  currentCollection = collectionName;
  document.getElementById('currentTitle').innerText = element.innerText;
  loadHadiths(collectionName);
}

async function loadHadiths(collection) {
  const container = document.getElementById("hadithContainer");
  container.innerHTML = "<p>Loading hadiths...</p>";

  try {
    const res = await fetch(`/api/hadiths?collection=${collection}`);
    const data = await res.json();

    container.innerHTML = "";
    if (!data.hadiths || data.hadiths.length === 0) {
      container.innerHTML = "<p>No hadiths found.</p>";
      return;
    }

    data.hadiths.forEach(hadith => {
      container.appendChild(createHadithCard(hadith));
    });
  } catch (err) {
    container.innerHTML = "<p>Failed to load hadiths. Check API configuration.</p>";
  }
}

function createHadithCard(hadith) {
  const card = document.createElement("article");
  card.className = "hadith-card";

  const isBookmarked = getBookmarks().includes(hadith.id || hadith.hadithNumber);

  card.innerHTML = `
    <div class="card-header">
      <span class="hadith-number">Hadith #${hadith.hadithNumber || ''}</span>
      <span class="hadith-grade">${hadith.grades?.[0]?.grade || 'Grading: N/A'}</span>
    </div>
    <div class="arabic-text">${hadith.arabicText || 'النص العربي غير متوفر'}</div>
    <div class="english-text">${hadith.englishText || 'English translation unavailable'}</div>
    <div class="card-actions">
      <button onclick="copyToClipboard('${escapeText(hadith.englishText)}')">📋 Copy</button>
      <button onclick="toggleBookmark('${hadith.id || hadith.hadithNumber}', this)">
        ${isBookmarked ? '⭐ Favorited' : '☆ Favorite'}
      </button>
    </div>
  `;
  return card;
}

async function handleSearch() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const container = document.getElementById("hadithContainer");
  container.innerHTML = "<p>Searching...</p>";

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    container.innerHTML = "";
    if (!data.hadiths || data.hadiths.length === 0) {
      container.innerHTML = "<p>No results found for your search.</p>";
      return;
    }

    data.hadiths.forEach(hadith => {
      container.appendChild(createHadithCard(hadith));
    });
  } catch (err) {
    container.innerHTML = "<p>Search request failed.</p>";
  }
}

function getBookmarks() {
  return JSON.parse(localStorage.getItem("hadith_bookmarks") || "[]");
}

function toggleBookmark(id, btn) {
  let bookmarks = getBookmarks();
  if (bookmarks.includes(id)) {
    bookmarks = bookmarks.filter(bId => bId !== id);
    btn.innerText = "☆ Favorite";
  } else {
    bookmarks.push(id);
    btn.innerText = "⭐ Favorited";
  }
  localStorage.setItem("hadith_bookmarks", JSON.stringify(bookmarks));
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert("Hadith copied to clipboard!");
}

function escapeText(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}