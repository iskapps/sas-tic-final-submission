(function () {
  const cfg = window.SAS_SUBMISSION;
  if (!cfg) return;

  const context = document.getElementById("task1-context");
  if (context && cfg.task1?.context) context.textContent = cfg.task1.context;

  const ai = document.getElementById("ai-note");
  if (ai && cfg.aiNote) ai.textContent = cfg.aiNote;

  const shell = document.getElementById("task1-media");
  const placeholder = document.getElementById("task1-placeholder");
  if (!shell) return;

  const embed = (cfg.task1 && cfg.task1.videoEmbedUrl || "").trim();
  const file = (cfg.task1 && cfg.task1.videoFile || "").trim();

  if (embed) {
    shell.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.src = embed;
    iframe.title = cfg.task1.title || "PD video";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    shell.appendChild(iframe);
  } else if (file) {
    shell.innerHTML = "";
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.src = file;
    video.title = cfg.task1.title || "PD video";
    shell.appendChild(video);
  } else if (placeholder && cfg.task1?.videoNote) {
    const note = placeholder.querySelector("p");
    if (note) note.textContent = cfg.task1.videoNote;
  }
})();
