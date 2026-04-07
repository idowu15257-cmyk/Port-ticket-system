async function captureForInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const cap = window.Capacitor;
  if (!cap || !cap.Plugins || !cap.Plugins.Camera) {
    input.click();
    return;
  }

  try {
    const result = await cap.Plugins.Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: 'uri',
      source: 'CAMERA'
    });

    if (!result || !result.webPath) {
      return;
    }

    const response = await fetch(result.webPath);
    const blob = await response.blob();
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    const file = new File([blob], `camera-${Date.now()}.${extension}`, { type: blob.type || 'image/jpeg' });

    const transfer = new DataTransfer();
    Array.from(input.files || []).forEach((existingFile) => transfer.items.add(existingFile));
    transfer.items.add(file);
    input.files = transfer.files;

    if (typeof showStatusBanner === 'function') {
      showStatusBanner('Photo added to attachment list.', 'success', 2500);
    }
  } catch (error) {
    if (typeof showStatusBanner === 'function') {
      showStatusBanner(`Camera error: ${error.message}`, 'error', 5000);
    }
  }
}

window.captureForInput = captureForInput;
