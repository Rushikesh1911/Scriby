document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  const pagesList = document.getElementById('pagesList');
  const newPageBtn = document.getElementById('newPageBtn');
  const pageTitle = document.getElementById('pageTitle');
  const editor = document.getElementById('editor');
  const searchInput = document.getElementById('searchInput');
  const toolbar = document.getElementById('editorToolbar');
  const savingIndicator = document.getElementById('savingIndicator');
  const profileBtn = document.getElementById('profileBtn');
  const profileDropdown = document.getElementById('profileDropdown');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const collapseSidebarBtn = document.getElementById('collapseSidebarBtn');
  const exportBtn = document.getElementById('exportBtn');
  const historyBtn = document.getElementById('historyBtn');
  const historyModal = document.getElementById('historyModal');
  const historyList = document.getElementById('historyList');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearFormattingBtn = document.getElementById('clearFormattingBtn');
  const appNameInput = document.getElementById('appName');

  // --- Persistence ---
  const DB_KEY = "scriby-data";
  let data = JSON.parse(localStorage.getItem(DB_KEY)) || {
    appName: "Scriby",
    pages: [{ id: Date.now(), title: "Welcome", content: "", history: [], historyIndex: 0 }],
    currentPage: 0,
    theme: "light"
  };
  function save() {
    savingIndicator.style.display = 'inline';
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    clearTimeout(save._t);
    save._t = setTimeout(() => {
      savingIndicator.style.display = 'none';
    }, 600);
  }

  // --- Theme ---
  function setTheme(theme) {
    body.classList.remove("light", "dark");
    body.classList.add(theme);
    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    data.theme = theme;
    save();
  }
  themeToggle.onclick = () => setTheme(body.classList.contains("dark") ? "light" : "dark");
  setTheme(data.theme || "light");

  // --- Sidebar Toggle (mobile) ---
  sidebarToggle.onclick = () => sidebar.classList.toggle("open");

  // --- Sidebar Collapse/Expand ---
  if (collapseSidebarBtn) {
    collapseSidebarBtn.onclick = () => {
      sidebar.classList.toggle('collapsed');
      body.classList.toggle('sidebar-collapsed');
    };
  }

  // --- Profile Dropdown ---
  if (profileBtn && profileDropdown) {
    profileBtn.onclick = (e) => {
      e.stopPropagation();
      profileBtn.parentElement.classList.toggle('open');
    };
    document.addEventListener('click', () => {
      profileBtn.parentElement.classList.remove('open');
    });
    profileDropdown.onclick = e => e.stopPropagation();
    // Settings/Logout placeholder
    document.getElementById('settingsBtn').onclick = () => alert('Settings coming soon!');
    document.getElementById('logoutBtn').onclick = () => alert('Logout coming soon!');
  }

  // --- Pages ---
  // --- Toast Notifications ---
  function showToast(msg, duration = 2000) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // --- Debounced Autosave ---
  function saveDebounced() {
    clearTimeout(saveDebounced._t);
    saveDebounced._t = setTimeout(() => {
      save();
      showToast('All changes saved');
    }, 400);
  }

  // --- Block-based Editor ---
  function renderBlocks() {
    const page = data.pages[data.currentPage];
    if (!page.blocks) {
      // Migrate from old content
      page.blocks = page.content
        ? page.content.split('\n').map(line => ({ type: 'text', html: line }))
        : [{ type: 'text', html: '' }];
    }
    editor.innerHTML = '';
    page.blocks.forEach((block, idx) => {
      const div = document.createElement('div');
      div.className = 'editor-block';
      div.contentEditable = true;
      div.dataset.idx = idx;
      div.innerHTML = block.html;
      // Drag & drop for blocks
      div.draggable = true;
      div.addEventListener('dragstart', e => {
        div.classList.add('dragging');
        div._dragIndex = idx;
      });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      div.addEventListener('dragover', e => e.preventDefault());
      div.addEventListener('drop', e => {
        e.preventDefault();
        const from = div._dragIndex;
        const to = idx;
        if (from !== undefined && from !== to) {
          const moved = page.blocks.splice(from, 1)[0];
          page.blocks.splice(to, 0, moved);
          saveDebounced();
          renderBlocks();
        }
      });
      // Inline editing
      div.oninput = () => {
        page.blocks[idx].html = div.innerHTML;
        saveDebounced();
      };
      // Keyboard: Enter to add block, Backspace on empty to remove
      div.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          page.blocks.splice(idx + 1, 0, { type: 'text', html: '' });
          saveDebounced();
          renderBlocks();
          setTimeout(() => {
            editor.children[idx + 1]?.focus();
          });
        } else if (e.key === 'Backspace' && div.textContent === '') {
          if (page.blocks.length > 1) {
            page.blocks.splice(idx, 1);
            saveDebounced();
            renderBlocks();
            setTimeout(() => {
              editor.children[Math.max(0, idx - 1)]?.focus();
            });
          }
        }
      };
      editor.appendChild(div);
    });
  }
  newPageBtn.onclick = () => {
    // Generate unique page name
    let base = "Untitled";
    let count = 1;
    let name = base;
    while (data.pages.some(p => p.title === name)) {
      name = `${base} ${++count}`;
    }
    data.pages.push({ id: Date.now(), title: name, content: "", history: [], historyIndex: 0 });
    data.currentPage = data.pages.length - 1;
    save(); render();
  };

  // --- App Name (Workspace Name) ---
  if (appNameInput) {
    appNameInput.value = data.appName || "Scriby";
    appNameInput.oninput = () => {
      data.appName = appNameInput.value.trim() || "Scriby";
      save();
    };
  }

  // --- Search ---
  searchInput.oninput = () => {
    renderPages(searchInput.value);
    const val = searchInput.value.trim();
    if (!val) return;
    // Highlight in editor blocks
    Array.from(editor.children).forEach(div => {
      div.innerHTML = div.innerHTML.replace(/<mark class="search-highlight">|<\/mark>/g, '');
      if (val) {
        div.innerHTML = div.innerHTML.replace(
          new RegExp(val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          match => `<mark class="search-highlight">${match}</mark>`
        );
      }
    });
  };

  // --- Page Title ---
  pageTitle.oninput = () => {
    data.pages[data.currentPage].title = pageTitle.value;
    save(); renderPages(searchInput.value);
  };

  // --- Editor Version History ---
  function saveVersion() {
    const page = data.pages[data.currentPage];
    if (!page.history) page.history = [];
    if (!page.history.length || page.history[page.history.length - 1].content !== page.content) {
      page.history.push({ content: page.content, ts: Date.now() });
      if (page.history.length > 50) page.history.shift();
    }
    page.historyIndex = page.history.length - 1;
  }
  editor.oninput = () => {
    data.pages[data.currentPage].content = editor.innerHTML;
    saveVersion();
    save();
  };

  // --- Editor Toolbar (Rich Text/Markdown) ---
  if (toolbar) {
    toolbar.onclick = e => {
      if (e.target.tagName !== "BUTTON") return;
      const cmd = e.target.dataset.cmd;
      const value = e.target.dataset.value || null;
      // Block-based: apply to focused block
      const sel = document.getSelection();
      const block = sel && sel.anchorNode && sel.anchorNode.parentElement?.classList.contains('editor-block')
        ? sel.anchorNode.parentElement
        : editor.querySelector('.editor-block:focus');
      if (!block) return;
      block.focus();
      if (cmd === "insertCheckbox") {
        document.execCommand("insertHTML", false, '<input type="checkbox" /> ');
      } else if (cmd === "insertCodeBlock") {
        document.execCommand("formatBlock", false, "PRE");
      } else if (cmd === "blockquote") {
        document.execCommand("formatBlock", false, "BLOCKQUOTE");
      } else if (cmd === "clearFormatting") {
        document.execCommand("removeFormat", false, null);
      } else {
        document.execCommand(cmd, false, value);
      }
      // Save block content
      const idx = block.dataset.idx;
      data.pages[data.currentPage].blocks[idx].html = block.innerHTML;
      saveDebounced();
    };
  }
  if (clearFormattingBtn) {
    clearFormattingBtn.onclick = () => {
      const block = document.activeElement;
      if (block && block.classList.contains('editor-block')) {
        document.execCommand("removeFormat", false, null);
        const idx = block.dataset.idx;
        data.pages[data.currentPage].blocks[idx].html = block.innerHTML;
        saveDebounced();
      }
    };
  }

  // --- Fullscreen ---
  if (fullscreenBtn) {
    fullscreenBtn.onclick = () => {
      document.querySelector('.main-content').classList.toggle('fullscreen');
    };
  }

  // --- Export Page as Markdown ---
  if (exportBtn) {
    exportBtn.onclick = () => {
      const page = data.pages[data.currentPage];
      // Simple HTML to Markdown conversion (basic)
      let html = page.content;
      html = html.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n');
      html = html.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n');
      html = html.replace(/<b>(.*?)<\/b>/gi, '**$1**');
      html = html.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
      html = html.replace(/<i>(.*?)<\/i>/gi, '*$1*');
      html = html.replace(/<em>(.*?)<\/em>/gi, '*$1*');
      html = html.replace(/<u>(.*?)<\/u>/gi, '_$1_');
      html = html.replace(/<ul>([\s\S]*?)<\/ul>/gi, (m, c) => c.replace(/<li>(.*?)<\/li>/g, '- $1') + '\n');
      html = html.replace(/<ol>([\s\S]*?)<\/ol>/gi, (m, c) => c.replace(/<li>(.*?)<\/li>/g, (m2, c2, idx) => `${idx + 1}. ${c2}`) + '\n');
      html = html.replace(/<pre>(.*?)<\/pre>/gi, '```\n$1\n```');
      html = html.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1');
      html = html.replace(/<[^>]+>/g, ''); // strip other tags
      const blob = new Blob([html], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (page.title || "scriby-note") + ".md";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }

  // --- Version History Modal ---
  if (historyBtn && historyModal && historyList && closeHistoryBtn) {
    historyBtn.onclick = () => {
      historyList.innerHTML = "";
      const page = data.pages[data.currentPage];
      if (!page.history) return;
      page.history.forEach((h, i) => {
        const li = document.createElement("li");
        const date = new Date(h.ts).toLocaleString();
        li.textContent = `Version ${i + 1} – ${date}`;
        li.onclick = () => {
          if (confirm("Restore this version?")) {
            page.content = h.content;
            page.historyIndex = i;
            editor.innerHTML = page.content;
            save();
            historyModal.style.display = "none";
          }
        };
        historyList.appendChild(li);
      });
      historyModal.style.display = "flex";
    };
    closeHistoryBtn.onclick = () => {
      historyModal.style.display = "none";
    };
    historyModal.onclick = e => {
      if (e.target === historyModal) historyModal.style.display = "none";
    };
  }

  // --- Keyboard Shortcuts (Bold/Italic/Underline) ---
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === "b") {
      document.execCommand("bold");
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === "i") {
      document.execCommand("italic");
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === "u") {
      document.execCommand("underline");
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === "n") { newPageBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "p") { searchInput.focus(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "z") { document.execCommand("undo"); e.preventDefault(); }
    if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "z"))) { document.execCommand("redo"); e.preventDefault(); }
    if (e.ctrlKey && e.key === "s") { save(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "m") { setTheme(body.classList.contains("dark") ? "light" : "dark"); e.preventDefault(); }
    if (e.ctrlKey && e.key === "f") { searchInput.focus(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "e") { if (exportBtn) exportBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "h") { if (historyBtn) historyBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "l") { if (collapseSidebarBtn) collapseSidebarBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "u") {
      if (clearFormattingBtn) clearFormattingBtn.click();
      e.preventDefault();
    }
  });

  // --- Sidebar: Duplicate Page & Nesting (basic) ---
  function renderPages(filter = "") {
    pagesList.innerHTML = "";
    data.pages.forEach((p, i) => {
      if (filter && !p.title.toLowerCase().includes(filter.toLowerCase())) return;
      const li = document.createElement("li");
      li.textContent = p.title || "Untitled";
      li.className = i === data.currentPage ? "active" : "";
      li.tabIndex = 0;
      li.draggable = true;
      li.onclick = () => { data.currentPage = i; save(); render(); };
      // Delete button
      const del = document.createElement("button");
      del.className = "delete-page-btn";
      del.textContent = "🗑";
      del.onclick = (e) => {
        e.stopPropagation();
        if (data.pages.length === 1) return;
        data.pages.splice(i, 1);
        if (data.currentPage >= data.pages.length) data.currentPage = data.pages.length - 1;
        save(); render();
      };
      li.appendChild(del);
      // Duplicate button
      const dup = document.createElement("button");
      dup.className = "duplicate-page-btn";
      dup.textContent = "⧉";
      dup.onclick = (e) => {
        e.stopPropagation();
        // Deep copy page
        const copy = JSON.parse(JSON.stringify(p));
        copy.id = Date.now();
        copy.title = p.title + " (Copy)";
        data.pages.splice(i + 1, 0, copy);
        data.currentPage = i + 1;
        save(); render();
        showToast('Page duplicated');
      };
      li.appendChild(dup);
      // Nesting (basic, no UI for moving yet)
      if (p.parentId) li.classList.add('nested');
      // Inline rename
      li.ondblclick = () => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = p.title;
        input.onblur = () => {
          p.title = input.value.trim() || "Untitled";
          save(); renderPages(filter);
        };
        input.onkeydown = e => {
          if (e.key === "Enter") input.blur();
        };
        li.textContent = "";
        li.appendChild(input);
        input.focus();
        input.select();
        li.appendChild(del);
      };
      // Drag & drop
      li.addEventListener('dragstart', () => {
        li.classList.add('dragging');
        li._dragIndex = i;
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
      });
      li.addEventListener('dragover', e => e.preventDefault());
      li.addEventListener('drop', e => {
        e.preventDefault();
        const from = li._dragIndex;
        const to = i;
        if (from !== undefined && from !== to) {
          const moved = data.pages.splice(from, 1)[0];
          data.pages.splice(to, 0, moved);
          data.currentPage = to;
          save();
          render();
        }
      });
      pagesList.appendChild(li);
    });
    // Scroll indicator
    if (pagesList.scrollHeight > pagesList.clientHeight) {
      pagesList.style.boxShadow = "inset 0 -8px 8px -8px #0002";
    } else {
      pagesList.style.boxShadow = "none";
    }
  }
  newPageBtn.onclick = () => {
    // Generate unique page name
    let base = "Untitled";
    let count = 1;
    let name = base;
    while (data.pages.some(p => p.title === name)) {
      name = `${base} ${++count}`;
    }
    data.pages.push({ id: Date.now(), title: name, content: "", history: [], historyIndex: 0 });
    data.currentPage = data.pages.length - 1;
    save(); render();
  };

  // --- Search ---
  searchInput.oninput = () => {
    renderPages(searchInput.value);
    const val = searchInput.value.trim();
    if (!val) return;
    // Highlight in editor blocks
    Array.from(editor.children).forEach(div => {
      div.innerHTML = div.innerHTML.replace(/<mark class="search-highlight">|<\/mark>/g, '');
      if (val) {
        div.innerHTML = div.innerHTML.replace(
          new RegExp(val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          match => `<mark class="search-highlight">${match}</mark>`
        );
      }
    });
  };

  // --- Page Title ---
  pageTitle.oninput = () => {
    data.pages[data.currentPage].title = pageTitle.value;
    save(); renderPages(searchInput.value);
  };

  // --- Editor Version History ---
  function saveVersion() {
    const page = data.pages[data.currentPage];
    if (!page.history) page.history = [];
    if (!page.history.length || page.history[page.history.length - 1].content !== page.content) {
      page.history.push({ content: page.content, ts: Date.now() });
      if (page.history.length > 50) page.history.shift();
    }
    page.historyIndex = page.history.length - 1;
  }
  editor.oninput = () => {
    data.pages[data.currentPage].content = editor.innerHTML;
    saveVersion();
    save();
  };

  // --- Editor Toolbar (Rich Text/Markdown) ---
  if (toolbar) {
    toolbar.onclick = e => {
      if (e.target.tagName !== "BUTTON") return;
      const cmd = e.target.dataset.cmd;
      const value = e.target.dataset.value || null;
      // Block-based: apply to focused block
      const sel = document.getSelection();
      const block = sel && sel.anchorNode && sel.anchorNode.parentElement?.classList.contains('editor-block')
        ? sel.anchorNode.parentElement
        : editor.querySelector('.editor-block:focus');
      if (!block) return;
      block.focus();
      if (cmd === "insertCheckbox") {
        document.execCommand("insertHTML", false, '<input type="checkbox" /> ');
      } else if (cmd === "insertCodeBlock") {
        document.execCommand("formatBlock", false, "PRE");
      } else if (cmd === "blockquote") {
        document.execCommand("formatBlock", false, "BLOCKQUOTE");
      } else if (cmd === "clearFormatting") {
        document.execCommand("removeFormat", false, null);
      } else {
        document.execCommand(cmd, false, value);
      }
      // Save block content
      const idx = block.dataset.idx;
      data.pages[data.currentPage].blocks[idx].html = block.innerHTML;
      saveDebounced();
    };
  }
  if (clearFormattingBtn) {
    clearFormattingBtn.onclick = () => {
      const block = document.activeElement;
      if (block && block.classList.contains('editor-block')) {
        document.execCommand("removeFormat", false, null);
        const idx = block.dataset.idx;
        data.pages[data.currentPage].blocks[idx].html = block.innerHTML;
        saveDebounced();
      }
    };
  }

  // --- Fullscreen ---
  if (fullscreenBtn) {
    fullscreenBtn.onclick = () => {
      document.querySelector('.main-content').classList.toggle('fullscreen');
    };
  }

  // --- Export Page as Markdown ---
  if (exportBtn) {
    exportBtn.onclick = () => {
      const page = data.pages[data.currentPage];
      // Simple HTML to Markdown conversion (basic)
      let html = page.content;
      html = html.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n');
      html = html.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n');
      html = html.replace(/<b>(.*?)<\/b>/gi, '**$1**');
      html = html.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
      html = html.replace(/<i>(.*?)<\/i>/gi, '*$1*');
      html = html.replace(/<em>(.*?)<\/em>/gi, '*$1*');
      html = html.replace(/<u>(.*?)<\/u>/gi, '_$1_');
      html = html.replace(/<ul>([\s\S]*?)<\/ul>/gi, (m, c) => c.replace(/<li>(.*?)<\/li>/g, '- $1') + '\n');
      html = html.replace(/<ol>([\s\S]*?)<\/ol>/gi, (m, c) => c.replace(/<li>(.*?)<\/li>/g, (m2, c2, idx) => `${idx + 1}. ${c2}`) + '\n');
      html = html.replace(/<pre>(.*?)<\/pre>/gi, '```\n$1\n```');
      html = html.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1');
      html = html.replace(/<[^>]+>/g, ''); // strip other tags
      const blob = new Blob([html], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (page.title || "scriby-note") + ".md";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }

  // --- Version History Modal ---
  if (historyBtn && historyModal && historyList && closeHistoryBtn) {
    historyBtn.onclick = () => {
      historyList.innerHTML = "";
      const page = data.pages[data.currentPage];
      if (!page.history) return;
      page.history.forEach((h, i) => {
        const li = document.createElement("li");
        const date = new Date(h.ts).toLocaleString();
        li.textContent = `Version ${i + 1} – ${date}`;
        li.onclick = () => {
          if (confirm("Restore this version?")) {
            page.content = h.content;
            page.historyIndex = i;
            editor.innerHTML = page.content;
            save();
            historyModal.style.display = "none";
          }
        };
        historyList.appendChild(li);
      });
      historyModal.style.display = "flex";
    };
    closeHistoryBtn.onclick = () => {
      historyModal.style.display = "none";
    };
    historyModal.onclick = e => {
      if (e.target === historyModal) historyModal.style.display = "none";
    };
  }

  // --- Keyboard Shortcuts (Advanced) ---
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === "b") {
      document.execCommand("bold");
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === "i") {
      document.execCommand("italic");
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === "u") {
      document.execCommand("underline");
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === "n") { newPageBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "p") { searchInput.focus(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "z") { document.execCommand("undo"); e.preventDefault(); }
    if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "z"))) { document.execCommand("redo"); e.preventDefault(); }
    if (e.ctrlKey && e.key === "s") { save(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "m") { setTheme(body.classList.contains("dark") ? "light" : "dark"); e.preventDefault(); }
    if (e.ctrlKey && e.key === "f") { searchInput.focus(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "e") { if (exportBtn) exportBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "h") { if (historyBtn) historyBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "l") { if (collapseSidebarBtn) collapseSidebarBtn.click(); e.preventDefault(); }
    if (e.ctrlKey && e.key === "u") {
      if (clearFormattingBtn) clearFormattingBtn.click();
      e.preventDefault();
    }
  });

  // --- Main Render ---
  function render() {
    renderPages(searchInput.value);
    const page = data.pages[data.currentPage];
    pageTitle.value = page.title;
    // Block-based
    renderBlocks();
    // Restore history index if missing
    if (!page.history) page.history = [{ content: page.content, ts: Date.now() }];
    if (typeof page.historyIndex !== "number") page.historyIndex = page.history.length - 1;
    if (appNameInput) appNameInput.value = data.appName || "Scriby";
  }
  render();
});

