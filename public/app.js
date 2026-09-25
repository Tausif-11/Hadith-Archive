let currentCollection = '';
let currentChapter = 1;
let currentBookMeta = null;
let allBooksData = [];
let activeSearchQuery = '';
let searchDebounceTimeout = null;

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  
  // Listen to browser Back/Forward navigation
  window.addEventListener("popstate", (e) => {
    if (e.state) {
      restoreState(e.state, false);
    } else {
      navigateToBooks(false);
    }
  });

  navigateToBooks(false);
});

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.setAttribute("data-lucide", theme === "dark" ? "sun" : "moon");
    refreshIcons();
  }
}

function restoreState(state, push = false) {
  if (!state || state.view === "books") {
    navigateToBooks(push);
  } else if (state.view === "chapters" && state.collection) {
    loadChapters(state.collection, push);
  } else if (state.view === "hadiths" && state.collection) {
    loadHadiths(state.collection, state.chapter || 1, push);
  } else if (state.view === "search" && state.query) {
    executeSearch(state.query, push);
  } else {
    navigateToBooks(false);
  }
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigateToBooks(true);
  }
}

function updateBreadcrumbs(crumbs) {
  const bar = document.getElementById("breadcrumb");
  if (!bar) return;
  bar.innerHTML = "";

  const backBtn = document.createElement("button");
  backBtn.className = "btn btn-back";
  backBtn.innerHTML = `<i data-lucide="arrow-left"></i> Back`;
  backBtn.onclick = goBack;
  bar.appendChild(backBtn);

  crumbs.forEach((crumb, index) => {
    const span = document.createElement("span");
    span.className = `crumb ${index === crumbs.length - 1 ? 'active' : ''}`;
    span.innerText = crumb.label;
    if (crumb.action) span.onclick = crumb.action;
    bar.appendChild(span);

    if (index < crumbs.length - 1) {
      const sep = document.createElement("span");
      sep.className = "crumb-separator";
      sep.innerText = " / ";
      bar.appendChild(sep);
    }
  });

  refreshIcons();
}

function showSection(sectionId) {
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("hidden"));
  const target = document.getElementById(sectionId);
  if (target) target.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Collections Main View
async function navigateToBooks(pushHistory = true) {
  activeSearchQuery = '';
  showSection("viewBooks");
  updateBreadcrumbs([{ label: "Collections", action: () => navigateToBooks() }]);

  if (pushHistory) {
    history.pushState({ view: "books" }, "", "/");
  }

  const grid = document.getElementById("booksGrid");

  if (allBooksData.length === 0) {
    grid.innerHTML = "<p>Loading collections...</p>";
    try {
      const res = await fetch("/api/books");
      allBooksData = await res.json();
    } catch (err) {
      grid.innerHTML = `<p style="color:red">Failed to load collections: ${err.message}</p>`;
      return;
    }
  }

  renderBooksGrid(allBooksData);
}

function renderBooksGrid(books) {
  const grid = document.getElementById("booksGrid");
  grid.innerHTML = "";

  const categories = {};
  books.forEach(b => {
    if (!categories[b.category]) categories[b.category] = [];
    categories[b.category].push(b);
  });

  for (const [catName, catBooks] of Object.entries(categories)) {
    const catHeading = document.createElement("h3");
    catHeading.className = "category-title";
    catHeading.innerText = catName;
    grid.appendChild(catHeading);

    const catGrid = document.createElement("div");
    catGrid.className = "books-grid-category";

    catBooks.forEach(book => {
      const card = document.createElement("div");
      card.className = "book-card";
      card.onclick = () => loadChapters(book.id);
      card.innerHTML = `
        <div>
          <div class="book-title">${book.name}</div>
          <div class="book-arabic">${book.arabic}</div>
        </div>
      `;
      catGrid.appendChild(card);
    });

    grid.appendChild(catGrid);
  }
}

// Search Filter Input
function filterBooks() {
  const query = document.getElementById("searchInput").value.trim();
  
  if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);

  if (query.length < 2) {
    if (document.getElementById("viewBooks").classList.contains("hidden")) {
      navigateToBooks();
    } else {
      renderBooksGrid(allBooksData);
    }
    return;
  }

  searchDebounceTimeout = setTimeout(() => {
    executeSearch(query);
  }, 300);
}

async function executeSearch(query, pushHistory = true) {
  if (!query) return;
  activeSearchQuery = query;
  showSection("viewHadiths");

  if (pushHistory) {
    history.pushState({ view: "search", query: query }, "", `?search=${encodeURIComponent(query)}`);
  }
  
  const container = document.getElementById("hadithContainer");
  container.innerHTML = `<p>Searching collections starting from <strong>Sahih al-Bukhari</strong> for "<strong>${query}</strong>"...</p>`;

  document.getElementById("chapterBadge").innerText = "Search";
  document.getElementById("chapterTitleEnglish").innerText = `Results for "${query}"`;
  document.getElementById("chapterTitleArabic").innerText = "";

  updateBreadcrumbs([
    { label: "Collections", action: () => navigateToBooks() },
    { label: `Search: "${query}"`, action: null }
  ]);

  try {
    const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    container.innerHTML = "";

    if (!data.results || data.results.length === 0) {
      container.innerHTML = `<p style="padding: 2rem 0; text-align: center; color: var(--text-secondary);">No Hadiths found matching "<strong>${query}</strong>".</p>`;
      return;
    }

    const countHeader = document.createElement("div");
    countHeader.style.cssText = "margin-bottom: 1.5rem; font-weight: 600; color: var(--text-secondary);";
    countHeader.innerText = `Found ${data.count} result${data.count === 1 ? '' : 's'}`;
    container.appendChild(countHeader);

    data.results.forEach(h => {
      container.appendChild(createHadithCard(h, query));
    });

    refreshIcons();
  } catch (err) {
    container.innerHTML = `<p style="color:red">Search failed: ${err.message}</p>`;
  }
}

async function loadChapters(collectionId, pushHistory = true) {
  if (!collectionId) return;
  currentCollection = collectionId;
  showSection("viewChapters");

  if (pushHistory) {
    history.pushState({ view: "chapters", collection: collectionId }, "", `?book=${collectionId}`);
  }

  const list = document.getElementById("chaptersList");
  list.innerHTML = "<p>Loading chapters...</p>";

  try {
    const res = await fetch(`/api/chapters?collection=${collectionId}`);
    const data = await res.json();
    currentBookMeta = data.bookInfo;

    document.getElementById("chapterBookTitle").innerText = data.bookInfo.name;
    document.getElementById("chapterBookArabic").innerText = data.bookInfo.arabic;

    updateBreadcrumbs([
      { label: "Collections", action: () => navigateToBooks() },
      { label: data.bookInfo.name, action: () => loadChapters(collectionId) }
    ]);

    list.innerHTML = "";
    data.chapters.forEach(ch => {
      const item = document.createElement("div");
      item.className = "chapter-item";
      item.onclick = () => loadHadiths(collectionId, ch.id);
      item.innerHTML = `
        <div>
          <strong>Chapter ${ch.id}:</strong> ${ch.title}
          ${ch.arabic ? `<div style="font-family:var(--font-arabic); color:var(--brand-color); font-size:1.1rem;">${ch.arabic}</div>` : ''}
        </div>
        <span class="chapter-badge">${ch.count || 0} Hadiths</span>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = `<p style="color:red">Failed to load chapters: ${err.message}</p>`;
  }
}

async function loadHadiths(collectionId, chapterId, pushHistory = true) {
  if (!collectionId) return;
  currentCollection = collectionId;
  currentChapter = parseInt(chapterId) || 1;
  showSection("viewHadiths");

  if (pushHistory) {
    history.pushState({ view: "hadiths", collection: collectionId, chapter: currentChapter }, "", `?book=${collectionId}&chapter=${currentChapter}`);
  }

  const container = document.getElementById("hadithContainer");
  container.innerHTML = "<p>Loading hadiths...</p>";

  try {
    const res = await fetch(`/api/hadiths?collection=${collectionId}&chapter=${currentChapter}`);
    const data = await res.json();

    document.getElementById("chapterBadge").innerText = `Chapter ${data.chapterInfo.id}`;
    document.getElementById("chapterTitleEnglish").innerText = data.chapterInfo.title || `Chapter ${data.chapterInfo.id}`;
    document.getElementById("chapterTitleArabic").innerText = data.chapterInfo.arabic || "";

    updateBreadcrumbs([
      { label: "Collections", action: () => navigateToBooks() },
      { label: data.bookInfo.name, action: () => loadChapters(collectionId) },
      { label: `Chapter ${currentChapter}`, action: null }
    ]);

    container.innerHTML = "";
    if (!data.hadiths || data.hadiths.length === 0) {
      container.innerHTML = "<p>No hadiths found in this chapter.</p>";
      return;
    }

    data.hadiths.forEach(h => {
      container.appendChild(createHadithCard(h));
    });

    refreshIcons();
  } catch (err) {
    container.innerHTML = `<p style="color:red">Failed to load hadiths: ${err.message}</p>`;
  }
}

function navigateChapter(delta) {
  if (!currentCollection) return;
  const nextCh = currentChapter + delta;
  if (nextCh >= 1) {
    loadHadiths(currentCollection, nextCh);
  }
}

function highlightText(text, query) {
  if (!query || !text) return text || '';
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, `<mark class="highlight-search">$1</mark>`);
}

function createHadithCard(hadith, searchQuery = '') {
  const card = document.createElement("article");
  card.className = "hadith-card";

  const bookmarks = JSON.parse(localStorage.getItem("hadith_bookmarks") || "[]");
  const isBookmarked = bookmarks.some(b => b.id === hadith.id);

  const engText = highlightText(hadith.englishText, searchQuery);
  const araText = highlightText(hadith.arabicText, searchQuery);

  card.innerHTML = `
    <div class="card-top">
      <div>
        <span class="hadith-tag">${hadith.bookName || 'Hadith'} #${hadith.hadithNumber}</span>
        ${hadith.chapterTitle ? `<span style="margin-left:8px; font-weight:600; color:var(--text-secondary);">${hadith.chapterTitle}</span>` : ''}
      </div>
      <span class="hadith-grade">Grade: ${hadith.grade}</span>
    </div>
    
    <div class="arabic-text">${araText}</div>
    <div class="english-text">${engText}</div>
    
    <div class="reference-box">
      <div><strong>In-book reference:</strong> ${hadith.reference.inBook}</div>
      <div><strong>USC-MSA web reference:</strong> ${hadith.reference.uscMsa}</div>
    </div>

    <div class="card-actions">
      <button class="btn" onclick="copyToClipboard(this)">
        <i data-lucide="copy"></i> Copy
      </button>
      <button class="btn" onclick='toggleBookmark(${JSON.stringify(hadith).replace(/'/g, "&apos;")}, this)'>
        <i data-lucide="bookmark"></i> ${isBookmarked ? 'Bookmarked' : 'Bookmark'}
      </button>
    </div>
  `;
  return card;
}

function toggleBookmark(hadith, btn) {
  let bookmarks = JSON.parse(localStorage.getItem("hadith_bookmarks") || "[]");
  const idx = bookmarks.findIndex(b => b.id === hadith.id);

  if (idx > -1) {
    bookmarks.splice(idx, 1);
    btn.innerHTML = `<i data-lucide="bookmark"></i> Bookmark`;
  } else {
    bookmarks.push(hadith);
    btn.innerHTML = `<i data-lucide="bookmark"></i> Bookmarked`;
  }

  localStorage.setItem("hadith_bookmarks", JSON.stringify(bookmarks));
  refreshIcons();
}

function copyToClipboard(btn) {
  const card = btn.closest(".hadith-card");
  const arabic = card.querySelector(".arabic-text").innerText;
  const english = card.querySelector(".english-text").innerText;
  
  navigator.clipboard.writeText(`${arabic}\n\n${english}\n\n(Retrieved from HadithArchive)`);
  
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<i data-lucide="check"></i> Copied!`;
  refreshIcons();
  setTimeout(() => { btn.innerHTML = originalHTML; refreshIcons(); }, 2000);
}