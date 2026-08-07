document.addEventListener("DOMContentLoaded", () => {
  setupSmoothScroll()
  setFooterYear()
  setupArtGallery()
  initLorenzAttractor()
  setupDemoButtons()
  setupImageFallbacks()
})

function setupSmoothScroll() {
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]')

  navLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault()

      const targetId = link.getAttribute("href")
      const target = document.querySelector(targetId)

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })
      }
    })
  })
}

function setFooterYear() {
  const yearElement = document.getElementById("year")

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear()
  }
}

function setupArtGallery() {
  const gallery = document.getElementById("art-gallery")
  if (!gallery) return

  const extensions = ["jpg", "jpeg", "png", "webp", "svg", "gif"]
  const maxArtworkCount = 60

  for (let index = 7; index <= maxArtworkCount; index++) {
    loadArtwork(index, 0)
  }

  function loadArtwork(index, extensionIndex) {
    if (extensionIndex >= extensions.length) return

    const extension = extensions[extensionIndex]
    const src = `art/art${index}.${extension}`
    const image = new Image()

    image.onload = () => {
      addArtwork(src, index)
    }

    image.onerror = () => {
      loadArtwork(index, extensionIndex + 1)
    }

    image.src = src
  }

  function addArtwork(src, index) {
    const figure = document.createElement("figure")
    const image = document.createElement("img")

    figure.className = "art-card"
    figure.style.order = index
    image.src = src
    image.alt = `Spray paint artwork ${index}`
    image.loading = "lazy"

    figure.appendChild(image)
    gallery.appendChild(figure)
  }
}

function setupDemoButtons() {
  const buttons = document.querySelectorAll("button.demo-btn[data-demo-src]")
  const demoSection = document.getElementById("demo-section")
  const demoTitle = document.getElementById("demo-title")
  const demoFrame = document.getElementById("demo-frame")
  const demoOpenLink = document.getElementById("demo-open-link")

  if (!buttons.length || !demoSection || !demoTitle || !demoFrame || !demoOpenLink) return

  let activeButton = null

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const title = button.dataset.demoTitle || "Project Demo"
      const src = button.dataset.demoSrc || ""
      const isOpen = demoSection.classList.contains("active")
      const isSameButton = activeButton === button

      if (isOpen && isSameButton) {
        demoSection.classList.remove("active")
        demoFrame.src = ""
        demoOpenLink.href = "#"
        button.textContent = button.dataset.originalText || "View Demo"
        activeButton = null
        return
      }

      buttons.forEach(btn => {
        btn.textContent = btn.dataset.originalText || "View Demo"
      })

      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent
      }

      demoTitle.textContent = title
      demoFrame.src = src
      demoOpenLink.href = src
      demoSection.classList.add("active")
      button.textContent = "Hide Demo"
      activeButton = button

      setTimeout(() => {
        demoSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })
      }, 220)
    })
  })
}

function setupImageFallbacks() {
  const projectImages = document.querySelectorAll(".project-image")

  projectImages.forEach(image => {
    image.addEventListener("error", () => {
      const frame = image.closest(".project-image-frame")
      if (!frame) return

      frame.classList.add("missing-image")
      image.style.display = "none"

      if (!frame.querySelector(".missing-image-label")) {
        const label = document.createElement("div")
        label.className = "missing-image-label"
        label.textContent = "Drop image1.png into this project folder"
        frame.appendChild(label)
      }
    })
  })
}

function initLorenzAttractor() {
  const canvas = document.getElementById("chaos-bg")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  let width
  let height
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  function resize() {
    const hero = document.getElementById("hero")
    if (!hero) return

    width = hero.offsetWidth
    height = hero.offsetHeight

    canvas.width = width * dpr
    canvas.height = height * dpr

    canvas.style.width = width + "px"
    canvas.style.height = height + "px"

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resize()
  window.addEventListener("resize", resize)

  const sigma = 10
  const rho = 28
  const beta = 8 / 3
  const dt = 0.0048
  let scale = 15

  const state1 = { x: 0.1, y: 0, z: 0 }
  const state2 = { x: 0.1001, y: 0, z: 0 }
  const state3 = { x: 0.098, y: 0, z: 0 }

  let angle = 0

  function stepLorenz(state) {
    const dx = sigma * (state.y - state.x)
    const dy = state.x * (rho - state.z) - state.y
    const dz = state.x * state.y - beta * state.z

    state.x += dx * dt
    state.y += dy * dt
    state.z += dz * dt
  }

  function project(px, py, pz) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const rx = px * cos - py * sin
    const rz = px * sin + py * cos
    const heroAnchorX = width < 760 ? width * 0.64 : width * 0.74
    const heroAnchorY = width < 760 ? height * 0.34 : height * 0.25
    scale = width < 760 ? 10.5 : 17.5

    return {
      x: heroAnchorX + rx * scale,
      y: heroAnchorY + pz * scale * 0.9 + rz * 0.1
    }
  }

  function drawPoint(px, py, radius, color) {
    const glow = ctx.createRadialGradient(px, py, 0, px, py, radius)

    glow.addColorStop(0, color)
    glow.addColorStop(1, "rgba(0,0,0,0)")

    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  function animate() {
    angle += 0.001

    ctx.fillStyle = "rgba(5,5,7,0.075)"
    ctx.fillRect(0, 0, width, height)

    for (let i = 0; i < 19; i++) {
      stepLorenz(state1)
      stepLorenz(state2)
      stepLorenz(state3)

      const p1 = project(state1.x, state1.y, state1.z)
      const p2 = project(state2.x, state2.y, state2.z)
      const p3 = project(state3.x, state3.y, state3.z)

      drawPoint(p1.x, p1.y, 5.8, "rgba(0,184,169,0.9)")
      drawPoint(p2.x, p2.y, 4.8, "rgba(255,46,166,0.74)")
      drawPoint(p3.x, p3.y, 4.1, "rgba(255,59,48,0.62)")
    }

    requestAnimationFrame(animate)
  }

  animate()
}
