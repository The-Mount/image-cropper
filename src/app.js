import Pica from 'pica';

const dropArea = document.getElementById("drop-area");
const previewList = document.getElementById("preview-list");
const downloadAllButton = document.querySelector(".download-all");
const resolutionSelect = document.querySelector(".resolution-select");
const resolutionDropdown = document.getElementById("resolution-dropdown");
const applyResolutionButton = document.getElementById("apply-resolution");
const uploadButton = document.getElementById("upload-button");
const fileInput = document.getElementById("file-input");
const customResWidth = document.getElementById("width");
const customResHeight = document.getElementById("height");
const loader = document.querySelector(".loader");
const fileCounter = document.querySelector(".file-counter");
const fileCounterContent = document.querySelector(".file-counter p");
const finishedHeading = document.querySelector(".finished-heading");
let items = [];
let itemIdCounter = 0;
let cropSize = {
  "width": null,
  "height": null
};
let previewTimer = null;
let currentGlobalSize = null;

// Initialize Pica
const pica = Pica();

// Drag and drop events
dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("drag-over");
  handleIncomingFiles(e.dataTransfer.files);
  resolutionSelect.classList.remove('hidden');
  updateFileCounter();
});

uploadButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  handleIncomingFiles(e.target.files);
  fileInput.value = "";
});
resolutionDropdown.addEventListener("change", schedulePreviewUpdate);
customResWidth.addEventListener("input", schedulePreviewUpdate);
customResHeight.addEventListener("input", schedulePreviewUpdate);

function handleIncomingFiles(fileList) {
  Array.from(fileList).forEach(file => {
    addItem(file);
  });
  resolutionSelect.classList.remove('hidden');
  updateFileCounter();
  schedulePreviewUpdate();
}

function handleFiles(cropSize) {
  if (items.length === 0) {
    alert("No images to crop");
    return;
  }
  fileCounterContent.innerText = `Cropping...`;
  loader.classList.remove('hidden');
  resolutionSelect.classList.add('hidden');
  items.forEach(item => {
    const sizeToUse = getItemTargetSize(item, cropSize);
    if (!sizeToUse) return;
    if (item.status === "ready" && item.cropSize &&
        item.cropSize.width === sizeToUse.width &&
        item.cropSize.height === sizeToUse.height) {
      return;
    }
    item.cropSize = { width: sizeToUse.width, height: sizeToUse.height };
    processItem(item);
  });
}

function handleLoader() {
  const processingCount = items.filter(item => item.status === "processing").length;
  if (processingCount === 0) {
    loader.classList.add('hidden');
  }
}

function isImagePlural(files) {
  if (files.length > 1) {
    return "images";
  } else {
    return "image";
  }
}

function handleEnableFileCounter(files) {
  fileCounterContent.innerText = `${files.length} ${isImagePlural(files)} ready for cropping`;
  fileCounter.style.backgroundColor = "#6cc5e9"
  fileCounter.classList.remove("hidden");
}

function handleDisableFileCounter(files) {
  fileCounterContent.innerText = `${files.length} ${isImagePlural(files)} cropped`;
  fileCounter.style.backgroundColor = "#94d600"
}

function updateFileCounter() {
  if (items.length === 0) {
    fileCounter.classList.add("hidden");
    return;
  }
  const readyCount = items.filter(item => item.status === "ready").length;
  const queuedCount = items.filter(item => item.status === "queued").length;
  const pendingCount = items.filter(item => item.status === "pending").length;
  const processingCount = items.filter(item => item.status === "processing").length;
  if (processingCount > 0) {
    fileCounterContent.innerText = `Cropping ${processingCount} ${isImagePlural(items)}`;
    fileCounter.style.backgroundColor = "#6cc5e9";
  } else if (pendingCount > 0) {
    fileCounterContent.innerText = `${pendingCount} ${isImagePlural(items)} ready to apply`;
    fileCounter.style.backgroundColor = "#f9d04a";
  } else if (readyCount > 0) {
    fileCounterContent.innerText = `${readyCount} ${isImagePlural(items)} ready`;
    fileCounter.style.backgroundColor = "#94d600";
  } else {
    fileCounterContent.innerText = `${queuedCount} ${isImagePlural(items)} ready for cropping`;
    fileCounter.style.backgroundColor = "#6cc5e9";
  }
  fileCounter.classList.remove("hidden");
  updateDownloadAllVisibility();
  updateApplyButtonLabel();
}

function processItem(item) {
  setItemState(item, "processing");
  updateFileCounter();
  new Compressor(item.file, {
    quality: 0.8, // Set compression quality (0-1)
    success: (compressedFile) => {
      const reader = new FileReader();
      reader.onload = () => createPreview(reader.result, compressedFile, item);
      reader.readAsDataURL(compressedFile);
    },
    error(err) {
      console.error(`Error compressing ${item.file.name}:`, err);
    }
  });
}

function handleUserEntry() {
  if (resolutionDropdown.value && (customResWidth.value || customResHeight.value)) {
    console.log(Boolean(resolutionDropdown.value));
    
    alert("Please use only the dropdown or a custom size");
  } else if (customResWidth.value && customResHeight.value) {
    cropSize.width = customResWidth.value;
    cropSize.height = customResHeight.value;
    currentGlobalSize = { width: parseInt(cropSize.width, 10), height: parseInt(cropSize.height, 10) };
    handleFiles(cropSize);
  } else if (resolutionDropdown.value) {
    let selectedResolution = resolutionDropdown.value.split("x");
    cropSize.width = parseInt(selectedResolution[0]);
    cropSize.height = parseInt(selectedResolution[1]);
    currentGlobalSize = { width: cropSize.width, height: cropSize.height };
    handleFiles(cropSize);
  } else {
    const hasCustomPending = items.some(item => item.sizeMode === "custom" && item.cropSize);
    if (hasCustomPending) {
      handleFiles(null);
      return;
    }
    alert("Please select a size or enter a custom size.");
  }
}

// Use dropdown selection for resolution when no size in filename
applyResolutionButton.onclick = () => {
  handleUserEntry();
};

// Create preview with Smartcrop for cropping accuracy

function createPreview(imageSrc, file, item) {
  const img = new Image();
  img.src = imageSrc;
  img.onload = () => {
    const useExistingCrop = item.autoCrop &&
      item.autoCropSize &&
      item.autoCropSize.width === item.cropSize.width &&
      item.autoCropSize.height === item.cropSize.height;
    const cropPromise = useExistingCrop
      ? Promise.resolve({ topCrop: item.autoCrop })
      : smartcrop.crop(img, { width: item.cropSize.width, height: item.cropSize.height });

    cropPromise.then(result => {
      const crop = result.topCrop;
      item.autoCrop = crop;
      item.autoCropSize = { width: item.cropSize.width, height: item.cropSize.height };
      item.originalWidth = img.width;
      item.originalHeight = img.height;
      updateItemCropOverlays(item);

      // Create an offscreen canvas to apply the crop
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext("2d");

      // Draw the optimal crop area
      ctx.drawImage(
        img,
        crop.x, crop.y, crop.width, crop.height,  // Source crop area from Smartcrop
        0, 0, canvas.width, canvas.height         // Draw on entire canvas
      );
      

      const downscaleCanvas = document.createElement("canvas");
      downscaleCanvas.width = item.cropSize.width;
      downscaleCanvas.height = item.cropSize.height;

      // Use Pica to resize the cropped image to the target dimensions (cropSize)
      pica.resize(canvas, downscaleCanvas, {
        unsharpAmount: 80,     // Optional: Use unsharp mask for quality
        unsharpThreshold: 100,   // Optional: Set threshold for unsharp mask
        quality: 3,            // Use the best quality option
      }).then(() => {
        // Convert resized canvas to Blob (JPEG format)
        downscaleCanvas.toBlob((blob) => {
          const croppedImageURL = URL.createObjectURL(blob);
          item.blob = blob;
          updateItemPreview(item, croppedImageURL);
          handleLoader();
          updateFileCounter();
        }, "image/jpeg", 0.9);  // Set JPEG quality to 90%
      }).catch((err) => {
        console.error("Error resizing image:", err);
      });
    });
  };
}

function addItem(file) {
  const id = ++itemIdCounter;
  const previewUrl = URL.createObjectURL(file);
  const item = {
    id,
    file,
    previewUrl,
    status: "queued",
    cropSize: null,
    blob: null,
    croppedUrl: null,
    autoCrop: null,
    autoCropSize: null,
    originalWidth: null,
    originalHeight: null,
    sizeMode: "global",
    el: null,
    statusEl: null,
    imgEl: null,
    originalImgEl: null,
    overlayEl: null,
    shadeEls: null,
    cropBoxEl: null,
    thumbWrapEl: null,
    sizeSelectEl: null,
    sizeResetEl: null,
    downloadBtn: null
  };
  items.push(item);
  createListItem(item);
  updateFileCounter();
}

function createListItem(item) {
  const listItem = document.createElement("li");
  listItem.classList.add("queue-item");
  listItem.dataset.id = item.id;
  const thumbWrap = document.createElement("div");
  thumbWrap.classList.add("thumb-wrap");
  const croppedImage = document.createElement("img");
  const originalImage = document.createElement("img");
  const overlay = document.createElement("div");
  const shadeTop = document.createElement("div");
  const shadeRight = document.createElement("div");
  const shadeBottom = document.createElement("div");
  const shadeLeft = document.createElement("div");
  const cropBox = document.createElement("div");
  const imageInfoContainer = document.createElement("div");
  const sizeRow = document.createElement("div");
  const imageNameInfo = document.createElement("p");
  const imageStatus = document.createElement("span");
  const imageSizeDelta = document.createElement("p");
  const statusHelp = document.createElement("p");
  imageInfoContainer.classList.add("image-info");
  imageNameInfo.classList.add("image-name");
  imageStatus.classList.add("image-status");
  imageNameInfo.innerText = item.file.name;
  imageStatus.innerText = "Queued";
  imageSizeDelta.classList.add("image-size-delta");
  statusHelp.classList.add("status-help");
  imageSizeDelta.innerText = `File size: ${formatFileSize(item.file.size)} → `;
  croppedImage.classList.add("thumb-cropped");
  originalImage.classList.add("thumb-original");
  overlay.classList.add("thumb-overlay");
  cropBox.classList.add("thumb-crop-box");
  shadeTop.classList.add("thumb-shade", "shade-top");
  shadeRight.classList.add("thumb-shade", "shade-right");
  shadeBottom.classList.add("thumb-shade", "shade-bottom");
  shadeLeft.classList.add("thumb-shade", "shade-left");
  croppedImage.src = item.previewUrl;
  originalImage.src = item.previewUrl;
  overlay.appendChild(shadeTop);
  overlay.appendChild(shadeRight);
  overlay.appendChild(shadeBottom);
  overlay.appendChild(shadeLeft);
  overlay.appendChild(cropBox);
  thumbWrap.appendChild(croppedImage);
  thumbWrap.appendChild(originalImage);
  thumbWrap.appendChild(overlay);
  imageInfoContainer.appendChild(imageStatus);
  imageInfoContainer.appendChild(imageNameInfo);
  imageInfoContainer.appendChild(statusHelp);
  sizeRow.classList.add("size-row");
  const sizeSelect = buildItemSizeSelect(item);
  const sizeReset = document.createElement("button");
  sizeReset.classList.add("item-size-reset");
  sizeReset.innerText = "Reset";
  sizeReset.disabled = true;
  sizeReset.onclick = () => resetItemSize(item);
  sizeRow.appendChild(sizeSelect);
  sizeRow.appendChild(sizeReset);
  imageInfoContainer.appendChild(sizeRow);
  listItem.appendChild(thumbWrap);
  listItem.appendChild(imageInfoContainer);

  const downloadButton = document.createElement("button");
  downloadButton.classList.add("download-button");
  downloadButton.disabled = true;
  const downloadIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const downloadIconPath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const downloadIconPath2 = document.createElementNS("http://www.w3.org/2000/svg", "path");

  downloadIcon.setAttribute("viewBox", "0 0 29.978 29.978");
  downloadIcon.setAttribute("width", "20");
  downloadIcon.setAttribute("height", "20");
  downloadIconPath1.setAttribute("d", "M25.462,19.105v6.848H4.515v-6.848H0.489v8.861c0,1.111,0.9,2.012,2.016,2.012h24.967c1.115,0,2.016-0.9,2.016-2.012v-8.861H25.462z");
  downloadIconPath2.setAttribute("d","M14.62,18.426l-5.764-6.965c0,0-0.877-0.828,0.074-0.828s3.248,0,3.248,0s0-0.557,0-1.416c0-2.449,0-6.906,0-8.723c0,0-0.129-0.494,0.615-0.494c0.75,0,4.035,0,4.572,0c0.536,0,0.524,0.416,0.524,0.416c0,1.762,0,6.373,0,8.742c0,0.768,0,1.266,0,1.266s1.842,0,2.998,0c1.154,0,0.285,0.867,0.285,0.867s-4.904,6.51-5.588,7.193C15.092,18.979,14.62,18.426,14.62,18.426z");
  downloadIcon.appendChild(downloadIconPath1);
  downloadIcon.appendChild(downloadIconPath2);
  downloadButton.appendChild(downloadIcon);
  downloadButton.onclick = () => downloadImage(item);

  const removeButton = document.createElement("button");
  removeButton.classList.add("remove-button");
  const removeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const removeIconPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  removeIcon.setAttribute("viewBox", "0 0 24 24");
  removeIcon.setAttribute("width", "22");
  removeIcon.setAttribute("height", "22");
  removeIconPath.setAttribute("d", "M6.4 5.3 12 10.9l5.6-5.6 1.1 1.1L13.1 12l5.6 5.6-1.1 1.1L12 13.1l-5.6 5.6-1.1-1.1L10.9 12 5.3 6.4z");
  removeIcon.appendChild(removeIconPath);
  removeButton.appendChild(removeIcon);
  removeButton.setAttribute("aria-label", "Remove image");
  removeButton.title = "Remove image";
  listItem.appendChild(removeButton);
  removeButton.onclick = () => removeItem(item.id);

  const actionsContainer = document.createElement("div");
  actionsContainer.classList.add("item-actions");
  actionsContainer.appendChild(imageSizeDelta);
  actionsContainer.appendChild(downloadButton);
  imageInfoContainer.appendChild(actionsContainer);
  finishedHeading.classList.remove('hidden');

  previewList.appendChild(listItem);
  item.el = listItem;
  item.statusEl = imageStatus;
  item.statusHelpEl = statusHelp;
  item.imgEl = croppedImage;
  item.originalImgEl = originalImage;
  item.overlayEl = overlay;
  item.shadeEls = { shadeTop, shadeRight, shadeBottom, shadeLeft };
  item.cropBoxEl = cropBox;
  item.thumbWrapEl = thumbWrap;
  item.sizeSelectEl = sizeSelect;
  item.sizeResetEl = sizeReset;
  item.downloadBtn = downloadButton;
  item.sizeDeltaEl = imageSizeDelta;
  updateItemStatusChip(item);
  updateItemSizeSelectLabel(item);
  initCropDrag(item);
}

function setItemState(item, state) {
  item.status = state;
  updateItemStatusChip(item);
  if (state === "ready") {
    item.downloadBtn.disabled = false;
  } else {
    item.downloadBtn.disabled = true;
  }
  updateApplyButtonLabel();
}

function updateItemPreview(item, croppedImageURL) {
  if (item.croppedUrl) {
    URL.revokeObjectURL(item.croppedUrl);
  }
  item.croppedUrl = croppedImageURL;
  item.imgEl.src = croppedImageURL;
  setItemState(item, "ready");
  updateItemSizeDelta(item);
  updateDownloadAllVisibility();
}

function updateItemSizeDelta(item) {
  if (!item.sizeDeltaEl) return;
  const originalSize = item.file.size;
  if (!item.blob) {
    item.sizeDeltaEl.innerText = `File size: ${formatFileSize(originalSize)} → —`;
    return;
  }
  const newSize = item.blob.size;
  const delta = originalSize === 0 ? 0 : Math.round((1 - newSize / originalSize) * 100);
  const sign = delta >= 0 ? "reduced" : "increased";
  item.sizeDeltaEl.innerText = `File size: ${formatFileSize(originalSize)} → ${formatFileSize(newSize)} (${Math.abs(delta)}% ${sign})`;
}

function updateItemCropOverlays(item) {
  if (!item.autoCrop || !item.originalWidth || !item.originalHeight) return;
  updateItemCropOverlayForWrap(item, item.thumbWrapEl, item.cropBoxEl, item.shadeEls);
}

function updateItemCropOverlayForWrap(item, wrapEl, cropBoxEl, shadeEls) {
  if (!wrapEl || !cropBoxEl || !shadeEls) return;
  const metrics = getWrapMetrics(item, wrapEl);
  if (!metrics) return;
  const cropDisplay = getDisplayCrop(item, metrics);

  cropBoxEl.style.left = `${cropDisplay.x}px`;
  cropBoxEl.style.top = `${cropDisplay.y}px`;
  cropBoxEl.style.width = `${cropDisplay.width}px`;
  cropBoxEl.style.height = `${cropDisplay.height}px`;

  shadeEls.shadeTop.style.left = `0px`;
  shadeEls.shadeTop.style.top = `0px`;
  shadeEls.shadeTop.style.width = `${metrics.wrapWidth}px`;
  shadeEls.shadeTop.style.height = `${cropDisplay.y}px`;

  shadeEls.shadeBottom.style.left = `0px`;
  shadeEls.shadeBottom.style.top = `${cropDisplay.y + cropDisplay.height}px`;
  shadeEls.shadeBottom.style.width = `${metrics.wrapWidth}px`;
  shadeEls.shadeBottom.style.height = `${metrics.wrapHeight - (cropDisplay.y + cropDisplay.height)}px`;

  shadeEls.shadeLeft.style.left = `0px`;
  shadeEls.shadeLeft.style.top = `${cropDisplay.y}px`;
  shadeEls.shadeLeft.style.width = `${cropDisplay.x}px`;
  shadeEls.shadeLeft.style.height = `${cropDisplay.height}px`;

  shadeEls.shadeRight.style.left = `${cropDisplay.x + cropDisplay.width}px`;
  shadeEls.shadeRight.style.top = `${cropDisplay.y}px`;
  shadeEls.shadeRight.style.width = `${metrics.wrapWidth - (cropDisplay.x + cropDisplay.width)}px`;
  shadeEls.shadeRight.style.height = `${cropDisplay.height}px`;
}

function getPreviewCropSize() {
  if (resolutionDropdown.value && (customResWidth.value || customResHeight.value)) {
    return null;
  }
  if (customResWidth.value && customResHeight.value) {
    return { width: parseInt(customResWidth.value, 10), height: parseInt(customResHeight.value, 10) };
  }
  if (resolutionDropdown.value) {
    const selectedResolution = resolutionDropdown.value.split("x");
    return { width: parseInt(selectedResolution[0], 10), height: parseInt(selectedResolution[1], 10) };
  }
  return null;
}

function schedulePreviewUpdate() {
  if (previewTimer) {
    clearTimeout(previewTimer);
  }
  previewTimer = setTimeout(() => {
    const previewSize = getPreviewCropSize();
    if (!previewSize) return;
    const sizeChanged = !currentGlobalSize ||
      currentGlobalSize.width !== previewSize.width ||
      currentGlobalSize.height !== previewSize.height;
    currentGlobalSize = { width: previewSize.width, height: previewSize.height };
    items.forEach(item => {
      if (item.sizeMode === "custom") {
        updateItemSizeSelectLabel(item);
        return;
      }
      if (sizeChanged && item.status === "ready") {
        clearItemReadyState(item);
      }
      if (item.status === "queued" || sizeChanged) {
        item.cropSize = { width: previewSize.width, height: previewSize.height };
        setItemState(item, "pending");
      }
      updateItemSizeSelectLabel(item);
      generateAutoCropPreview(item, previewSize);
    });
    updateFileCounter();
  }, 250);
}

function generateAutoCropPreview(item, previewSize) {
  if (!item.previewUrl) return;
  if (item.autoCropSize &&
      item.autoCropSize.width === previewSize.width &&
      item.autoCropSize.height === previewSize.height) {
    updateItemCropOverlays(item);
    return;
  }
  const img = new Image();
  img.src = item.previewUrl;
  img.onload = () => {
    smartcrop.crop(img, { width: previewSize.width, height: previewSize.height }).then(result => {
      item.autoCrop = result.topCrop;
      item.autoCropSize = { width: previewSize.width, height: previewSize.height };
      item.originalWidth = img.width;
      item.originalHeight = img.height;
      updateItemCropOverlays(item);
    });
  };
}

function updateItemStatusChip(item) {
  if (!item.statusEl || !item.el) return;
  item.statusEl.classList.remove("status-queued", "status-pending", "status-processing", "status-ready");
  item.el.classList.remove("state-queued", "state-pending", "state-processing", "state-ready");
  let label = "";
  let helpText = "";
  if (item.status === "queued") {
    label = "Queued";
    helpText = "Select a size to preview the crop.";
    item.statusEl.classList.add("status-queued");
    item.el.classList.add("state-queued");
  } else if (item.status === "pending") {
    label = "Pending";
    helpText = "Preview ready. Click Apply to crop.";
    item.statusEl.classList.add("status-pending");
    item.el.classList.add("state-pending");
  } else if (item.status === "processing") {
    label = "Processing";
    helpText = "Cropping and compressing...";
    item.statusEl.classList.add("status-processing");
    item.el.classList.add("state-processing");
  } else if (item.status === "ready") {
    label = "Ready";
    helpText = "Ready to download.";
    item.statusEl.classList.add("status-ready");
    item.el.classList.add("state-ready");
  }
  item.statusEl.innerText = label;
  if (item.statusHelpEl) {
    item.statusHelpEl.innerText = helpText;
  }
}

function updateApplyButtonLabel() {
  const pendingCount = items.filter(item => item.status === "pending").length;
  if (pendingCount > 0) {
    resolutionSelect.classList.remove('hidden');
    applyResolutionButton.disabled = false;
    applyResolutionButton.innerText = `Apply resolution (${pendingCount})`;
  } else {
    applyResolutionButton.disabled = true;
    applyResolutionButton.innerText = "Apply resolution";
  }
}

function clearItemReadyState(item) {
  if (item.croppedUrl) {
    URL.revokeObjectURL(item.croppedUrl);
  }
  item.croppedUrl = null;
  item.blob = null;
  if (item.cropSize) {
    setItemState(item, "pending");
  } else {
    setItemState(item, "queued");
  }
  updateItemSizeDelta(item);
  updateFileCounter();
}

function buildItemSizeSelect(item) {
  const select = document.createElement("select");
  select.classList.add("item-size-select");
  const followOption = document.createElement("option");
  followOption.value = "";
  followOption.innerText = "Follow global size";
  select.appendChild(followOption);
  Array.from(resolutionDropdown.options).forEach(option => {
    if (option.disabled) {
      const opt = document.createElement("option");
      opt.disabled = true;
      opt.innerText = option.text;
      select.appendChild(opt);
      return;
    }
    if (option.value === "") return;
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.innerText = option.text;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    if (!select.value) {
      item.sizeMode = "global";
      item.sizeResetEl.disabled = true;
      if (item.blob) clearItemReadyState(item);
      if (currentGlobalSize) {
        item.cropSize = { width: currentGlobalSize.width, height: currentGlobalSize.height };
        setItemState(item, "pending");
        generateAutoCropPreview(item, item.cropSize);
      } else {
        item.cropSize = null;
        setItemState(item, "queued");
      }
    } else {
      const parts = select.value.split("x");
      item.sizeMode = "custom";
      item.sizeResetEl.disabled = false;
      if (item.blob) clearItemReadyState(item);
      item.cropSize = { width: parseInt(parts[0], 10), height: parseInt(parts[1], 10) };
      setItemState(item, "pending");
      generateAutoCropPreview(item, item.cropSize);
    }
    updateItemSizeSelectLabel(item);
    updateFileCounter();
  });
  return select;
}

function resetItemSize(item) {
  if (!item.sizeSelectEl) return;
  item.sizeSelectEl.value = "";
  item.sizeMode = "global";
  item.sizeResetEl.disabled = true;
  if (item.blob) clearItemReadyState(item);
  if (currentGlobalSize) {
    item.cropSize = { width: currentGlobalSize.width, height: currentGlobalSize.height };
    setItemState(item, "pending");
    generateAutoCropPreview(item, item.cropSize);
  } else {
    item.cropSize = null;
    setItemState(item, "queued");
  }
  updateItemSizeSelectLabel(item);
  updateFileCounter();
}

function updateItemSizeSelectLabel(item) {
  if (!item.sizeSelectEl) return;
  const firstOption = item.sizeSelectEl.options[0];
  if (!currentGlobalSize) {
    firstOption.innerText = "Follow global size";
  } else {
    firstOption.innerText = `Follow global (${currentGlobalSize.width}x${currentGlobalSize.height})`;
  }
}

function getItemTargetSize(item, globalSize) {
  if (item.sizeMode === "custom" && item.cropSize) return item.cropSize;
  if (globalSize && globalSize.width && globalSize.height) {
    return { width: globalSize.width, height: globalSize.height };
  }
  return null;
}

function getWrapMetrics(item, wrapEl) {
  if (!wrapEl) return null;
  const wrapWidth = wrapEl.clientWidth;
  const wrapHeight = wrapEl.clientHeight;
  if (!wrapWidth || !wrapHeight) return null;
  const scale = Math.min(wrapWidth / item.originalWidth, wrapHeight / item.originalHeight);
  const displayWidth = item.originalWidth * scale;
  const displayHeight = item.originalHeight * scale;
  const offsetX = (wrapWidth - displayWidth) / 2;
  const offsetY = (wrapHeight - displayHeight) / 2;
  return { wrapWidth, wrapHeight, scale, displayWidth, displayHeight, offsetX, offsetY };
}

function getDisplayCrop(item, metrics) {
  return {
    x: item.autoCrop.x * metrics.scale + metrics.offsetX,
    y: item.autoCrop.y * metrics.scale + metrics.offsetY,
    width: item.autoCrop.width * metrics.scale,
    height: item.autoCrop.height * metrics.scale
  };
}

function initCropDrag(item) {
  if (!item.cropBoxEl || !item.thumbWrapEl) return;
  let dragState = null;
  const onPointerMove = (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const nextX = clamp(dragState.startCropX + dx, dragState.bounds.minX, dragState.bounds.maxX);
    const nextY = clamp(dragState.startCropY + dy, dragState.bounds.minY, dragState.bounds.maxY);
    item.autoCrop.x = (nextX - dragState.metrics.offsetX) / dragState.metrics.scale;
    item.autoCrop.y = (nextY - dragState.metrics.offsetY) / dragState.metrics.scale;
    updateItemCropOverlays(item);
  };
  const onPointerUp = () => {
    if (!dragState) return;
    dragState = null;
    item.el.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };
  item.cropBoxEl.addEventListener("pointerdown", (e) => {
    if (!item.autoCrop || !item.thumbWrapEl) return;
    if (item.blob) clearItemReadyState(item);
    const metrics = getWrapMetrics(item, item.thumbWrapEl);
    if (!metrics) return;
    const cropDisplay = getDisplayCrop(item, metrics);
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      startCropX: cropDisplay.x,
      startCropY: cropDisplay.y,
      metrics,
      bounds: {
        minX: metrics.offsetX,
        minY: metrics.offsetY,
        maxX: metrics.offsetX + metrics.displayWidth - cropDisplay.width,
        maxY: metrics.offsetY + metrics.displayHeight - cropDisplay.height
      }
    };
    item.el.classList.add("is-dragging");
    item.cropBoxEl.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function removeItem(id) {
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return;
  const item = items[index];
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (item.croppedUrl) URL.revokeObjectURL(item.croppedUrl);
  if (item.el) item.el.remove();
  items.splice(index, 1);
  if (items.length === 0) {
    downloadAllButton.classList.add('hidden');
    finishedHeading.classList.add('hidden');
    loader.classList.add('hidden');
  }
  updateFileCounter();
}

function updateDownloadAllVisibility() {
  const readyCount = items.filter(item => item.status === "ready").length;
  if (readyCount > 0) {
    downloadAllButton.classList.remove('hidden');
  } else {
    downloadAllButton.classList.add('hidden');
  }
}

function downloadImage(item) {
  if (!item.blob) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(item.blob);
  //link.download = `cropped_${fileName.replace(/\.[^/.]+$/, ".jpg")}`; // Replace extension with .jpg
  link.download = `${item.file.name.replace(/\.[^/.]+$/, "")}_${item.cropSize.width}x${item.cropSize.height}px.jpg`; // Replace extension with .jpg
  link.click();
}

downloadAllButton.onclick = () => downloadAllCroppedImages();

function downloadAllCroppedImages() {
  const zip = new JSZip();
  //croppedImages.forEach(image => zip.file(`${cropSize.width}x${cropSize.height}_${image.name.replace(/\.[^/.]+$/, ".jpg")}`, image.blob));
  items
    .filter(item => item.status === "ready")
    .forEach(item => zip.file(`${item.file.name.replace(/\.[^/.]+$/, "")}_${item.cropSize.width}x${item.cropSize.height}.jpg`, item.blob));
  zip.generateAsync({ type: "blob" }).then(blob => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "all_cropped_images.zip";
    link.click();
  });
}
