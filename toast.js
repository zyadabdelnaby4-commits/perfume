function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let icon = "✨";
  if (type === "success") icon = "✓";
  if (type === "error") icon = "✕";

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" type="button" aria-label="إغلاق">&times;</button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("toast-show");
  });

  const closeBtn = toast.querySelector(".toast-close");
  let dismissTimeout;

  const dismiss = () => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
    toast.addEventListener("transitionend", () => {
      toast.remove();
    });
  };

  closeBtn.addEventListener("click", () => {
    clearTimeout(dismissTimeout);
    dismiss();
  });

  // Auto-dismiss after 3 seconds
  dismissTimeout = setTimeout(dismiss, 3000);
}

// Expose globally for other scripts
window.showToast = showToast;
