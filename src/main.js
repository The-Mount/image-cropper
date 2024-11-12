import Pica from 'pica';

const dropArea = document.getElementById('drop-area');
const outputImage = document.getElementById('resized-image');

// Initialize Pica
const pica = Pica();

// Handle file drag over
dropArea.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropArea.style.backgroundColor = '#e0e0e0';
});

dropArea.addEventListener('dragleave', () => {
  dropArea.style.backgroundColor = '#f9f9f9';
});

// Handle file drop
dropArea.addEventListener('drop', (event) => {
  event.preventDefault();
  dropArea.style.backgroundColor = '#f9f9f9';

  const files = event.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];

  // Check if the file is an image
  if (!file.type.startsWith('image/')) {
    alert('Please drop an image file!');
    return;
  }

  // Create an image element
  const img = document.createElement('img');
  const reader = new FileReader();

  reader.onload = (e) => {
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);

  img.onload = () => {
    resizeImage(img);
  };
});

// Function to resize image
const resizeImage = (img) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Resize to 300px width (maintains aspect ratio)
  const width = 300;
  const height = Math.round((img.height * width) / img.width);

  canvas.width = width;
  canvas.height = height;

  // Resize using Pica
  pica.resize(img, canvas)
    .then(() => {
      // Set the resized image as the output
      outputImage.src = canvas.toDataURL();
    })
    .catch((err) => {
      console.error('Error resizing image:', err);
    });
};
