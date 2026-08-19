const METHOD_DESCRIPTIONS = {
  cosine: "Find the songs that sound the most similar based on their audio characteristics. This method compares features such as tempo, energy, danceability, acousticness, and more to recommend the closest overall matches.",
  unique: "We first find the songs that are most musically similar, then recommend the one that stands out the most within that group to give you something familiar with a twist.",
  trajectory: "Songs whose musical journey changes most similarly over time. We split each song into 30-second segments, analyze each segment individually, and recommend songs that evolve in the most similar way from beginning to end."
}

const METHOD_VISUALS = {
  cosine: {
    title: "How Audio Similarity Works",
    caption: "Example: the selected song and its recommendations are compared across audio features. Closely matching profiles indicate stronger overall similarity.",
    graphicId: "audio-similarity-graphic"
  },
  unique: {
    title: "Finding a Similar Song That Stands Out",
    caption: "Example: gray points represent all songs, while the 10 equal red points represent the most similar sounding songs. The recommendation is the red song furthest along both uniqueness axes.",
    graphicId: "unique-graphic"
  },
  trajectory: {
    title: "How a Song's Audio Changes Over Time",
    caption: "Example: each point represents a 30-second segment. The connected path shows how one song moves through its audio feature space from a clear starting point to its finish.",
    graphicId: "trajectory-graphic"
  }
}

const FEATURE_COMPARISON_FIELDS = [
  { key: "tempo", label: "Tempo", digits: 1 },
  { key: "popularity", label: "Popularity", digits: 0 },
  { key: "energy", label: "Energy", digits: 3 },
  { key: "danceability", label: "Danceability", digits: 3 },
  { key: "happiness", label: "Happiness", digits: 3 },
  { key: "acousticness", label: "Acousticness", digits: 3 },
  { key: "instrumentalness", label: "Instrumentalness", digits: 3 },
  { key: "liveness", label: "Liveness", digits: 3 },
  { key: "speechiness", label: "Speechiness", digits: 3 },
  { key: "loudness", label: "Loudness", digits: 2 }
]

let songs = []
let recommendations = {}
let selectedSongId = null
let activeMethod = "cosine"
let searchMode = "all"

document.addEventListener("DOMContentLoaded", init)

async function init() {
  bindControls()
  renderMethodVisual()
  try {
    const [songsResponse, recommendationsResponse] = await Promise.all([
      fetch("songs.json?v=audio-2", { cache: "no-store" }),
      fetch("recommendations.json?v=audio-2", { cache: "no-store" })
    ])
    if (!songsResponse.ok || !recommendationsResponse.ok) throw new Error("Could not load one or both JSON files.")
    songs = await songsResponse.json()
    recommendations = await recommendationsResponse.json()
    if (!Array.isArray(songs) || songs.length === 0) throw new Error("songs.json is empty.")
    refreshSongSearch(true)
  } catch (error) {
    console.error(error)
    setStatus("The recommender data could not be loaded. Put songs.json and recommendations.json in this recommender folder.", true)
  }
}

function bindControls() {
  const searchInput = document.getElementById("song-search")
  const songSelect = document.getElementById("song-select")
  const tabs = document.querySelectorAll(".method-tab")
  const searchModeButtons = document.querySelectorAll(".search-mode")

  searchInput.addEventListener("input", () => refreshSongSearch(false))
  songSelect.addEventListener("change", event => {
    if (event.target.value !== "") selectSong(event.target.value)
  })

  searchModeButtons.forEach(button => {
    button.addEventListener("click", () => {
      searchMode = button.dataset.searchMode
      searchModeButtons.forEach(item => item.classList.remove("active"))
      button.classList.add("active")
      searchInput.value = ""
      refreshSongSearch(true)
    })
  })

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return
      activeMethod = tab.dataset.method
      tabs.forEach(item => item.classList.remove("active"))
      tab.classList.add("active")
      renderMethodVisual()
      renderRecommendations()
    })
  })
}

function renderMethodVisual() {
  const visual = METHOD_VISUALS[activeMethod]
  const title = document.getElementById("method-visual-title")
  const caption = document.getElementById("method-visual-caption")
  if (!visual || !title || !caption) return

  title.textContent = visual.title
  caption.textContent = visual.caption

  document.querySelectorAll(".method-graphic").forEach(graphic => {
    graphic.style.display = "none"
  })

  const activeGraphic = document.getElementById(visual.graphicId)
  if (activeGraphic) activeGraphic.style.display = "block"
}

function isUsableNumber(value) {
  if (value === null || value === undefined || value === "") return false
  return Number.isFinite(Number(value))
}

function hasTrajectory(song) {
  return isUsableNumber(song?.trajectory?.traj_score) || isUsableNumber(song?.traj_score)
}

function hasTrajectoryRecommendations(song) {
  const songId = String(song?.id ?? "")
  return hasTrajectory(song) && Array.isArray(recommendations[songId]?.trajectory) && recommendations[songId].trajectory.length > 0
}

function getTrajectoryScore(song) {
  if (isUsableNumber(song?.trajectory?.traj_score)) return Number(song.trajectory.traj_score)
  if (isUsableNumber(song?.traj_score)) return Number(song.traj_score)
  return null
}

function getSearchPool() {
  return searchMode === "trajectory" ? songs.filter(hasTrajectoryRecommendations) : songs
}

function refreshSongSearch(selectFirst) {
  const query = document.getElementById("song-search").value.trim().toLowerCase()
  const pool = getSearchPool()
  const filteredSongs = pool.filter(song => {
    const songName = String(song.song || "").toLowerCase()
    const artistName = String(song.artist || "").toLowerCase()
    return songName.includes(query) || artistName.includes(query)
  })

  populateSongSelect(filteredSongs)
  updateSearchModeNote(pool.length)

  if (filteredSongs.length === 0) {
    setStatus(searchMode === "trajectory" ? "No matching songs with Musical Journey recommendations were found." : "No matching songs found.")
    return
  }

  setStatus(`${filteredSongs.length.toLocaleString()} songs available in this search.`)
  const selectedStillVisible = filteredSongs.some(song => String(song.id) === selectedSongId)
  if (selectFirst || !selectedStillVisible) selectSong(String(filteredSongs[0].id))
}

function updateSearchModeNote(poolSize) {
  const note = document.getElementById("search-mode-note")
  note.textContent = searchMode === "trajectory"
    ? `Showing ${poolSize.toLocaleString()} songs with Musical Journey recommendations available.`
    : `Showing the full catalog of ${songs.length.toLocaleString()} songs. Songs without Musical Journey data display Musical Journey unavailable.`
}

function populateSongSelect(songList) {
  const songSelect = document.getElementById("song-select")
  const currentValue = songSelect.value
  songSelect.innerHTML = ""

  if (songList.length === 0) {
    const option = document.createElement("option")
    option.value = ""
    option.textContent = "No matching songs"
    songSelect.appendChild(option)
    return
  }

  const fragment = document.createDocumentFragment()
  songList.forEach(song => {
    const option = document.createElement("option")
    option.value = String(song.id)
    option.textContent = song.artist ? `${song.song} — ${song.artist}` : song.song
    fragment.appendChild(option)
  })
  songSelect.appendChild(fragment)
  if ([...songSelect.options].some(option => option.value === currentValue)) songSelect.value = currentValue
}

function selectSong(songId) {
  const song = songs.find(item => String(item.id) === String(songId))
  if (!song) return
  selectedSongId = String(song.id)
  const songSelect = document.getElementById("song-select")
  if ([...songSelect.options].some(option => option.value === selectedSongId)) songSelect.value = selectedSongId
  renderSelectedSong(song)
  updateTrajectoryMethod(song)
  renderMethodVisual()
  renderRecommendations()
}

function renderSelectedSong(song) {
  document.getElementById("selected-song").classList.remove("hidden")
  document.getElementById("recommendation-section").classList.remove("hidden")
  document.getElementById("song-comparison").classList.add("hidden")
  document.getElementById("selected-title").textContent = song.song || "Unknown song"
  document.getElementById("selected-artist").textContent = song.artist || "Unknown artist"
  document.getElementById("trajectory-score").textContent = formatNumber(getTrajectoryScore(song), 3)
  document.getElementById("tempo-value").textContent = formatNumber(song.features?.tempo, 1)
  document.getElementById("energy-value").textContent = formatNumber(song.features?.energy, 3)
  document.getElementById("danceability-value").textContent = formatNumber(song.features?.danceability, 3)

  const badge = document.getElementById("trajectory-badge")
  const available = hasTrajectory(song)
  const level = String(song.traj_level || song.trajectory?.traj_level || "unavailable").toLowerCase()
  badge.textContent = available && ["low", "medium", "high"].includes(level)
    ? `${level} journey complexity`
    : available ? "Musical Journey available" : "Musical Journey unavailable"
  badge.className = "trajectory-badge"
  if (available && ["low", "medium", "high"].includes(level)) badge.classList.add(level)
  renderFeatureGrid(song.features || {})
}

function updateTrajectoryMethod(song) {
  const trajectoryTab = document.querySelector('[data-method="trajectory"]')
  const note = document.getElementById("trajectory-method-note")
  const available = hasTrajectoryRecommendations(song)
  trajectoryTab.disabled = !available
  trajectoryTab.setAttribute("aria-disabled", String(!available))

  if (!available) {
    trajectoryTab.title = "Musical Journey recommendations are unavailable for this song"
    note.textContent = 'Musical Journey recommendations are unavailable for this song. Select "Songs with Musical Journey Recommendations" above to browse compatible songs.'
    note.classList.remove("hidden")
    if (activeMethod === "trajectory") {
      activeMethod = "cosine"
      document.querySelectorAll(".method-tab").forEach(item => item.classList.remove("active"))
      document.querySelector('[data-method="cosine"]').classList.add("active")
      renderMethodVisual()
    }
  } else {
    trajectoryTab.title = ""
    note.textContent = ""
    note.classList.add("hidden")
  }
}

function renderFeatureGrid(features) {
  const grid = document.getElementById("feature-grid")
  grid.innerHTML = ""
  Object.entries(features).forEach(([name, value]) => {
    const item = document.createElement("div")
    item.className = "feature-item"
    const label = document.createElement("span")
    label.textContent = name.replaceAll("_", " ")
    const number = document.createElement("strong")
    number.textContent = formatNumber(value, 3)
    item.append(label, number)
    grid.appendChild(item)
  })
}

function renderRecommendations() {
  const list = document.getElementById("recommendation-list")
  document.getElementById("method-description").textContent = METHOD_DESCRIPTIONS[activeMethod]
  const selectedRecommendations = recommendations[selectedSongId]?.[activeMethod] || []
  list.innerHTML = ""

  if (selectedRecommendations.length === 0) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    empty.textContent = activeMethod === "trajectory"
      ? "Musical Journey recommendations are unavailable for this song."
      : "No recommendations are available for this method."
    list.appendChild(empty)
    return
  }

  selectedRecommendations.forEach((recommendation, rank) => {
    const song = songs[recommendation.index]
    if (!song) return
    const card = document.createElement("article")
    card.className = "recommendation-card"
    card.tabIndex = 0
    card.setAttribute("role", "button")
    const textWrap = document.createElement("div")
    const title = document.createElement("h3")
    title.textContent = `${rank + 1}. ${song.song || "Unknown song"}`
    const artist = document.createElement("p")
    artist.textContent = song.artist || "Unknown artist"
    const score = document.createElement("div")
    score.className = "score"
    score.textContent = `Match ${formatNumber(recommendation.score, 3)}`
    textWrap.append(title, artist)
    const meta = document.createElement("div")
    meta.className = "recommendation-meta"
    meta.appendChild(score)
    card.append(textWrap, meta)

    const compareSong = () => {
      renderSongComparison(song, recommendation)
      document.getElementById("selected-song").scrollIntoView({ behavior: "smooth", block: "start" })
    }

    card.addEventListener("click", compareSong)
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        compareSong()
      }
    })
    list.appendChild(card)
  })
}

function renderSongComparison(recommendedSong, recommendation) {
  const selectedSong = songs.find(song => String(song.id) === String(selectedSongId))
  const comparison = document.getElementById("song-comparison")
  if (!selectedSong || !recommendedSong || !comparison) return

  comparison.innerHTML = ""
  comparison.classList.remove("hidden")

  const header = document.createElement("div")
  header.className = "comparison-header"
  const copy = document.createElement("div")
  const eyebrow = document.createElement("p")
  eyebrow.className = "eyebrow"
  eyebrow.textContent = "Feature Compare"
  const title = document.createElement("h3")
  title.textContent = "Selected song vs recommendation"
  copy.append(eyebrow, title)

  header.append(copy)

  const grid = document.createElement("div")
  grid.className = "comparison-grid"
  grid.append(
    createComparisonCard(selectedSong, "Selected Song"),
    createComparisonCard(recommendedSong, "Recommendation", recommendation, true)
  )

  comparison.append(header, grid)
}

function createComparisonCard(song, label, recommendation, selectable = false) {
  const card = document.createElement("article")
  card.className = selectable ? "comparison-card selectable" : "comparison-card"

  if (selectable) {
    card.tabIndex = 0
    card.setAttribute("role", "button")
    card.setAttribute("aria-label", `Select ${song.song || "this recommendation"} as the sample song`)
    card.title = "Select this recommendation as the sample song"
    card.addEventListener("click", () => selectSong(String(song.id)))
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        selectSong(String(song.id))
      }
    })
  }

  const labelEl = document.createElement("span")
  labelEl.className = "comparison-label"
  labelEl.textContent = label

  const title = document.createElement("h4")
  title.textContent = song.song || "Unknown song"

  const artist = document.createElement("p")
  artist.textContent = song.artist || "Unknown artist"

  const list = document.createElement("div")
  list.className = "comparison-features"

  if (recommendation) {
    list.appendChild(createComparisonRow("Match score", formatNumber(recommendation.score, 3), true))
  }

  FEATURE_COMPARISON_FIELDS.forEach(field => {
    list.appendChild(createComparisonRow(field.label, formatNumber(song.features?.[field.key], field.digits)))
  })

  card.append(labelEl, title, artist, list)
  return card
}

function createComparisonRow(label, value, emphasized = false) {
  const row = document.createElement("div")
  row.className = emphasized ? "comparison-feature emphasized" : "comparison-feature"
  const labelEl = document.createElement("span")
  labelEl.textContent = label
  const valueEl = document.createElement("strong")
  valueEl.textContent = value
  row.append(labelEl, valueEl)
  return row
}

function formatNumber(value, digits) {
  if (!isUsableNumber(value)) return "Unavailable"
  return Number(value).toFixed(digits)
}

function setStatus(message, isError = false) {
  const status = document.getElementById("load-status")
  status.textContent = message
  status.style.color = isError ? "#ff9fbd" : ""
}
