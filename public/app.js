let currentCollection = '';
let currentChapter = 1;
let currentBookMeta = null;

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  navigateToBooks();
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

function updateBreadcrumbs(crumbs) {
  const bar = document.getElementById("breadcrumb");
  bar.innerHTML = "";
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
}

function showSection(sectionId) {
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(sectionId).classList.remove("hidden");
}

// Render Categorized Books View
async function navigateToBooks() {
  showSection("viewBooks");
  updateBreadcrumbs([{ label: "Collections", action: navigateToBooks }]);

  const grid = document.getElementById("booksGrid");
  grid.innerHTML = "<p>Loading collections...</p>";

  try {
    const res = await fetch("/api/books");
    const books = await res.json();
    grid.innerHTML = "";

    // Group books by category
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
  } catch (err) {
    grid.innerHTML = `<p style="color:red">Failed to load collections: ${err.message}</p>`;
  }
}

async function loadChapters(collectionId) {
  currentCollection = collectionId;
  showSection("viewChapters");

  const list = document.getElementById("chaptersList");
  list.innerHTML = "<p>Loading chapters...</p>";

  try {
    const res = await fetch(`/api/chapters?collection=${collectionId}`);
    const data = await res.json();
    currentBookMeta = data.bookInfo;

    document.getElementById("chapterBookTitle").innerText = data.bookInfo.name;
    document.getElementById("chapterBookArabic").innerText = data.bookInfo.arabic;

    updateBreadcrumbs([
      { label: "Collections", action: navigateToBooks },
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
        </div>
        <span class="chapter-badge">${ch.count || 0} Hadiths</span>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = `<p style="color:red">Failed to load chapters: ${err.message}</p>`;
  }
}

async function loadHadiths(collectionId, chapterId) {
  currentCollection = collectionId;
  currentChapter = parseInt(chapterId);
  showSection("viewHadiths");

  const container = document.getElementById("hadithContainer");
  container.innerHTML = "<p>Loading hadiths...</p>";

  try {
    const res = await fetch(`/api/hadiths?collection=${collectionId}&chapter=${chapterId}`);
    const data = await res.json();

    document.getElementById("chapterBadge").innerText = `Chapter ${data.chapterInfo.id}`;
    document.getElementById("chapterTitleEnglish").innerText = data.chapterInfo.title || `Chapter ${data.chapterInfo.id}`;
    document.getElementById("chapterTitleArabic").innerText = data.chapterInfo.arabic || "";

    updateBreadcrumbs([
      { label: "Collections", action: navigateToBooks },
      { label: data.bookInfo.name, action: () => loadChapters(collectionId) },
      { label: `Chapter ${chapterId}`, action: null }
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
  const nextCh = currentChapter + delta;
  if (nextCh >= 1) {
    loadHadiths(currentCollection, nextCh);
  }
}

function createHadithCard(hadith) {
  const card = document.createElement("article");
  card.className = "hadith-card";

  const bookmarks = JSON.parse(localStorage.getItem("hadith_bookmarks") || "[]");
  const isBookmarked = bookmarks.some(b => b.id === hadith.id);

  card.innerHTML = `
    <div class="card-top">
      <span class="hadith-tag">Hadith #${hadith.hadithNumber}</span>
      <span class="hadith-grade">Grade: ${hadith.grade}</span>
    </div>
    
    <div class="arabic-text">${hadith.arabicText}</div>
    <div class="english-text">${hadith.englishText}</div>
    
    <div class="reference-box">
      <div><strong>In-book reference:</strong> ${hadith.reference.inBook}</div>
      <div><strong>USC-MSA web (English) reference:</strong> ${hadith.reference.uscMsa}</div>
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

function toggleFavoritesView() {
  const container = document.getElementById("hadithContainer");
  showSection("viewHadiths");

  updateBreadcrumbs([
    { label: "Collections", action: navigateToBooks },
    { label: "Bookmarks", action: null }
  ]);

  document.getElementById("chapterBadge").innerText = "Saved";
  document.getElementById("chapterTitleEnglish").innerText = "Bookmarked Hadiths";
  document.getElementById("chapterTitleArabic").innerText = "";

  const bookmarks = JSON.parse(localStorage.getItem("hadith_bookmarks") || "[]");
  container.innerHTML = "";

  if (bookmarks.length === 0) {
    container.innerHTML = "<p>No bookmarked hadiths yet.</p>";
    return;
  }

  bookmarks.forEach(h => container.appendChild(createHadithCard(h)));
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