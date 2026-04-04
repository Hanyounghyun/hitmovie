const API_KEY = "e50ade5bfabf657ad07414474fe46c32";
const BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

const statusEl = document.getElementById("status");
const listEl = document.getElementById("movie-list");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  statusEl.hidden = false;
}

async function fetchTopRatedPage(page) {
  const url = new URL(`${BASE}/movie/top_rated`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("page", String(page));
  url.searchParams.set("language", "ko-KR");

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.status_message || `TMDB 요청 실패 (${res.status})`);
  }
  return res.json();
}

async function fetchMovieRevenue(movieId) {
  const url = new URL(`${BASE}/movie/${movieId}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "ko-KR");
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.revenue === "number" && data.revenue > 0 ? data.revenue : 0;
  } catch {
    return 0;
  }
}

async function attachRevenue(movies) {
  setStatus("흥행 수익 정보를 불러오는 중…");
  const revenues = await Promise.all(movies.map((m) => fetchMovieRevenue(m.id)));
  return movies.map((m, i) => ({ ...m, revenue: revenues[i] }));
}

function posterUrl(path) {
  if (!path) {
    return "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><rect fill="%23121a28" width="500" height="750"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%238b95a8" font-family="sans-serif" font-size="18">No image</text></svg>'
    );
  }
  return `${IMG_BASE}${path}`;
}

function formatUsdWhole(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function revenueHtml(movie) {
  if (movie.revenue > 0) {
    return `
      <div class="movie-card__boxoffice">
        <div class="movie-card__revenue">
          <span class="movie-card__revenue-label">전 세계 흥행 수익 (TMDB)</span>
          ${escapeHtml(formatUsdWhole(movie.revenue))}
        </div>
        <p class="movie-card__boxoffice-note">TMDB <code>revenue</code> 필드 기준(USD). 국가·집계 범위는 TMDB 출처에 따릅니다.</p>
      </div>
    `;
  }
  return `
    <div class="movie-card__boxoffice">
      <div class="movie-card__revenue movie-card__revenue--empty">흥행 수익 미등록</div>
    </div>
  `;
}

function renderMovies(movies) {
  listEl.innerHTML = "";
  listEl.hidden = false;
  movies.forEach((movie, index) => {
    const li = document.createElement("li");
    li.className = "movie-card";
    li.innerHTML = `
      <span class="movie-card__rank" aria-label="순위 ${index + 1}">${index + 1}</span>
      <div class="movie-card__poster-wrap">
        <img class="movie-card__poster" src="${posterUrl(movie.poster_path)}" alt="" loading="lazy" width="500" height="750" />
      </div>
      <div class="movie-card__body">
        <h2 class="movie-card__title">${escapeHtml(movie.title)}</h2>
        <div class="movie-card__meta">
          <span class="movie-card__rating">${movie.vote_average?.toFixed(1) ?? "—"}</span>
          <span>${formatDate(movie.release_date)}</span>
        </div>
        ${revenueHtml(movie)}
      </div>
    `;
    const img = li.querySelector(".movie-card__poster");
    img.alt = `${movie.title} 포스터`;
    listEl.appendChild(li);
  });
  statusEl.hidden = true;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "개봉일 미정";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

async function main() {
  try {
    setStatus("영화 목록을 불러오는 중…");
    const [p1, p2] = await Promise.all([fetchTopRatedPage(1), fetchTopRatedPage(2)]);
    const combined = [...(p1.results || []), ...(p2.results || [])].slice(0, 30);
    if (combined.length === 0) {
      setStatus("표시할 영화가 없습니다.", true);
      return;
    }
    const withRevenue = await attachRevenue(combined);
    renderMovies(withRevenue);
  } catch (e) {
    setStatus(e.message || "불러오기에 실패했습니다.", true);
  }
}

main();
