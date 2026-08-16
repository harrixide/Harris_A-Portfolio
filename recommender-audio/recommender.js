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

const AUDIO_BASE_URL = String(window.HARRIS_AUDIO_BASE_URL || "").replace(/\/$/, "")
const AUDIO_EXTENSION = String(window.HARRIS_AUDIO_EXTENSION || "mp4").replace(/^\./, "")

let songs = []
let recommendations = {}
let selectedSongId = null
let activeMethod = "cosine"
let searchMode = "all"
let currentAudio = null
let currentAudioButton = null
let currentAudioSong = null
let isSeeking = false
let compareAudios = []

document.addEventListener("DOMContentLoaded", init)

async function init() {
  bindControls()
  renderMethodVisual()
  try {
    const [songsResponse, recommendationsResponse] = await Promise.all([
      fetch("songs.json?v=audio-only-1", { cache: "no-store" }),
      fetch("recommendations.json?v=audio-only-1", { cache: "no-store" })
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
    : `Showing the audio-ready catalog of ${songs.length.toLocaleString()} songs. Every song in this version has a matching audio file ID.`
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
  document.getElementById("selected-title").textContent = song.song || "Unknown song"
  document.getElementById("selected-artist").textContent = song.artist || "Unknown artist"
  renderAudioControl(document.getElementById("selected-audio"), song, "selected")
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
  ensureAudioPlayer()
  updateAudioPlayer()
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
    score.textContent = formatNumber(recommendation.score, 3)
    textWrap.append(title, artist)
    const meta = document.createElement("div")
    meta.className = "recommendation-meta"
    meta.appendChild(score)
    renderAudioControl(meta, song, "card")
    card.append(textWrap, meta)

    const openSong = () => {
      if (searchMode === "trajectory" && !hasTrajectoryRecommendations(song)) {
        searchMode = "all"
        document.querySelectorAll(".search-mode").forEach(item => item.classList.remove("active"))
        document.querySelector('[data-search-mode="all"]').classList.add("active")
        refreshSongSearch(false)
      }
      selectSong(String(song.id))
      document.getElementById("selected-song").scrollIntoView({ behavior: "smooth", block: "start" })
    }

    card.addEventListener("click", openSong)
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        openSong()
      }
    })
    list.appendChild(card)
  })
}

function renderAudioControl(container, song, variant) {
  container.innerHTML = ""
  const button = document.createElement("button")
  button.type = "button"
  button.className = `audio-button ${variant === "selected" ? "audio-button-large" : ""}`

  if (!song?.youtube_id) {
    button.textContent = "No audio ID"
    button.disabled = true
  } else if (!AUDIO_BASE_URL) {
    button.textContent = variant === "selected" ? "Audio storage not connected" : "Connect"
    button.disabled = true
    button.title = "Add your storage URL in recommender-audio/audio-config.js after uploading the audio files."
  } else if (song.has_audio === false) {
    button.textContent = "No audio"
    button.disabled = true
    button.title = "This song does not have a matching audio file in the local download set."
  } else {
    const isCompareButton = variant === "card"
    button.textContent = isCompareButton ? "Compare" : "Play"
    button.setAttribute("aria-label", isCompareButton
      ? `Compare ${song.song || "song"} by ${song.artist || "unknown artist"} with the selected song`
      : `Play ${song.song || "song"} by ${song.artist || "unknown artist"}`)
    button.addEventListener("click", event => {
      event.stopPropagation()
      if (isCompareButton) {
        openCompareDrawer(song)
      } else {
        toggleAudio(song, button)
      }
    })
  }

  container.appendChild(button)
}

function ensureCompareDrawer() {
  if (document.getElementById("compare-drawer")) return

  const backdrop = document.createElement("div")
  backdrop.id = "compare-backdrop"
  backdrop.className = "compare-backdrop hidden"
  backdrop.addEventListener("click", closeCompareDrawer)

  const drawer = document.createElement("aside")
  drawer.id = "compare-drawer"
  drawer.className = "compare-drawer hidden"
  drawer.setAttribute("role", "dialog")
  drawer.setAttribute("aria-modal", "true")
  drawer.setAttribute("aria-labelledby", "compare-title")

  const header = document.createElement("div")
  header.className = "compare-header"
  const copy = document.createElement("div")
  const eyebrow = document.createElement("span")
  eyebrow.textContent = "/ Compare"
  const title = document.createElement("h2")
  title.id = "compare-title"
  title.textContent = "Compare Audio"
  copy.append(eyebrow, title)

  const closeButton = document.createElement("button")
  closeButton.type = "button"
  closeButton.className = "compare-close"
  closeButton.textContent = "Close"
  closeButton.addEventListener("click", closeCompareDrawer)
  header.append(copy, closeButton)

  const grid = document.createElement("div")
  grid.id = "compare-grid"
  grid.className = "compare-grid"

  drawer.append(header, grid)
  document.body.append(backdrop, drawer)

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && drawer.classList.contains("open")) closeCompareDrawer()
  })
}

function openCompareDrawer(recommendationSong) {
  const selectedSong = songs.find(song => String(song.id) === String(selectedSongId))
  if (!selectedSong || !recommendationSong) return

  ensureCompareDrawer()
  stopAudio()
  stopCompareAudios()

  const grid = document.getElementById("compare-grid")
  grid.innerHTML = ""
  grid.append(
    createComparePlayer(selectedSong, "Selected song"),
    createComparePlayer(recommendationSong, "Recommendation")
  )

  document.body.classList.add("compare-open")
  document.getElementById("compare-backdrop").classList.remove("hidden")
  document.getElementById("compare-drawer").classList.remove("hidden")
  requestAnimationFrame(() => {
    document.getElementById("compare-backdrop").classList.add("open")
    document.getElementById("compare-drawer").classList.add("open")
  })
}

function closeCompareDrawer() {
  const backdrop = document.getElementById("compare-backdrop")
  const drawer = document.getElementById("compare-drawer")
  if (!backdrop || !drawer) return

  stopCompareAudios()
  document.body.classList.remove("compare-open")
  backdrop.classList.remove("open")
  drawer.classList.remove("open")
  window.setTimeout(() => {
    if (!drawer.classList.contains("open")) {
      backdrop.classList.add("hidden")
      drawer.classList.add("hidden")
    }
  }, 240)
}

function stopCompareAudios() {
  compareAudios.forEach(audio => {
    audio.pause()
    audio.currentTime = 0
  })
  compareAudios = []
}

function createComparePlayer(song, labelText) {
  const card = document.createElement("section")
  card.className = "compare-card"

  const label = document.createElement("span")
  label.className = "compare-label"
  label.textContent = labelText

  const title = document.createElement("h3")
  title.textContent = song.song || "Unknown song"

  const artist = document.createElement("p")
  artist.textContent = song.artist || "Unknown artist"

  const audio = new Audio(getAudioUrl(song))
  audio.preload = "metadata"
  compareAudios.push(audio)

  let isCompareSeeking = false

  const controls = document.createElement("div")
  controls.className = "compare-controls"

  const rewind = document.createElement("button")
  rewind.type = "button"
  rewind.className = "audio-skip-button"
  rewind.textContent = "-15s"

  const playPause = document.createElement("button")
  playPause.type = "button"
  playPause.className = "audio-skip-button compare-play"
  playPause.textContent = "Play"

  const forward = document.createElement("button")
  forward.type = "button"
  forward.className = "audio-skip-button"
  forward.textContent = "+15s"

  const speed = document.createElement("select")
  speed.className = "audio-speed"
  speed.setAttribute("aria-label", `Playback speed for ${song.song || "this song"}`)
  ;["0.75", "1", "1.25", "1.5", "2"].forEach(value => {
    const option = document.createElement("option")
    option.value = value
    option.textContent = `${value}x`
    if (value === "1") option.selected = true
    speed.appendChild(option)
  })

  controls.append(rewind, playPause, forward, speed)

  const timeline = document.createElement("div")
  timeline.className = "audio-timeline compare-timeline"
  const currentTime = document.createElement("span")
  currentTime.textContent = "0:00"
  const seek = document.createElement("input")
  seek.type = "range"
  seek.min = "0"
  seek.max = "0"
  seek.step = "0.1"
  seek.value = "0"
  seek.setAttribute("aria-label", `Seek through ${song.song || "this song"}`)
  const duration = document.createElement("span")
  duration.textContent = "0:00"
  timeline.append(currentTime, seek, duration)

  const updatePlayer = () => {
    const audioDuration = Number.isFinite(audio.duration) ? audio.duration : 0
    seek.max = String(audioDuration)
    if (!isCompareSeeking) seek.value = String(audio.currentTime || 0)
    if (!isCompareSeeking) currentTime.textContent = formatTime(audio.currentTime || 0)
    duration.textContent = formatTime(audioDuration)
    playPause.textContent = audio.paused ? "Play" : "Pause"
  }

  const skip = seconds => {
    const audioDuration = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + seconds
    audio.currentTime = Math.min(Math.max((audio.currentTime || 0) + seconds, 0), audioDuration)
    updatePlayer()
  }

  playPause.addEventListener("click", () => {
    if (audio.paused) {
      playPause.textContent = "Loading"
      audio.play().catch(() => {
        playPause.textContent = "Play"
      })
    } else {
      audio.pause()
    }
    updatePlayer()
  })
  rewind.addEventListener("click", () => skip(-15))
  forward.addEventListener("click", () => skip(15))
  speed.addEventListener("change", () => {
    audio.playbackRate = Number(speed.value)
  })
  seek.addEventListener("input", () => {
    isCompareSeeking = true
    currentTime.textContent = formatTime(Number(seek.value))
  })
  seek.addEventListener("change", () => {
    if (Number.isFinite(Number(seek.value))) audio.currentTime = Number(seek.value)
    isCompareSeeking = false
    updatePlayer()
  })

  audio.addEventListener("loadedmetadata", updatePlayer)
  audio.addEventListener("timeupdate", updatePlayer)
  audio.addEventListener("play", updatePlayer)
  audio.addEventListener("pause", updatePlayer)
  audio.addEventListener("ended", updatePlayer)
  audio.addEventListener("error", () => {
    playPause.textContent = "Unavailable"
    playPause.disabled = true
  })
  audio.load()

  card.append(label, title, artist, controls, timeline)
  return card
}

function getAudioUrl(song) {
  if (!AUDIO_BASE_URL || !song?.youtube_id) return ""
  return `${AUDIO_BASE_URL}/${encodeURIComponent(song.youtube_id)}.${AUDIO_EXTENSION}`
}

function toggleAudio(song, button) {
  const audioUrl = getAudioUrl(song)
  if (!audioUrl) return

  if (currentAudio && currentAudioButton === button) {
    if (currentAudio.paused) {
      currentAudio.play()
      setAudioButtonState(button, "Pause", true)
      updateAudioPlayer()
    } else {
      currentAudio.pause()
      setAudioButtonState(button, "Play", false)
      updateAudioPlayer()
    }
    return
  }

  stopAudio()
  currentAudio = new Audio(audioUrl)
  currentAudio.preload = "metadata"
  currentAudioButton = button
  currentAudioSong = song
  setAudioButtonState(button, "Loading", true)
  updateAudioPlayer()
  currentAudio.load()

  currentAudio.addEventListener("canplay", () => {
    setAudioButtonState(button, currentAudio.paused ? "Play" : "Pause", !currentAudio.paused)
    updateAudioPlayer()
  }, { once: true })
  currentAudio.addEventListener("loadedmetadata", updateAudioPlayer)
  currentAudio.addEventListener("timeupdate", updateAudioPlayer)
  currentAudio.addEventListener("play", () => {
    if (currentAudioButton) setAudioButtonState(currentAudioButton, "Pause", true)
    updateAudioPlayer()
  })
  currentAudio.addEventListener("pause", () => {
    if (currentAudioButton) setAudioButtonState(currentAudioButton, "Play", false)
    updateAudioPlayer()
  })
  currentAudio.addEventListener("ended", stopAudio)
  currentAudio.addEventListener("error", () => {
    setAudioButtonState(button, "Unavailable", false)
    button.disabled = true
    currentAudio = null
    currentAudioButton = null
    currentAudioSong = null
    updateAudioPlayer()
  })

  currentAudio.play().catch(() => {
    setAudioButtonState(button, "Play", false)
    updateAudioPlayer()
  })
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
  }
  if (currentAudioButton) setAudioButtonState(currentAudioButton, "Play", false)
  currentAudio = null
  currentAudioButton = null
  currentAudioSong = null
  updateAudioPlayer()
}

function setAudioButtonState(button, label, active) {
  button.textContent = label
  button.classList.toggle("playing", active)
}

function ensureAudioPlayer() {
  if (document.getElementById("audio-player")) return

  const selectedSongPanel = document.getElementById("selected-song")
  const player = document.createElement("section")
  player.id = "audio-player"
  player.className = "audio-player hidden"
  player.setAttribute("aria-live", "polite")

  const meta = document.createElement("div")
  meta.className = "audio-player-meta"
  const label = document.createElement("span")
  label.textContent = "Now playing"
  const title = document.createElement("strong")
  title.id = "audio-player-title"
  title.textContent = "Nothing playing"
  meta.append(label, title)

  const controls = document.createElement("div")
  controls.className = "audio-player-controls"

  const rewind = document.createElement("button")
  rewind.type = "button"
  rewind.className = "audio-skip-button"
  rewind.textContent = "-15s"
  rewind.addEventListener("click", () => skipAudio(-15))

  const playPause = document.createElement("button")
  playPause.type = "button"
  playPause.id = "audio-player-toggle"
  playPause.className = "audio-skip-button"
  playPause.textContent = "Pause"
  playPause.addEventListener("click", toggleCurrentAudio)

  const forward = document.createElement("button")
  forward.type = "button"
  forward.className = "audio-skip-button"
  forward.textContent = "+15s"
  forward.addEventListener("click", () => skipAudio(15))

  const speed = document.createElement("select")
  speed.id = "audio-speed"
  speed.className = "audio-speed"
  speed.setAttribute("aria-label", "Playback speed")
  ;["0.75", "1", "1.25", "1.5", "2"].forEach(value => {
    const option = document.createElement("option")
    option.value = value
    option.textContent = `${value}x`
    if (value === "1") option.selected = true
    speed.appendChild(option)
  })
  speed.addEventListener("change", () => {
    if (currentAudio) currentAudio.playbackRate = Number(speed.value)
  })

  controls.append(rewind, playPause, forward, speed)

  const timeline = document.createElement("div")
  timeline.className = "audio-timeline"
  const currentTime = document.createElement("span")
  currentTime.id = "audio-current-time"
  currentTime.textContent = "0:00"
  const seek = document.createElement("input")
  seek.id = "audio-seek"
  seek.type = "range"
  seek.min = "0"
  seek.max = "0"
  seek.step = "0.1"
  seek.value = "0"
  seek.setAttribute("aria-label", "Seek through current song")
  seek.addEventListener("input", () => {
    isSeeking = true
    document.getElementById("audio-current-time").textContent = formatTime(Number(seek.value))
  })
  seek.addEventListener("change", () => {
    if (currentAudio && Number.isFinite(Number(seek.value))) {
      currentAudio.currentTime = Number(seek.value)
    }
    isSeeking = false
    updateAudioPlayer()
  })
  const duration = document.createElement("span")
  duration.id = "audio-duration"
  duration.textContent = "0:00"
  timeline.append(currentTime, seek, duration)

  player.append(meta, controls, timeline)
  selectedSongPanel.appendChild(player)
}

function updateAudioPlayer() {
  const player = document.getElementById("audio-player")
  if (!player) return

  const hasAudio = Boolean(currentAudio && currentAudioSong)
  player.classList.toggle("hidden", !hasAudio)
  if (!hasAudio) return

  document.getElementById("audio-player-title").textContent = currentAudioSong.artist
    ? `${currentAudioSong.song} - ${currentAudioSong.artist}`
    : currentAudioSong.song || "Current song"

  const speed = document.getElementById("audio-speed")
  if (speed && currentAudio) currentAudio.playbackRate = Number(speed.value)

  const toggle = document.getElementById("audio-player-toggle")
  if (toggle) toggle.textContent = currentAudio.paused ? "Play" : "Pause"

  const seek = document.getElementById("audio-seek")
  const currentTime = document.getElementById("audio-current-time")
  const duration = document.getElementById("audio-duration")
  const audioDuration = Number.isFinite(currentAudio.duration) ? currentAudio.duration : 0

  if (seek) {
    seek.max = String(audioDuration)
    if (!isSeeking) seek.value = String(currentAudio.currentTime || 0)
  }
  if (currentTime && !isSeeking) currentTime.textContent = formatTime(currentAudio.currentTime || 0)
  if (duration) duration.textContent = formatTime(audioDuration)
}

function toggleCurrentAudio() {
  if (!currentAudio) return
  if (currentAudio.paused) {
    currentAudio.play()
    if (currentAudioButton) setAudioButtonState(currentAudioButton, "Pause", true)
  } else {
    currentAudio.pause()
    if (currentAudioButton) setAudioButtonState(currentAudioButton, "Play", false)
  }
  updateAudioPlayer()
}

function skipAudio(seconds) {
  if (!currentAudio) return
  const duration = Number.isFinite(currentAudio.duration) ? currentAudio.duration : currentAudio.currentTime + seconds
  currentAudio.currentTime = Math.min(Math.max((currentAudio.currentTime || 0) + seconds, 0), duration)
  updateAudioPlayer()
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0")
  return `${minutes}:${remainingSeconds}`
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
