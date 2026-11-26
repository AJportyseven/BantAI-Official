(function () {
  'use strict';
  var triggers = document.querySelectorAll('[data-dp-open]');
  if (!triggers.length) return;
  var dlg = document.getElementById('dp-dialog');
  var img = document.getElementById('dp-dialog-img');
  var title = document.getElementById('dp-dialog-title');
  var closeBtn = dlg ? dlg.querySelector('[data-dp-close]') : null;
  var scroller = dlg ? dlg.querySelector('.dp-dialog-scroll') : null;
  var supported = !!(dlg && img && title && closeBtn && scroller && typeof dlg.showModal === 'function');
  var last = null;

  function open(btn) {
    var thumb = btn.querySelector('img');
    if (!thumb) return;
    if (!supported) { window.open(thumb.getAttribute('src'), '_blank', 'noopener'); return; }
    last = btn;
    img.src = thumb.getAttribute('src');
    img.alt = thumb.getAttribute('alt') || '';
    title.textContent = btn.getAttribute('data-title') || 'Setup drawing';
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
    dlg.showModal();
  }
  function close() { if (dlg.open) dlg.close(); }

  Array.prototype.forEach.call(triggers, function (b) {
    b.addEventListener('click', function () { open(b); });
  });
  if (!supported) return;
  closeBtn.addEventListener('click', close);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  dlg.addEventListener('close', function () {
    if (last && last.focus) last.focus({ preventScroll: true });
  });
})();
