/* Projects carousel: three cards on a ring, turned by drag, keys, or buttons.
   Without JS, or with reduced motion on, the page stays a plain stacked list. */
(function () {
  var root = document.querySelector('.carousel');
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var stage = root.querySelector('.carousel-stage');
  var ring = root.querySelector('.carousel-ring');
  var cards = Array.prototype.slice.call(root.querySelectorAll('.project'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.carousel-dot'));
  var controls = root.querySelector('.carousel-controls');
  var count = cards.length;

  var STIFFNESS = 90, DAMPING = 14;      // spring settle
  var pos = -2, vel = 0, target = 0;     // measured in cards; starts mid-turn for the intro
  var radius = 0, front = -1, frame = 0, last = 0;
  var drag = null, justDragged = false;

  root.classList.add('is-live');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carousel');
  root.setAttribute('aria-label', 'Projects');
  controls.hidden = false;
  cards.forEach(function (card, i) {
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', (i + 1) + ' of ' + count);
  });

  function measure() {
    var width = ring.offsetWidth;
    radius = width * 0.8;
    stage.style.perspective = width * 2.6 + 'px';
    render();
  }

  function render() {
    cards.forEach(function (card, i) {
      var offset = (((i - pos) % count) + count) % count;
      if (offset > count / 2) offset -= count;
      var angle = offset / count * Math.PI * 2;
      var sin = Math.sin(angle), cos = Math.cos(angle);
      var x = sin * radius;
      var z = (cos - 1) * radius * 0.9;
      var turn = -sin * 50;              // face inward, and square up again at the back
      card.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,' + z.toFixed(1) + 'px) rotateY(' + turn.toFixed(2) + 'deg)';
      card.style.opacity = (0.18 + 0.82 * Math.pow((cos + 1) / 2, 0.6)).toFixed(3);
    });
    var nearest = (((Math.round(pos) % count) + count) % count);
    if (nearest !== front) {
      front = nearest;
      cards.forEach(function (card, i) { card.inert = i !== front; });
      dots.forEach(function (dot, i) {
        if (i === front) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }
  }

  function tick(now) {
    var dt = Math.min((now - last) / 1000, 0.032);
    last = now;
    if (!drag) {
      vel += (STIFFNESS * (target - pos) - DAMPING * vel) * dt;
      pos += vel * dt;
      if (Math.abs(target - pos) < 0.0006 && Math.abs(vel) < 0.002) {
        pos = target; vel = 0; frame = 0;
        render();
        return;
      }
    }
    render();
    frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function goTo(next) { target = next; wake(); }
  function step(by) { goTo(target + by); }

  /* ---- buttons and keys ---- */
  root.querySelector('.carousel-prev').addEventListener('click', function () { step(-1); });
  root.querySelector('.carousel-next').addEventListener('click', function () { step(1); });
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      var from = ((target % count) + count) % count;
      var by = i - from;
      if (by > count / 2) by -= count;
      if (by < -count / 2) by += count;
      step(by);
    });
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  });

  /* ---- drag or swipe; a click beside the front card turns to that side ---- */
  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, pos: pos, moved: false, lastX: e.clientX, lastT: e.timeStamp, speed: 0 };
    wake();
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; stage.setPointerCapture(e.pointerId); root.classList.add('is-dragging'); }
    var span = ring.offsetWidth * 1.1;
    pos = drag.pos - dx / span;
    var dtMs = e.timeStamp - drag.lastT;
    if (dtMs > 0) drag.speed = -(e.clientX - drag.lastX) / span / (dtMs / 1000);
    drag.lastX = e.clientX; drag.lastT = e.timeStamp;
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var moved = drag.moved, speed = drag.speed, startPos = drag.pos;
    drag = null;
    root.classList.remove('is-dragging');
    if (moved) {
      justDragged = true;
      vel = speed;
      var base = Math.round(startPos);
      var landing = Math.round(pos + speed * 0.18);
      target = Math.max(base - 1, Math.min(base + 1, landing));
    } else if (e.type === 'pointerup') {
      var box = cards[front].getBoundingClientRect();
      if (e.clientX < box.left) target -= 1;
      else if (e.clientX > box.right) target += 1;
    }
    wake();
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('click', function (e) {     // a drag that ends on a link isn't a click
    if (justDragged) { e.preventDefault(); e.stopPropagation(); justDragged = false; }
  }, true);

  /* ---- slight tilt toward the cursor ---- */
  if (matchMedia('(hover: hover)').matches) {
    root.addEventListener('pointermove', function (e) {
      if (drag) return;
      var box = root.getBoundingClientRect();
      var tx = ((e.clientX - box.left) / box.width - 0.5) * 5;
      var ty = ((e.clientY - box.top) / box.height - 0.5) * -3;
      ring.style.transform = 'rotateX(' + ty.toFixed(2) + 'deg) rotateY(' + tx.toFixed(2) + 'deg)';
    });
    root.addEventListener('pointerleave', function () { ring.style.transform = ''; });
  }

  addEventListener('resize', measure);
  measure();
  wake();
})();
