// Product photos: a carousel in the detail page and a full-screen viewer on top of it.
// Both sit on a native scroll-snap track, so a finger swipe is the browser's own (momentum, snapping); the mouse gets
// drag-to-scroll, arrows and the keyboard on top.

const behavior = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&"<]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;' })[c]);

class Carousel {
  constructor(track, onChange) {
    this.track = track;
    this.onChange = onChange;
    this.index = 0;
    let raf = 0;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.sync());
    }, { passive: true });
    this.#mouseDrag();
  }

  get slides() { return this.track.children; }

  offset(i) {
    return this.slides[i].offsetLeft - parseFloat(getComputedStyle(this.track).paddingLeft);
  }

  nearest() {
    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    const n = this.slides.length;
    if (n && scrollLeft >= scrollWidth - clientWidth - 2) return n - 1; // the last one may never reach the start
    let best = 0, d = Infinity;
    for (let i = 0; i < n; i++) {
      const di = Math.abs(this.offset(i) - scrollLeft);
      if (di < d) (d = di), (best = i);
    }
    return best;
  }

  sync(force = false) {
    const i = this.nearest();
    if (i === this.index && !force) return;
    this.index = i;
    this.onChange(i);
  }

  goTo(i, how = behavior()) {
    if (!this.slides.length) return;
    i = Math.max(0, Math.min(this.slides.length - 1, i));
    this.track.scrollTo({ left: this.offset(i), behavior: how });
    if (how === 'auto') this.sync(true);
  }

  // mouse only: touch already scrolls natively. Snapping is off while the photo follows the cursor, then it glides to
  // the next one in the direction of the drag, and the click that ends the drag doesn't open anything.
  #mouseDrag() {
    const t = this.track;
    let id = null, x0 = 0, s0 = 0, from = 0, moved = false;
    t.addEventListener('pointerdown', (e) => {
      this.dragged = false;
      if (e.pointerType !== 'mouse' || e.button !== 0 || this.slides.length < 2) return;
      id = e.pointerId; x0 = e.clientX; s0 = t.scrollLeft; from = this.index; moved = false;
    });
    t.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        t.setPointerCapture(id);
        t.classList.add('dragging');
      }
      if (moved) t.scrollLeft = s0 - dx;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!moved) return;
      this.dragged = true;
      const dx = e.clientX - x0;
      let to = this.nearest();
      if (to === from && Math.abs(dx) > 40) to = from - Math.sign(dx);
      this.goTo(to);
      const done = () => t.classList.remove('dragging');
      t.addEventListener('scrollend', done, { once: true });
      setTimeout(done, 700); // no scrollend (older Safari)
    };
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
    t.addEventListener('click', (e) => {
      if (!this.dragged) return;
      this.dragged = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
  }
}

// ---------- carousel in the detail page ----------
export class Gallery {
  constructor(root, onOpen) {
    this.root = root;
    this.track = root.querySelector('.g-track');
    this.dots = root.querySelector('.g-dots');
    this.count = root.querySelector('.g-count');
    this.prev = root.querySelector('.g-prev');
    this.next = root.querySelector('.g-next');
    this.carousel = new Carousel(this.track, (i) => this.#update(i));
    this.prev.onclick = () => this.carousel.goTo(this.carousel.index - 1);
    this.next.onclick = () => this.carousel.goTo(this.carousel.index + 1);
    this.dots.onclick = (e) => {
      const b = e.target.closest('button');
      if (b) this.carousel.goTo(+b.dataset.i);
    };
    this.track.addEventListener('click', (e) => {
      const s = e.target.closest('.g-slide');
      if (s) onOpen(+s.dataset.i);
    });
  }

  set(images, title = '') {
    const n = (this.n = images.length);
    this.root.hidden = !n;
    this.root.classList.toggle('single', n < 2);
    this.track.innerHTML = images
      .map((src, j) => `<button class="g-slide" data-i="${j}" aria-label="Agrandir la photo ${j + 1} sur ${n}">
          <img src="${src}" alt="${esc(title)} · photo ${j + 1}" draggable="false"${j ? ' loading="lazy"' : ''} decoding="async">
          <span class="g-zoom" aria-hidden="true"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3.5h4.5V8M8 16.5H3.5V12M16.5 3.5l-5 5M3.5 16.5l5-5"/></svg></span>
        </button>`)
      .join('');
    this.dots.innerHTML = n > 1 ? images.map((_, j) => `<button data-i="${j}" aria-label="Photo ${j + 1}"><i></i></button>`).join('') : '';
    this.track.scrollLeft = 0;
    this.carousel.sync(true);
  }

  show(i) { this.carousel.goTo(i, 'auto'); }

  #update(i) {
    this.count.textContent = `${pad(i + 1)} / ${pad(this.n)}`;
    this.dots.querySelectorAll('button').forEach((b, j) => b.toggleAttribute('aria-current', j === i));
    this.prev.disabled = i === 0;
    this.next.disabled = i >= this.n - 1;
  }
}

// ---------- full-screen viewer ----------
// requestClose lets the page tie closing to the history (the phone's back button closes the photos, not the product)
export class Lightbox {
  constructor(el, { requestClose, onClose }) {
    this.el = el;
    this.requestClose = requestClose;
    this.onClose = onClose;
    this.track = el.querySelector('.lb-track');
    this.thumbs = el.querySelector('.lb-thumbs');
    this.count = el.querySelector('.lb-count');
    this.prev = el.querySelector('.lb-prev');
    this.next = el.querySelector('.lb-next');
    this.closeBtn = el.querySelector('.lb-close');
    this.carousel = new Carousel(this.track, (i) => this.#update(i));

    this.closeBtn.onclick = () => this.requestClose();
    this.prev.onclick = () => this.carousel.goTo(this.carousel.index - 1);
    this.next.onclick = () => this.carousel.goTo(this.carousel.index + 1);
    this.thumbs.onclick = (e) => {
      const b = e.target.closest('button');
      if (b) this.carousel.goTo(+b.dataset.i);
    };
    // a tap around the photo closes, a tap on it doesn't
    this.track.addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') this.requestClose(); });
    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'ArrowLeft') this.carousel.goTo(this.carousel.index - 1);
      else if (e.key === 'ArrowRight') this.carousel.goTo(this.carousel.index + 1);
      else if (e.key === 'Tab') this.#trapFocus(e);
    });
    this.#swipeDown();
  }

  get isOpen() { return this.el.classList.contains('open'); }

  open(images, i = 0, title = '') {
    const n = (this.n = images.length);
    this.el.classList.toggle('single', n < 2);
    this.el.style.removeProperty('--fade');
    this.track.innerHTML = images
      .map((src, j) => `<figure><img src="${src}" alt="${esc(title)} · photo ${j + 1} sur ${n}" draggable="false" decoding="async"></figure>`)
      .join('');
    this.thumbs.innerHTML = n > 1
      ? images.map((src, j) => `<button data-i="${j}" aria-label="Photo ${j + 1}"><img src="${src}" alt="" draggable="false" decoding="async"></button>`).join('')
      : '';
    this.returnFocus = document.activeElement;
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
    this.carousel.goTo(i, 'auto');
    this.closeBtn.focus({ preventScroll: true });
  }

  hide() {
    if (!this.isOpen) return;
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
    this.onClose?.(this.carousel.index);
    this.returnFocus?.focus?.({ preventScroll: true });
  }

  #update(i) {
    this.count.textContent = `${pad(i + 1)} / ${pad(this.n)}`;
    this.prev.disabled = i === 0;
    this.next.disabled = i >= this.n - 1;
    const on = this.thumbs.children[i];
    this.thumbs.querySelectorAll('button').forEach((b) => b.toggleAttribute('aria-current', b === on));
    if (on) this.thumbs.scrollTo({ left: on.offsetLeft - (this.thumbs.clientWidth - on.offsetWidth) / 2, behavior: behavior() });
  }

  #trapFocus(e) {
    const f = [...this.el.querySelectorAll('button:not(:disabled)')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  }

  // touch: pull the photo up or down to close, the backdrop fades with the distance. Sideways stays the native swipe
  // (the track only lets the browser pan horizontally, so vertical moves come to us).
  #swipeDown() {
    const t = this.track;
    let id = null, x0 = 0, y0 = 0, dy = 0, mode = null, fig = null;
    t.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || id !== null) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dy = 0; mode = null;
    });
    t.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0;
      dy = e.clientY - y0;
      if (!mode && Math.hypot(dx, dy) > 10) mode = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
      if (mode !== 'y') return;
      fig = this.track.children[this.carousel.index];
      fig.style.transition = 'none';
      fig.style.transform = `translateY(${dy}px) scale(${1 - Math.min(Math.abs(dy) / 1600, 0.12)})`;
      this.el.style.setProperty('--fade', 1 - Math.min(Math.abs(dy) / 450, 0.75));
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (mode !== 'y' || !fig) return;
      fig.style.transition = 'transform 0.45s var(--ease)';
      if (Math.abs(dy) > 90) {
        fig.style.transform = `translateY(${Math.sign(dy) * 40}vh) scale(0.9)`;
        this.requestClose();
      } else {
        fig.style.transform = '';
        this.el.style.removeProperty('--fade');
      }
      fig = null;
    };
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
  }
}
