/**
 * THE HELIX RESIDENCES - Cinematic Dusk Flythrough Engine
 * Precision 16:9 Locked Canvas, Natural Smooth Scroll & Interactive Hub
 */

(function () {
  'use strict';

  // --- Configuration ---
  const TOTAL_FRAMES = 300;
  const FRAME_DIR = 'Hero Section img';
  const FRAME_PREFIX = 'ezgif-frame-';
  const FRAME_EXT = '.jpg';
  
  // DOM Elements
  const preloader = document.getElementById('preloader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderStatus = document.getElementById('loader-status');
  
  const header = document.querySelector('.site-header');
  const scrollContainer = document.getElementById('hero-scroll');
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  
  const storyCards = document.querySelectorAll('.story-card');
  const hudScrubber = document.getElementById('hud-scrubber');
  const hudProgress = document.getElementById('hud-progress');
  const hudHandle = document.getElementById('hud-handle');
  const hudCounter = document.getElementById('hud-current-frame');
  const autoTourBtn = document.getElementById('auto-tour-btn');
  const audioBtn = document.getElementById('audio-btn');
  const inquiryForm = document.getElementById('inquiry-form');
  const waypointPills = document.querySelectorAll('.waypoint-pill');

  // Architecture Hub Elements
  const hubTabBtns = document.querySelectorAll('.hub-tab-btn');
  const hubTag = document.getElementById('hub-tag');
  const hubTitle = document.getElementById('hub-title');
  const hubDesc = document.getElementById('hub-desc');
  const hubMetrics = document.getElementById('hub-metrics');

  // Suite Filter Elements
  const suiteFilterBtns = document.querySelectorAll('.suite-filter-btn');
  const suiteCards = document.querySelectorAll('.suite-card');

  // Image Cache
  const images = new Array(TOTAL_FRAMES);
  const loadedFlags = new Uint8Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let isInitialReady = false;

  // Animation State
  let targetProgress = 0;
  let currentProgress = 0;
  let targetFrame = 0;
  let currentFrame = 0;
  let lastDrawnFrame = -1;
  let isAutoTouring = false;
  let autoTourFrame = 0;

  // Frame URL Helper
  function getFrameUrl(index) {
    const frameNum = String(index + 1).padStart(3, '0');
    return `${FRAME_DIR}/${FRAME_PREFIX}${frameNum}${FRAME_EXT}`;
  }

  // --- Image Preloader ---
  function preloadImage(index) {
    if (images[index] && loadedFlags[index]) {
      return Promise.resolve(images[index]);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = getFrameUrl(index);
      img.onload = () => {
        images[index] = img;
        loadedFlags[index] = 1;
        loadedCount++;
        resolve(img);
      };
      img.onerror = () => {
        setTimeout(() => {
          img.src = getFrameUrl(index);
        }, 300);
        resolve(null);
      };
    });
  }

  async function initializeSequence() {
    // 1. Load First Frame
    const firstImg = await preloadImage(0);
    if (firstImg) {
      renderFrame(0, true);
    }

    // 2. Pass 1: Stride 6 covering full flight in ~0.3s
    const pass1 = [];
    for (let i = 0; i < TOTAL_FRAMES; i += 6) {
      if (i !== 0) pass1.push(i);
    }
    pass1.push(TOTAL_FRAMES - 1);
    await Promise.all(pass1.map((idx) => preloadImage(idx)));

    updateLoaderProgress(65);
    dismissPreloader();

    // 3. Pass 2: Remaining frames in background
    const remaining = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (!loadedFlags[i]) remaining.push(i);
    }
    const CHUNK_SIZE = 15;
    for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
      const chunk = remaining.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map((idx) => preloadImage(idx)));
      updateLoaderProgress();
    }
  }

  function updateLoaderProgress(overridePercent) {
    const percent = overridePercent || Math.round((loadedCount / TOTAL_FRAMES) * 100);
    if (loaderBar) loaderBar.style.width = `${percent}%`;
    if (loaderStatus) loaderStatus.textContent = `LOADING HIGH-DEF SEQUENCE: ${percent}%`;
  }

  function dismissPreloader() {
    if (isInitialReady) return;
    isInitialReady = true;
    if (preloader) {
      preloader.classList.add('loaded');
      setTimeout(() => {
        preloader.style.display = 'none';
      }, 500);
    }
  }

  // --- 16:9 LOCKED CANVAS (PREVENTS STRETCHING & DISTORTION) ---
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // Exactly 16:9 ratio matching 1280x720 video frames
    const imgAspect = 1280 / 720;
    const viewAspect = vw / vh;
    
    let displayW, displayH;
    if (viewAspect > imgAspect) {
      displayW = vw;
      displayH = vw / imgAspect;
    } else {
      displayH = vh;
      displayW = vh * imgAspect;
    }
    
    // High-DPI physical backing resolution
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    
    // Exact 16:9 display size centered in viewport
    canvas.style.width = `${Math.round(displayW)}px`;
    canvas.style.height = `${Math.round(displayH)}px`;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (lastDrawnFrame >= 0) {
      renderFrame(lastDrawnFrame, true);
    }
  }

  function findNearestLoadedFrame(targetIdx) {
    if (loadedFlags[targetIdx]) return targetIdx;
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      if (targetIdx - offset >= 0 && loadedFlags[targetIdx - offset]) {
        return targetIdx - offset;
      }
      if (targetIdx + offset < TOTAL_FRAMES && loadedFlags[targetIdx + offset]) {
        return targetIdx + offset;
      }
    }
    return 0;
  }

  function renderFrame(frameIdx, force = false) {
    if (frameIdx === lastDrawnFrame && !force) return;

    const availableIdx = findNearestLoadedFrame(frameIdx);
    const img = images[availableIdx];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1:1 proportional draw across the 16:9 canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    lastDrawnFrame = frameIdx;
  }

  // --- NATURAL SMOOTH SCROLL TRACKING ---
  function onScroll() {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    const rect = scrollContainer.getBoundingClientRect();
    const scrollableDist = scrollContainer.offsetHeight - window.innerHeight;
    
    if (scrollableDist > 0) {
      const scrolled = -rect.top;
      const progress = Math.min(Math.max(scrolled / scrollableDist, 0), 1);
      targetProgress = progress;
      targetFrame = targetProgress * (TOTAL_FRAMES - 1);
    }
  }

  // Main Render Loop
  function animationLoop() {
    if (isAutoTouring) {
      autoTourFrame += 0.4;
      if (autoTourFrame >= TOTAL_FRAMES) {
        autoTourFrame = 0;
      }
      
      // Auto-scroll window to match auto-tour position
      const scrollableDist = scrollContainer.offsetHeight - window.innerHeight;
      const targetY = (autoTourFrame / (TOTAL_FRAMES - 1)) * scrollableDist;
      window.scrollTo(0, targetY);

      currentFrame = autoTourFrame;
      targetFrame = autoTourFrame;
      targetProgress = autoTourFrame / (TOTAL_FRAMES - 1);
    } else {
      // Snappy, smooth lerp following scroll
      const lerpFactor = 0.45;
      currentFrame += (targetFrame - currentFrame) * lerpFactor;
      currentProgress += (targetProgress - currentProgress) * lerpFactor;
    }

    const frameToRender = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentFrame)));
    renderFrame(frameToRender);

    const progress = frameToRender / (TOTAL_FRAMES - 1);
    updateHUD(progress, frameToRender);
    updateStoryMilestones(progress);
    updateWaypointPills(progress);

    requestAnimationFrame(animationLoop);
  }

  // --- HUD Updates ---
  function updateHUD(progress, frameIdx) {
    const percent = Math.min(Math.max(progress * 100, 0), 100);
    if (hudProgress) hudProgress.style.width = `${percent}%`;
    if (hudHandle) hudHandle.style.left = `${percent}%`;
    if (hudCounter) {
      hudCounter.textContent = String(frameIdx + 1).padStart(3, '0');
    }
  }

  // --- Narrative Titles Synchronization (CLEAN TYPOGRAPHY) ---
  function updateStoryMilestones(progress) {
    storyCards.forEach((card) => {
      const start = parseFloat(card.dataset.start);
      const end = parseFloat(card.dataset.end);
      const fadeInWindow = 0.035;
      const fadeOutWindow = 0.035;

      if (progress >= start && progress <= end) {
        let opacity = 1;
        let translateY = 0;

        if (progress < start + fadeInWindow) {
          const t = (progress - start) / fadeInWindow;
          opacity = t;
          translateY = (1 - t) * 16;
        } else if (progress > end - fadeOutWindow) {
          const t = (end - progress) / fadeOutWindow;
          opacity = t;
          translateY = (1 - t) * -16;
        }

        card.style.opacity = opacity.toFixed(3);
        card.style.transform = `translateY(${translateY.toFixed(1)}px)`;
        card.classList.add('active');
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        card.classList.remove('active');
      }
    });
  }

  // --- Waypoints Ribbon ---
  function updateWaypointPills(progress) {
    const currentF = progress * (TOTAL_FRAMES - 1);
    waypointPills.forEach((pill) => {
      const targetF = parseFloat(pill.dataset.targetFrame);
      if (Math.abs(currentF - targetF) < 45) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  function initWaypoints() {
    waypointPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const targetF = parseFloat(pill.dataset.targetFrame);
        const scrollableDist = scrollContainer.offsetHeight - window.innerHeight;
        const targetScrollY = (targetF / (TOTAL_FRAMES - 1)) * scrollableDist;

        if (isAutoTouring) stopAutoTour();

        window.scrollTo({
          top: targetScrollY,
          behavior: 'smooth'
        });
      });
    });
  }

  // --- Scrubber Drag & Click ---
  function initScrubber() {
    let isDragging = false;

    function scrub(e) {
      const rect = hudScrubber.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clampedX = Math.max(0, Math.min(clickX, rect.width));
      const ratio = clampedX / rect.width;
      
      const scrollableDist = scrollContainer.offsetHeight - window.innerHeight;
      const targetScrollY = ratio * scrollableDist;
      
      window.scrollTo({
        top: targetScrollY,
        behavior: 'auto'
      });
    }

    hudScrubber.addEventListener('mousedown', (e) => {
      isDragging = true;
      if (isAutoTouring) stopAutoTour();
      scrub(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) scrub(e);
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    hudScrubber.addEventListener('touchstart', (e) => {
      if (isAutoTouring) stopAutoTour();
      if (e.touches.length > 0) scrub(e.touches[0]);
    }, { passive: true });

    hudScrubber.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) scrub(e.touches[0]);
    }, { passive: true });
  }

  // --- Auto Tour Mode (Toggle Button) ---
  function startAutoTour() {
    isAutoTouring = true;
    autoTourFrame = currentFrame;
    autoTourBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      Pause Tour
    `;
    autoTourBtn.style.color = 'var(--gold-light)';
  }

  function stopAutoTour() {
    if (!isAutoTouring) return;
    isAutoTouring = false;
    autoTourBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      Auto Tour
    `;
    autoTourBtn.style.color = '';
  }

  if (autoTourBtn) {
    autoTourBtn.addEventListener('click', () => {
      if (isAutoTouring) {
        stopAutoTour();
      } else {
        startAutoTour();
      }
    });
  }

  // Pause auto-tour if user scrolls manually
  window.addEventListener('wheel', () => {
    if (isAutoTouring) stopAutoTour();
  }, { passive: true });

  window.addEventListener('touchstart', () => {
    if (isAutoTouring) stopAutoTour();
  }, { passive: true });

  // --- Interactive Architecture Hub Tabs ---
  const hubData = {
    skin: {
      tag: "Engineering Distinction",
      title: "Triple-Glazed Acoustic Bronze Glazing",
      desc: "Engineered with dual low-emissivity bronze coatings and argon-gas insulation, the curved glass facade reflects ambient urban glare while locking in peaceful silence and warm thermal balance.",
      metrics: [
        { val: "STC 58", lbl: "Acoustic Decibel Isolation" },
        { val: "0.24 U", lbl: "Thermal Efficiency Rating" },
        { val: "99.8%", lbl: "UV Radiation Shielding" }
      ]
    },
    atrium: {
      tag: "Biophilic Microclimate",
      title: "38-Meter Botanical Central Courtyard",
      desc: "An uninterrupted open-air vertical core that draws fresh evening breezes upward through passive thermal buoyancy, creating a private microclimate insulated from city commotion.",
      metrics: [
        { val: "38M", lbl: "Open Skyward Void" },
        { val: "100%", lbl: "Passive Cross-Flow" },
        { val: "22°C", lbl: "Regulated Courtyard Ambient" }
      ]
    },
    terraces: {
      tag: "Cantilevered Living",
      title: "Vortex-Sheltered Balconies",
      desc: "Every residence features private outdoor salons sculpted along the S-curve. The aerodynamic form deflects wind turbulence while preserving unobstructed panoramic twilight sightlines.",
      metrics: [
        { val: "22 FT", lbl: "Maximum Terrace Depth" },
        { val: "45 MPH", lbl: "Wind Deflection Rating" },
        { val: "300°", lbl: "Courtyard Sightline Arc" }
      ]
    },
    lighting: {
      tag: "Circadian Illumination",
      title: "Dusk-Synchronized Ambient Lighting",
      desc: "Custom architectural bronze luminaires automatically adjust color temperature from golden amber (2,400K) to deep warm twilight as the sun sets, creating the magical courtyard glow.",
      metrics: [
        { val: "2,400K", lbl: "Warm Twilight Spectrum" },
        { val: "0.00", lbl: "Upward Light Pollution" },
        { val: "100%", lbl: "Renewable Solar Powered" }
      ]
    }
  };

  function initArchHub() {
    hubTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        hubTabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const key = btn.dataset.hub;
        const data = hubData[key];
        if (!data) return;

        hubTag.textContent = data.tag;
        hubTitle.textContent = data.title;
        hubDesc.textContent = data.desc;

        hubMetrics.innerHTML = data.metrics.map((m) => `
          <div class="metric-item">
            <div class="metric-val">${m.val}</div>
            <div class="metric-lbl">${m.lbl}</div>
          </div>
        `).join('');
      });
    });
  }

  // --- Suite Filtering ---
  function initSuiteFilter() {
    suiteFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        suiteFilterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        suiteCards.forEach((card) => {
          const category = card.dataset.category;
          if (filter === 'all' || category === filter) {
            card.style.display = 'flex';
            setTimeout(() => {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 50);
          } else {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
              card.style.display = 'none';
            }, 300);
          }
        });
      });
    });
  }

  // --- Ambient Dusk Soundscape Generator (Web Audio API) ---
  let audioCtx = null;
  let isAudioPlaying = false;
  let masterGain = null;

  function initAmbientAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Warm twilight fifth chord: A2 110Hz + E3 165Hz
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();

      osc1.type = 'sine';
      osc1.frequency.value = 110;
      osc2.type = 'triangle';
      osc2.frequency.value = 164.81;

      filter.type = 'lowpass';
      filter.frequency.value = 320;

      const droneGain = audioCtx.createGain();
      droneGain.gain.value = 0.15;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(masterGain);

      osc1.start();
      osc2.start();

      // Soft breeze noise
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const windFilter = audioCtx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 400;
      windFilter.Q.value = 1.8;

      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = 0.12;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 150;
      lfo.connect(windFilter.frequency);
      lfo.start();

      const windGain = audioCtx.createGain();
      windGain.gain.value = 0.08;

      whiteNoise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);

      whiteNoise.start();

      scheduleChimes();
    } catch (e) {
      console.warn('Web Audio could not be initialized:', e);
    }
  }

  function scheduleChimes() {
    if (!audioCtx) return;
    const chimeFreqs = [523.25, 659.25, 783.99, 987.77, 1046.50];

    function playSingleChime() {
      if (!isAudioPlaying) {
        setTimeout(playSingleChime, 4000);
        return;
      }
      try {
        const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
        const osc = audioCtx.createOscillator();
        const chimeGain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const now = audioCtx.currentTime;
        chimeGain.gain.setValueAtTime(0, now);
        chimeGain.gain.linearRampToValueAtTime(0.04, now + 0.1);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

        osc.connect(chimeGain);
        chimeGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 3.6);
      } catch (err) {}

      setTimeout(playSingleChime, 4500 + Math.random() * 3000);
    }

    setTimeout(playSingleChime, 2500);
  }

  function toggleAudio() {
    if (!audioCtx) initAmbientAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (isAudioPlaying) {
      masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
      isAudioPlaying = false;
      audioBtn.classList.remove('active');
    } else {
      masterGain.gain.setTargetAtTime(0.8, audioCtx.currentTime, 0.4);
      isAudioPlaying = true;
      audioBtn.classList.add('active');
    }
  }

  if (audioBtn) {
    audioBtn.addEventListener('click', toggleAudio);
  }

  // --- VIP Inquiry Form Handler ---
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = inquiryForm.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Appointment Confirmed';
      btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      btn.style.color = '#fff';

      setTimeout(() => {
        alert('Thank you for reserving a private showing of The Helix Residences. A senior residence director will contact you directly to finalize your viewing itinerary.');
        inquiryForm.reset();
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.color = '';
      }, 700);
    });
  }

  // --- Event Listeners ---
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resizeCanvas, { passive: true });

  window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    initScrubber();
    initWaypoints();
    initArchHub();
    initSuiteFilter();
    initializeSequence();
    requestAnimationFrame(animationLoop);
    onScroll();
  });

})();
