(function () {
  const STORAGE_KEY = "sas-submission-evidence-v1";
  const STEP_IDS = [
    "t1-context",
    "t1-video",
    "t1-toolkit",
    "t2-need",
    "t2-integrate",
    "t2-capacity",
    "t2-impact",
  ];

  const state = {
    editing: false,
    data: { steps: {} },
  };

  STEP_IDS.forEach((id) => {
    state.data.steps[id] = { title: id, items: [] };
  });

  function uid() {
    return "e_" + Math.random().toString(36).slice(2, 10);
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function mergeEvidence(base, overlay) {
    const out = { steps: {} };
    STEP_IDS.forEach((id) => {
      const b = (base && base.steps && base.steps[id]) || { title: id, items: [] };
      const o = (overlay && overlay.steps && overlay.steps[id]) || null;
      out.steps[id] = {
        title: (o && o.title) || b.title || id,
        items: o && Array.isArray(o.items) && o.items.length ? o.items : b.items || [],
      };
    });
    return out;
  }

  async function boot() {
    let fileData = null;
    try {
      const res = await fetch("evidence.json", { cache: "no-store" });
      if (res.ok) fileData = await res.json();
    } catch {
      /* local file open may block fetch */
    }

    const local = loadLocal();
    // Prefer local draft when it has any items; else published evidence.json
    const localHasItems =
      local &&
      local.steps &&
      STEP_IDS.some((id) => (local.steps[id]?.items || []).length > 0);

    state.data = mergeEvidence(fileData, localHasItems ? local : null);
    if (fileData && !localHasItems) saveLocal();

    applyConfig();
    renderAll();
    wireChrome();

    const params = new URLSearchParams(location.search);
    if (params.get("edit") === "1" || location.hash === "#edit") setEditing(true);
  }

  function applyConfig() {
    const cfg = window.SAS_SUBMISSION;
    if (!cfg) return;
    const context = document.getElementById("task1-context");
    if (context && cfg.task1?.context) context.textContent = cfg.task1.context;
    const ai = document.getElementById("ai-note");
    if (ai && cfg.aiNote) ai.textContent = cfg.aiNote;
    renderMainVideo(cfg);
  }

  function youtubeEmbed(url) {
    if (!url) return "";
    const m =
      url.match(/youtu\.be\/([\w-]+)/) ||
      url.match(/[?&]v=([\w-]+)/) ||
      url.match(/youtube\.com\/embed\/([\w-]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }

  function renderMainVideo(cfg) {
    const shell = document.getElementById("task1-media");
    if (!shell) return;

    const fromEvidence = (state.data.steps["t1-video"]?.items || []).find(
      (i) => i.type === "video"
    );
    const embed =
      (fromEvidence && (fromEvidence.embedUrl || youtubeEmbed(fromEvidence.url))) ||
      (cfg?.task1?.videoEmbedUrl || "").trim();
    const file =
      (fromEvidence && fromEvidence.dataUrl && fromEvidence.dataUrl.startsWith("blob:")
        ? fromEvidence.dataUrl
        : "") ||
      (fromEvidence && fromEvidence.dataUrl && fromEvidence.dataUrl.startsWith("data:video")
        ? fromEvidence.dataUrl
        : "") ||
      (cfg?.task1?.videoFile || "").trim();

    if (embed) {
      shell.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = youtubeEmbed(embed);
      iframe.title = "PD video";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      shell.appendChild(iframe);
      return;
    }

    if (file) {
      shell.innerHTML = "";
      const video = document.createElement("video");
      video.controls = true;
      video.src = file;
      video.title = "PD video";
      shell.appendChild(video);
      return;
    }

    shell.innerHTML =
      '<div class="media-placeholder"><strong>PD video</strong><p>Add a YouTube/Drive link or upload a clip in edit mode (≤15 min).</p></div>';
  }

  function setEditing(on) {
    state.editing = !!on;
    document.body.classList.toggle("is-editing", state.editing);
    const btn = document.getElementById("edit-toggle");
    if (btn) btn.textContent = state.editing ? "Editing…" : "Edit evidence";
    renderAll();
  }

  function wireChrome() {
    document.getElementById("edit-toggle")?.addEventListener("click", () => {
      setEditing(!state.editing);
    });
    document.getElementById("exit-edit")?.addEventListener("click", () => setEditing(false));
    document.getElementById("export-evidence")?.addEventListener("click", exportJson);
    document.getElementById("import-evidence")?.addEventListener("click", () => {
      document.getElementById("import-file")?.click();
    });
    document.getElementById("import-file")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          state.data = mergeEvidence(state.data, parsed);
          saveLocal();
          renderAll();
          alert("Imported. Export again after edits, then replace evidence.json on the site.");
        } catch {
          alert("Could not read that JSON file.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  function exportJson() {
    // Strip huge data URLs reminder — keep them; user may want local restore
    const blob = new Blob([JSON.stringify(state.data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "evidence.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderAll() {
    document.querySelectorAll("[data-evidence-for]").forEach((el) => {
      const id = el.getAttribute("data-evidence-for");
      renderEvidencePanel(el, id);
    });
    renderMainVideo(window.SAS_SUBMISSION);
  }

  function renderEvidencePanel(host, stepId) {
    const step = state.data.steps[stepId] || { items: [] };
    const items = step.items || [];

    host.innerHTML = "";

    // Hiring view: hide empty evidence entirely. Edit mode always shows the dock.
    if (!items.length && !state.editing) {
      host.hidden = true;
      return;
    }
    host.hidden = false;

    const label = document.createElement("div");
    label.className = "evidence-label";
    label.innerHTML = "<span>Evidence</span>";
    host.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "evidence-grid";

    if (!items.length && state.editing) {
      const empty = document.createElement("p");
      empty.className = "evidence-empty";
      empty.textContent = "Nothing here yet — add text, a photo, or video below.";
      grid.appendChild(empty);
    }

    items.forEach((item) => {
      grid.appendChild(renderItem(stepId, item));
    });

    host.appendChild(grid);

    if (state.editing) {
      host.appendChild(buildUploadDock(stepId));
    }
  }

  function renderItem(stepId, item) {
    const wrap = document.createElement("div");
    wrap.className = "evidence-item";

    const pill = document.createElement("span");
    pill.className = `type-pill ${item.type}`;
    pill.textContent = item.type;
    wrap.appendChild(pill);

    if (item.type === "text") {
      const p = document.createElement("p");
      p.className = "text-body";
      p.textContent = item.text || "";
      wrap.appendChild(p);
    }

    if (item.type === "photo") {
      const img = document.createElement("img");
      img.src = item.dataUrl || item.url || "";
      img.alt = item.caption || "Evidence photo";
      wrap.appendChild(img);
      if (item.caption) {
        const c = document.createElement("p");
        c.className = "caption";
        c.textContent = item.caption;
        wrap.appendChild(c);
      }
    }

    if (item.type === "video") {
      if (item.dataUrl) {
        const v = document.createElement("video");
        v.controls = true;
        v.src = item.dataUrl;
        wrap.appendChild(v);
      } else if (item.url || item.embedUrl) {
        const link = document.createElement("a");
        link.href = item.url || item.embedUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = item.caption || item.url || "Open video";
        wrap.appendChild(link);
        const embed = youtubeEmbed(item.embedUrl || item.url || "");
        if (embed.includes("youtube.com/embed")) {
          const frame = document.createElement("iframe");
          frame.src = embed;
          frame.title = item.caption || "Video evidence";
          frame.style.width = "100%";
          frame.style.aspectRatio = "16 / 9";
          frame.style.border = "0";
          frame.style.borderRadius = "12px";
          frame.style.marginTop = "0.5rem";
          frame.allowFullscreen = true;
          wrap.appendChild(frame);
        }
      }
      if (item.caption && (item.dataUrl || item.embedUrl)) {
        const c = document.createElement("p");
        c.className = "caption";
        c.textContent = item.caption;
        wrap.appendChild(c);
      }
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.setAttribute("aria-label", "Remove evidence");
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      const list = state.data.steps[stepId].items;
      state.data.steps[stepId].items = list.filter((x) => x.id !== item.id);
      saveLocal();
      renderAll();
    });
    wrap.appendChild(remove);

    return wrap;
  }

  function buildUploadDock(stepId) {
    const dock = document.createElement("div");
    dock.className = "upload-dock";

    const row = document.createElement("div");
    row.className = "row";

    const addTextBtn = button("Add text note", "btn btn-ghost btn-sm", () => {
      textArea.hidden = false;
      textArea.focus();
    });
    const addPhotoBtn = button("Add photo", "btn btn-ghost btn-sm", () => {
      fileInput.accept = "image/*";
      fileInput.dataset.kind = "photo";
      fileInput.click();
    });
    const addVideoFileBtn = button("Upload video file", "btn btn-ghost btn-sm", () => {
      fileInput.accept = "video/*";
      fileInput.dataset.kind = "video";
      fileInput.click();
    });
    const addVideoLinkBtn = button("Paste video link", "btn btn-ghost btn-sm", () => {
      urlRow.hidden = false;
      urlInput.focus();
    });

    row.append(addTextBtn, addPhotoBtn, addVideoFileBtn, addVideoLinkBtn);
    dock.appendChild(row);

    const textArea = document.createElement("textarea");
    textArea.placeholder = "Write a short evidence note for this step…";
    textArea.hidden = true;
    dock.appendChild(textArea);

    const saveText = button("Save text", "btn btn-blue btn-sm", () => {
      const text = textArea.value.trim();
      if (!text) return;
      pushItem(stepId, { id: uid(), type: "text", text });
      textArea.value = "";
      textArea.hidden = true;
    });
    saveText.style.display = "none";
    textArea.addEventListener("input", () => {
      saveText.style.display = textArea.value.trim() ? "inline-flex" : "none";
    });
    dock.appendChild(saveText);

    const urlRow = document.createElement("div");
    urlRow.hidden = true;
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "https://youtube.com/… or Drive link";
    const urlCaption = document.createElement("input");
    urlCaption.type = "text";
    urlCaption.placeholder = "Optional caption";
    const saveUrl = button("Save video link", "btn btn-blue btn-sm", () => {
      const url = urlInput.value.trim();
      if (!url) return;
      pushItem(stepId, {
        id: uid(),
        type: "video",
        url,
        embedUrl: youtubeEmbed(url),
        caption: urlCaption.value.trim(),
      });
      urlInput.value = "";
      urlCaption.value = "";
      urlRow.hidden = true;
    });
    urlRow.append(urlInput, urlCaption, saveUrl);
    dock.appendChild(urlRow);

    const drop = document.createElement("label");
    drop.className = "dropzone";
    const dropText = document.createElement("span");
    dropText.textContent = "Drop a photo or video here, or click to browse";
    const dropHint = document.createElement("small");
    dropHint.textContent =
      "Photos under ~1.5MB stay in the browser draft. Large videos: prefer a link.";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,video/*";
    drop.append(dropText, dropHint, fileInput);
    dock.appendChild(drop);

    const onFiles = (files, kindHint) => {
      const file = files?.[0];
      if (!file) return;
      const kind =
        kindHint ||
        (file.type.startsWith("video") ? "video" : file.type.startsWith("image") ? "photo" : "");
      if (!kind) {
        alert("Please choose an image or video file.");
        return;
      }
      if (kind === "video" && file.size > 12 * 1024 * 1024) {
        const useLink = confirm(
          "That video is large for browser storage. Cancel and paste a YouTube/Drive link instead?\n\nOK = try anyway (may be slow), Cancel = use a link."
        );
        if (!useLink) {
          urlRow.hidden = false;
          return;
        }
      }
      if (kind === "photo" && file.size > 2.5 * 1024 * 1024) {
        alert("Photo is large. Try a smaller export (under ~1.5MB) for a smoother draft.");
      }
      const reader = new FileReader();
      reader.onload = () => {
        pushItem(stepId, {
          id: uid(),
          type: kind,
          dataUrl: String(reader.result),
          caption: file.name,
          mime: file.type,
        });
      };
      reader.readAsDataURL(file);
    };

    fileInput.addEventListener("change", () => {
      onFiles(fileInput.files, fileInput.dataset.kind);
      fileInput.value = "";
      delete fileInput.dataset.kind;
    });

    ["dragenter", "dragover"].forEach((evt) => {
      drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.remove("dragover");
      });
    });
    drop.addEventListener("drop", (e) => onFiles(e.dataTransfer?.files));

    return dock;
  }

  function button(label, className, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function pushItem(stepId, item) {
    if (!state.data.steps[stepId]) state.data.steps[stepId] = { title: stepId, items: [] };
    state.data.steps[stepId].items.push(item);
    saveLocal();
    renderAll();
  }

  boot();
})();
