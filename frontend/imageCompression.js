/**
 * Client-side Image Compression Utility
 * Reduces file sizes before upload to save storage costs
 */

class ImageCompressor {
  constructor(options = {}) {
    this.maxSizeMB = options.maxSizeMB || 1; // Target max size in MB
    this.maxWidthOrHeight = options.maxWidthOrHeight || 1920; // Max dimension
    this.quality = options.quality || 0.8; // JPEG quality (0-1)
    this.useWebWorker = options.useWebWorker !== false;
  }

  /**
   * Check if file is an image
   */
  isImage(file) {
    return file && file.type.startsWith('image/');
  }

  /**
   * Get file size in MB
   */
  getFileSizeMB(file) {
    return file.size / (1024 * 1024);
  }

  /**
   * Compress a single image file
   */
  async compressImage(file) {
    if (!this.isImage(file)) {
      return file; // Return non-images unchanged
    }

    const originalSizeMB = this.getFileSizeMB(file);
    
    // Skip compression if already small enough
    if (originalSizeMB <= this.maxSizeMB) {
      console.log(`Skipping compression for ${file.name} (${originalSizeMB.toFixed(2)}MB)`);
      return file;
    }

    try {
      console.log(`Compressing ${file.name} from ${originalSizeMB.toFixed(2)}MB...`);
      
      const compressedFile = await this._compress(file);
      const compressedSizeMB = this.getFileSizeMB(compressedFile);
      const savings = ((1 - compressedSizeMB / originalSizeMB) * 100).toFixed(1);
      
      console.log(`Compressed to ${compressedSizeMB.toFixed(2)}MB (${savings}% reduction)`);
      
      return compressedFile;
    } catch (error) {
      console.error('Compression failed, using original:', error);
      return file; // Return original if compression fails
    }
  }

  /**
   * Compress multiple files
   */
  async compressFiles(files) {
    const fileArray = Array.from(files);
    const compressed = await Promise.all(
      fileArray.map(file => this.compressImage(file))
    );
    return compressed;
  }

  /**
   * Internal compression logic
   */
  async _compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            
            // Calculate new dimensions
            if (width > this.maxWidthOrHeight || height > this.maxWidthOrHeight) {
              if (width > height) {
                height = (height / width) * this.maxWidthOrHeight;
                width = this.maxWidthOrHeight;
              } else {
                width = (width / height) * this.maxWidthOrHeight;
                height = this.maxWidthOrHeight;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Canvas to Blob conversion failed'));
                  return;
                }
                
                // Create new File object
                const compressedFile = new File(
                  [blob],
                  file.name,
                  {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  }
                );
                
                resolve(compressedFile);
              },
              'image/jpeg',
              this.quality
            );
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Show compression warning if file is large
   */
  shouldWarnAboutSize(file) {
    const sizeMB = this.getFileSizeMB(file);
    return sizeMB > 5; // Warn for files over 5MB
  }

  /**
   * Get human-readable file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Create global instance with default settings
window.imageCompressor = new ImageCompressor({
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  quality: 0.8
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageCompressor;
}

// Made with Bob
