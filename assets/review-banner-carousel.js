(function() {
  'use strict';

  // Performance utilities
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (start, end, factor) => start + (end - start) * factor;
  
  const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  };

  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Advanced image loading with blur-up
  class ImageLoader {
    constructor() {
      this.observer = null;
      this.init();
    }

    init() {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(
          this.handleIntersection.bind(this),
          {
            rootMargin: '50px 0px',
            threshold: 0.1
          }
        );
      }
    }

    handleIntersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }

    loadImage(img) {
      if (img.dataset.loaded) return;

      const src = img.dataset.src || img.src;
      if (!src) return;

      img.classList.add('loading');
      
      const imageLoader = new Image();
      imageLoader.onload = () => {
        if (img.dataset.src) {
          img.src = src;
        }
        img.classList.remove('loading');
        img.classList.add('loaded');
        img.dataset.loaded = 'true';
        
        // Hide blur placeholder
        const blurPlaceholder = img.parentElement?.querySelector('.rbc-image-blur');
        if (blurPlaceholder) {
          blurPlaceholder.classList.add('hidden');
          setTimeout(() => blurPlaceholder.remove(), 600);
        }
      };
      
      imageLoader.onerror = () => {
        img.classList.remove('loading');
        console.warn('Failed to load image:', src);
      };
      
      imageLoader.src = src;
    }

    observe(img) {
      if (this.observer) {
        this.observer.observe(img);
      } else {
        this.loadImage(img);
      }
    }

    disconnect() {
      if (this.observer) {
        this.observer.disconnect();
      }
    }
  }

  // Simple analytics class
  class CarouselAnalytics {
    constructor(carousel) {
      this.carousel = carousel;
      this.events = [];
    }

    trackInit() {
      this.track('init', { slideCount: this.carousel.state.slides.length });
    }

    trackPlay() {
      this.track('play');
    }

    trackPause() {
      this.track('pause');
    }

    trackDragStart() {
      this.track('drag_start');
    }

    trackDragEnd(distance) {
      this.track('drag_end', { distance });
    }

    track(eventName, data = {}) {
      const event = {
        name: eventName,
        timestamp: Date.now(),
        data
      };
      
      this.events.push(event);
      
      // Integrate with analytics services
      if (typeof window.gtag !== 'undefined') {
        try {
          gtag('event', `rbc_${eventName}`, data);
        } catch (e) {
          console.warn('Analytics tracking failed:', e);
        }
      }
      
      if (typeof window.dataLayer !== 'undefined') {
        try {
          window.dataLayer.push({
            event: `rbc_${eventName}`,
            ...data
          });
        } catch (e) {
          console.warn('DataLayer push failed:', e);
        }
      }
    }

    getAnalytics() {
      return this.events;
    }
  }

  /**
   * Advanced Review Banner Carousel
   * Production-ready component with enterprise features
   */
  class AdvancedReviewCarousel {
    constructor(element) {
      // Core elements
      this.element = element;
      this.track = element.querySelector('.rbc-carousel-track');
      this.originalContent = element.querySelector('.rbc-carousel-content');
      
      if (!this.track || !this.originalContent) {
        console.error('RBC: Required elements missing');
        return;
      }

      // Configuration from data attributes
      this.config = this.parseConfig();
      
      // State management
      this.state = {
        initialized: false,
        playing: this.config.autoplay,
        visible: false,
        dragging: false,
        offset: 0,
        velocity: 0,
        baseWidth: 0,
        cloneCount: 3,
        animationId: null,
        lastTimestamp: 0,
        slides: [],
        clones: [],
        currentSlideIndex: 0
      };

      // Observers and utilities
      this.observers = {
        intersection: null,
        resize: null,
        mutation: null
      };

      this.imageLoader = new ImageLoader();
      this.analytics = new CarouselAnalytics(this);
      
      // Bind methods
      this.animate = this.animate.bind(this);
      this.handleResize = debounce(this.handleResize.bind(this), 250);
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = throttle(this.handlePointerMove.bind(this), 16);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);

      this.init();
    }

    parseConfig() {
      const element = this.element;
      return {
        speed: parseInt(element.dataset.scrollSpeed) || 60,
        direction: element.dataset.direction || 'left',
        pauseOnHover: element.dataset.pauseOnHover !== 'false',
        autoplay: element.dataset.autoplay !== 'false',
        gap: parseInt(element.dataset.gap) || 24,
        gapMobile: parseInt(element.dataset.gapMobile) || 16,
        dragEnabled: element.dataset.dragEnabled !== 'false',
        keyboardEnabled: element.dataset.keyboardEnabled !== 'false',
        imageStrategy: element.dataset.imageStrategy || 'lazy',
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      };
    }

    async init() {
      try {
        this.element.classList.add('rbc-initializing');
        
        await this.waitForImages();
        this.setupStructure();
        this.measureDimensions();
        this.createClones();
        this.setupInteractions();
        this.setupObservers();
        this.setupAccessibility();
        this.loadImages();
        
        this.state.initialized = true;
        this.element.classList.remove('rbc-initializing');
        this.element.classList.add('rbc-ready');
        
        if (this.config.autoplay && !this.config.reducedMotion) {
          this.play();
        }

        this.dispatchEvent('ready', { instance: this });
        this.analytics.trackInit();
        
      } catch (error) {
        console.error('RBC: Initialization failed:', error);
        this.handleError(error);
      }
    }

    async waitForImages() {
      if (this.config.imageStrategy === 'eager') {
        const images = Array.from(this.originalContent.querySelectorAll('img'));
        const promises = images.map(img => {
          if (img.complete) return Promise.resolve();
          
          return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 3000);
            img.addEventListener('load', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
            img.addEventListener('error', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
          });
        });
        
        await Promise.allSettled(promises);
      }
    }

    setupStructure() {
      this.track.innerHTML = '';
      this.track.appendChild(this.originalContent);
      
      // Set up CSS custom properties
      const gap = window.innerWidth >= 750 ? this.config.gap : this.config.gapMobile;
      this.originalContent.style.gap = `${gap}px`;
      this.originalContent.style.display = 'flex';
      
      this.state.slides = Array.from(this.originalContent.children);
      this.updateSlideAttributes();
    }

    updateSlideAttributes() {
      this.state.slides.forEach((slide, index) => {
        slide.setAttribute('data-slide-index', index);
        slide.setAttribute('aria-setsize', this.state.slides.length);
        slide.setAttribute('aria-posinset', index + 1);
        slide.setAttribute('tabindex', index === 0 ? '0' : '-1');
      });
    }

    measureDimensions() {
      requestAnimationFrame(() => {
        const gap = window.innerWidth >= 750 ? this.config.gap : this.config.gapMobile;
        let totalWidth = 0;
        
        this.state.slides.forEach((slide, index) => {
          const rect = slide.getBoundingClientRect();
          totalWidth += rect.width;
          if (index < this.state.slides.length - 1) {
            totalWidth += gap;
          }
        });
        
        this.state.baseWidth = totalWidth;
        this.state.velocity = this.state.baseWidth / Math.max(1, this.config.speed);
        
        this.updateTransform();
      });
    }

    createClones() {
      // Remove existing clones
      this.state.clones.forEach(clone => clone.remove());
      this.state.clones = [];
      
      if (this.state.slides.length === 0) return;
      
      // Create multiple clones for seamless infinite scroll
      for (let i = 0; i < this.state.cloneCount; i++) {
        const clone = this.originalContent.cloneNode(true);
        clone.classList.add('rbc-clone');
        clone.setAttribute('aria-hidden', 'true');
        
        // Remove interactivity from clones
        const interactiveElements = clone.querySelectorAll('a, button, input, select, textarea, [tabindex]');
        interactiveElements.forEach(el => {
          el.setAttribute('tabindex', '-1');
          el.setAttribute('aria-hidden', 'true');
        });
        
        this.track.appendChild(clone);
        this.state.clones.push(clone);
      }
    }

    setupInteractions() {
      if (this.config.pauseOnHover) {
        this.element.addEventListener('mouseenter', () => this.pause());
        this.element.addEventListener('mouseleave', () => this.resume());
        this.element.addEventListener('focusin', () => this.pause());
        this.element.addEventListener('focusout', (e) => {
          if (!this.element.contains(e.relatedTarget)) {
            this.resume();
          }
        });
      }

      if (this.config.dragEnabled) {
        this.element.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
        this.element.addEventListener('pointermove', this.handlePointerMove, { passive: false });
        this.element.addEventListener('pointerup', this.handlePointerUp);
        this.element.addEventListener('pointercancel', this.handlePointerUp);
        
        // Prevent context menu on long press
        this.element.addEventListener('contextmenu', (e) => {
          if (this.state.dragging) e.preventDefault();
        });
      }

      if (this.config.keyboardEnabled) {
        this.element.addEventListener('keydown', this.handleKeyDown);
      }

      // Handle visibility change
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Handle reduced motion preference changes
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQuery.addEventListener('change', (e) => {
        this.config.reducedMotion = e.matches;
        if (e.matches) {
          this.pause();
          this.enableStaticMode();
        } else {
          this.disableStaticMode();
          if (this.config.autoplay) this.play();
        }
      });

      // Setup control buttons
      this.setupControls();
    }

    setupControls() {
      const controls = this.element.parentElement?.querySelector('.rbc-controls');
      if (!controls) return;

      const prevBtn = controls.querySelector('[data-rbc-control="prev"]');
      const nextBtn = controls.querySelector('[data-rbc-control="next"]');
      const playPauseBtn = controls.querySelector('[data-rbc-control="play-pause"]');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.navigateTo('prev'));
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.navigateTo('next'));
      }

      if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
          if (this.state.playing) {
            this.pause();
          } else {
            this.play();
          }
        });
      }
    }

    setupObservers() {
      // Intersection Observer for performance
      if ('IntersectionObserver' in window) {
        this.observers.intersection = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            this.state.visible = entry.isIntersecting;
            if (entry.isIntersecting && this.config.autoplay && !this.config.reducedMotion) {
              this.resume();
            } else {
              this.pause();
            }
          });
        }, { threshold: 0.1 });
        
        this.observers.intersection.observe(this.element);
      }

      // Resize Observer
      if ('ResizeObserver' in window) {
        this.observers.resize = new ResizeObserver(this.handleResize);
        this.observers.resize.observe(this.element);
      } else {
        window.addEventListener('resize', this.handleResize);
      }

      // Mutation Observer for dynamic content
      if ('MutationObserver' in window) {
        this.observers.mutation = new MutationObserver((mutations) => {
          let shouldReinitialize = false;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.target === this.originalContent) {
              shouldReinitialize = true;
            }
          });
          
          if (shouldReinitialize) {
            this.reinitialize();
          }
        });
        
        this.observers.mutation.observe(this.originalContent, {
          childList: true,
          subtree: false
        });
      }
    }

    setupAccessibility() {
      this.element.setAttribute('role', 'region');
      this.element.setAttribute('aria-label', `Customer reviews carousel with ${this.state.slides.length} reviews`);
      this.element.setAttribute('aria-live', 'polite');
      this.element.setAttribute('aria-atomic', 'false');
      this.element.setAttribute('tabindex', '0');
      
      // Add carousel controls for screen readers
      if (this.state.slides.length > 1) {
        const controlsId = `rbc-controls-${Date.now()}`;
        this.element.setAttribute('aria-describedby', controlsId);
        
        const controls = document.createElement('div');
        controls.id = controlsId;
        controls.className = 'rbc-sr-only';
        controls.textContent = 'Use arrow keys to navigate between reviews, or tab to access individual review content.';
        this.element.appendChild(controls);
      }
    }

    loadImages() {
      const images = this.element.querySelectorAll('img[data-src], img:not([data-loaded])');
      images.forEach(img => {
        this.imageLoader.observe(img);
      });
    }

    // Animation and Movement
    play() {
      if (!this.state.initialized || this.state.playing || this.config.reducedMotion) return;
      
      this.state.playing = true;
      this.state.lastTimestamp = performance.now();
      this.animate();
      
      this.element.classList.remove('is-paused');
      this.dispatchEvent('play');
      this.analytics.trackPlay();
    }

    pause() {
      if (!this.state.playing) return;
      
      this.state.playing = false;
      if (this.state.animationId) {
        cancelAnimationFrame(this.state.animationId);
        this.state.animationId = null;
      }
      
      this.element.classList.add('is-paused');
      this.dispatchEvent('pause');
      this.analytics.trackPause();
    }

    resume() {
      if (!this.config.autoplay || this.state.playing || !this.state.visible || this.config.reducedMotion) return;
      this.play();
    }

    animate(timestamp = performance.now()) {
      if (!this.state.playing) return;
      
      const deltaTime = Math.min((timestamp - this.state.lastTimestamp) / 1000, 1/30); // Cap at 30fps
      this.state.lastTimestamp = timestamp;
      
      const direction = this.config.direction === 'left' ? -1 : 1;
      const rtlMultiplier = document.documentElement.dir === 'rtl' ? -1 : 1;
      const velocity = direction * rtlMultiplier * this.state.velocity;
      
      this.state.offset += velocity * deltaTime;
      this.wrapOffset();
      this.updateTransform();
      
      this.state.animationId = requestAnimationFrame(this.animate);
    }

    wrapOffset() {
      const wrapPoint = this.state.baseWidth + (window.innerWidth >= 750 ? this.config.gap : this.config.gapMobile);
      
      if (this.config.direction === 'left') {
        if (this.state.offset <= -wrapPoint) {
          this.state.offset += wrapPoint;
        }
      } else {
        if (this.state.offset >= wrapPoint) {
          this.state.offset -= wrapPoint;
        }
      }
    }

    updateTransform() {
      const transform = `translate3d(${this.state.offset}px, 0, 0)`;
      this.track.style.transform = transform;
    }

    // Event Handlers
    handlePointerDown(e) {
      if (!this.config.dragEnabled || e.target.closest('a, button')) return;
      
      e.preventDefault();
      this.state.dragging = true;
      this.pause();
      
      this.state.startX = e.clientX;
      this.state.lastX = e.clientX;
      
      this.element.classList.add('rbc-dragging');
      this.element.style.cursor = 'grabbing';
      
      this.analytics.trackDragStart();
    }

    handlePointerMove(e) {
      if (!this.state.dragging) return;
      
      const deltaX = e.clientX - this.state.lastX;
      this.state.offset += deltaX;
      this.updateTransform();
      this.state.lastX = e.clientX;
    }

    handlePointerUp() {
      if (!this.state.dragging) return;
      
      this.state.dragging = false;
      this.element.classList.remove('rbc-dragging');
      this.element.style.cursor = '';
      
      // Add momentum if drag was significant
      const dragDistance = Math.abs(this.state.lastX - this.state.startX);
      if (dragDistance > 50) {
        this.addMomentum();
      }
      
      setTimeout(() => {
        if (this.config.autoplay && this.state.visible) {
          this.resume();
        }
      }, 100);
      
      this.analytics.trackDragEnd(dragDistance);
    }

    addMomentum() {
      const dragVelocity = (this.state.lastX - this.state.startX) * 0.1;
      let momentum = dragVelocity;
      
      const momentumAnimation = () => {
        if (Math.abs(momentum) < 0.1) return;
        
        this.state.offset += momentum;
        this.updateTransform();
        momentum *= 0.95; // Friction
        
        requestAnimationFrame(momentumAnimation);
      };
      
      momentumAnimation();
    }

    handleKeyDown(e) {
      if (!this.config.keyboardEnabled) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.navigateTo('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.navigateTo('next');
          break;
        case ' ':
          e.preventDefault();
          this.state.playing ? this.pause() : this.resume();
          break;
        case 'Home':
          e.preventDefault();
          this.navigateTo(0);
          break;
        case 'End':
          e.preventDefault();
          this.navigateTo(this.state.slides.length - 1);
          break;
      }
    }

    navigateTo(direction) {
      let targetIndex;
      
      if (typeof direction === 'number') {
        targetIndex = direction;
      } else if (direction === 'prev') {
        targetIndex = this.state.currentSlideIndex - 1;
      } else if (direction === 'next') {
        targetIndex = this.state.currentSlideIndex + 1;
      }
      
      targetIndex = clamp(targetIndex, 0, this.state.slides.length - 1);
      
      if (targetIndex !== this.state.currentSlideIndex) {
        this.state.currentSlideIndex = targetIndex;
        this.focusSlide(targetIndex);
        this.announceSlide(targetIndex);
      }
    }

    focusSlide(index) {
      // Remove tabindex from all slides
      this.state.slides.forEach(slide => slide.setAttribute('tabindex', '-1'));
      
      // Set focus on target slide
      const targetSlide = this.state.slides[index];
      if (targetSlide) {
        targetSlide.setAttribute('tabindex', '0');
        targetSlide.focus();
      }
    }

    announceSlide(index) {
      const slide = this.state.slides[index];
      if (!slide) return;
      
      const announcement = `Review ${index + 1} of ${this.state.slides.length}`;
      this.announce(announcement);
    }

    announce(message) {
      const announcer = document.createElement('div');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'rbc-sr-only';
      announcer.textContent = message;
      
      document.body.appendChild(announcer);
      setTimeout(() => announcer.remove(), 1000);
    }

    handleResize() {
      if (!this.state.initialized) return;
      
      this.measureDimensions();
      this.createClones();
      
      if (this.state.playing) {
        this.play();
      }
    }

    handleVisibilityChange() {
      if (document.hidden) {
        this.pause();
      } else if (this.config.autoplay && this.state.visible) {
        this.resume();
      }
    }

    // Static mode for reduced motion
    enableStaticMode() {
      this.element.classList.add('rbc-static-mode');
      this.element.setAttribute('data-reduced-motion', 'true');
    }

    disableStaticMode() {
      this.element.classList.remove('rbc-static-mode');
      this.element.removeAttribute('data-reduced-motion');
    }

    // Lifecycle methods
    reinitialize() {
      this.destroy(false);
      setTimeout(() => this.init(), 100);
    }

    destroy(removeListeners = true) {
      this.pause();
      
      // Cleanup observers
      Object.values(this.observers).forEach(observer => {
        if (observer) observer.disconnect();
      });
      
      if (removeListeners) {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('resize', this.handleResize);
      }
      
      // Cleanup image loader
      this.imageLoader.disconnect();
      
      // Reset classes and attributes
      this.element.classList.remove('rbc-ready', 'is-paused', 'rbc-dragging', 'rbc-static-mode');
      this.element.style.cursor = '';
      this.track.style.transform = '';
      
      // Remove clones
      this.state.clones.forEach(clone => clone.remove());
      
      this.dispatchEvent('destroy');
    }

    // Public API
    getState() {
      return {
        ...this.state,
        config: this.config
      };
    }

    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      this.reinitialize();
    }

    // Utility methods
    dispatchEvent(eventName, detail = {}) {
      const event = new CustomEvent(`rbc:${eventName}`, {
        detail: { ...detail, instance: this },
        bubbles: true,
        cancelable: true
      });
      this.element.dispatchEvent(event);
    }

    handleError(error) {
      console.error('RBC Error:', error);
      this.dispatchEvent('error', { error });
      this.element.classList.add('rbc-error');
    }
  }

  // Instance management
  const instances = new WeakMap();

  function initCarousel(element) {
    if (instances.has(element)) return instances.get(element);
    
    const instance = new AdvancedReviewCarousel(element);
    instances.set(element, instance);
    return instance;
  }

  function destroyCarousel(element) {
    const instance = instances.get(element);
    if (instance) {
      instance.destroy();
      instances.delete(element);
    }
  }

  function initAll(root = document) {
    const elements = root.querySelectorAll('.rbc-carousel-wrapper:not(.rbc-ready)');
    elements.forEach(initCarousel);
  }

  function destroyAll(root = document) {
    const elements = root.querySelectorAll('.rbc-carousel-wrapper.rbc-ready');
    elements.forEach(destroyCarousel);
  }

  // Auto-initialization
  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        requestAnimationFrame(() => initAll());
      });
    } else {
      requestAnimationFrame(() => initAll());
    }

    // Shopify theme editor support
    document.addEventListener('shopify:section:load', (e) => {
      requestAnimationFrame(() => initAll(e.target));
    });

    document.addEventListener('shopify:section:unload', (e) => {
      destroyAll(e.target);
    });

    document.addEventListener('shopify:section:select', (e) => {
      const carousel = e.target.querySelector('.rbc-carousel-wrapper');
      if (carousel) {
        const instance = instances.get(carousel);
        if (instance) instance.pause();
      }
    });

    document.addEventListener('shopify:section:deselect', (e) => {
      const carousel = e.target.querySelector('.rbc-carousel-wrapper');
      if (carousel) {
        const instance = instances.get(carousel);
        if (instance && instance.config.autoplay) instance.resume();
      }
    });
  }

  // Global API
  window.AdvancedReviewCarousel = {
    init: initCarousel,
    destroy: destroyCarousel,
    initAll,
    destroyAll,
    getInstance: (element) => instances.get(element),
    version: '2.0.0'
  };

  boot();
})();