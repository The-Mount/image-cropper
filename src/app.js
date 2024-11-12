import Pica from 'pica';

const dropArea = document.getElementById("drop-area");
const previewList = document.getElementById("preview-list");
const downloadAllButton = document.querySelector(".download-all");
const resolutionSelect = document.querySelector(".resolution-select");
const resolutionDropdown = document.getElementById("resolution-dropdown");
const applyResolutionButton = document.getElementById("apply-resolution");
const customResWidth = document.getElementById("width");
const customResHeight = document.getElementById("height");
const loader = document.querySelector(".loader");
const fileCounter = document.querySelector(".file-counter");
const fileCounterContent = document.querySelector(".file-counter p");
const finishedHeading = document.querySelector(".finished-heading");
let hasRun = false;
let rawImages = [];
let croppedImages = [];
let cropSize = {
  "width": null,
  "height": null
};
let pendingFile = null; // Store file awaiting resolution selection

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
  if (croppedImages.length > 0 && !hasRun) {
    rawImages = [];
    hasRun = true;
  }
  Array.from(e.dataTransfer.files).forEach(file => {
    rawImages.push(file);
  });
  // rawImages = e.dataTransfer.files;
  resolutionSelect.classList.remove('hidden')
  handleEnableFileCounter(rawImages);
});

function handleFiles(files, cropSize) {
  fileCounterContent.innerText = `Cropping...`;
  loader.classList.remove('hidden');
  resolutionSelect.classList.add('hidden');
  Array.from(files).forEach(file => {
    processFile(file, cropSize);
  });
}

function handleLoader() {
  if (croppedImages.length >= rawImages.length) {
    loader.classList.add('hidden');
    handleDisableFileCounter(croppedImages);
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

function processFile(file, cropSize) {
  new Compressor(file, {
    quality: 0.8, // Set compression quality (0-1)
    success: (compressedFile) => {
      const reader = new FileReader();
      reader.onload = () => createPreview(reader.result, compressedFile, cropSize);
      reader.readAsDataURL(compressedFile);
    },
    error(err) {
      console.error(`Error compressing ${file.name}:`, err);
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
    handleFiles(rawImages, cropSize);
  } else if (resolutionDropdown.value) {
    let selectedResolution = resolutionDropdown.value.split("x");
    cropSize.width = parseInt(selectedResolution[0]);
    cropSize.height = parseInt(selectedResolution[1]);
    handleFiles(rawImages, cropSize);
  } else {
    alert("Please select a size or enter a custom size.");
  }
}

// Use dropdown selection for resolution when no size in filename
applyResolutionButton.onclick = () => {
  if (rawImages) {
    handleUserEntry();
    pendingFile = null; // Reset pending file after processing
  } else {
    alert("No images to crop");
  }
};

// Create preview with Smartcrop for cropping accuracy

function createPreview(imageSrc, file, cropSize) {
  const img = new Image();
  img.src = imageSrc;
  img.onload = () => {
    smartcrop.crop(img, { width: cropSize.width, height: cropSize.height }).then(result => {
      const crop = result.topCrop;

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
      downscaleCanvas.width = cropSize.width;
      downscaleCanvas.height = cropSize.height;

      // Use Pica to resize the cropped image to the target dimensions (cropSize)
      pica.resize(canvas, downscaleCanvas, {
        unsharpAmount: 80,     // Optional: Use unsharp mask for quality
        unsharpThreshold: 100,   // Optional: Set threshold for unsharp mask
        quality: 3,            // Use the best quality option
      }).then(() => {
        // Convert resized canvas to Blob (JPEG format)
        downscaleCanvas.toBlob((blob) => {
          const croppedImageURL = URL.createObjectURL(blob);
          croppedImages.push({ name: file.name, blob });
          createListItem(file, img, croppedImageURL, blob);
          handleLoader();
          hasRun = false;
        }, "image/jpeg", 0.9);  // Set JPEG quality to 90%
      }).catch((err) => {
        console.error("Error resizing image:", err);
      });
    });
  };
}


function createListItem(file, img, croppedImageURL, blob) {
  const listItem = document.createElement("li");
  const croppedImage = document.createElement("img");
  const imageInfoContainer = document.createElement("div");
  const imageSizeInfo = document.createElement("p");
  const imageNameInfo = document.createElement("p");
  imageNameInfo.classList.add("image-name");
  imageNameInfo.innerText = file.name;
  imageSizeInfo.innerText = `${img.width}x${img.height}px → ${cropSize.width}x${cropSize.height}px`
  croppedImage.src = croppedImageURL;
  imageInfoContainer.appendChild(imageNameInfo);
  imageInfoContainer.appendChild(imageSizeInfo);
  listItem.appendChild(croppedImage);
  listItem.appendChild(imageInfoContainer);

  const downloadButton = document.createElement("button");
  downloadButton.classList.add("download-button");
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
  downloadButton.onclick = () => downloadImage(blob, file.name);
  listItem.appendChild(downloadButton);
  downloadAllButton.classList.remove('hidden');
  finishedHeading.classList.remove('hidden');

  previewList.appendChild(listItem);
}

function downloadImage(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  //link.download = `cropped_${fileName.replace(/\.[^/.]+$/, ".jpg")}`; // Replace extension with .jpg
  link.download = `${fileName.replace(/\.[^/.]+$/, "")}_${cropSize.width}x${cropSize.height}px.jpg`; // Replace extension with .jpg
  link.click();
}

downloadAllButton.onclick = () => downloadAllCroppedImages();

function downloadAllCroppedImages() {
  const zip = new JSZip();
  //croppedImages.forEach(image => zip.file(`${cropSize.width}x${cropSize.height}_${image.name.replace(/\.[^/.]+$/, ".jpg")}`, image.blob));
  croppedImages.forEach(image => zip.file(`${image.name.replace(/\.[^/.]+$/, "")}_${cropSize.width}x${cropSize.height}.jpg`, image.blob));
  zip.generateAsync({ type: "blob" }).then(blob => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "all_cropped_images.zip";
    link.click();
  });
}
