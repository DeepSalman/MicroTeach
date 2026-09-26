import React, { useRef, useState, useCallback } from 'react';
import './IdCardCapture.css';

const IdCardCapture = ({ label, onCapture, captured }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(captured || null);
  const fileInputRef = useRef(null);

  const startCamera = async () => {
    setCameraError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(s);
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 50);
    } catch (err) {
      setCameraError('Camera access denied. Please use file upload instead.');
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  const shootPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanning(true);
    setTimeout(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `${label.replace(/\s+/g, '_')}_capture.jpg`, { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setPreview(url);
        onCapture(file, url);
        stopCamera();
        setScanning(false);
      }, 'image/jpeg', 0.92);
    }, 600);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCameraError('Please select a valid image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCameraError('File too large. Max 10 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onCapture(file, url);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const synth = { target: { files: [file] } };
      handleFileChange(synth);
    }
  };

  const retake = () => {
    setPreview(null);
    onCapture(null, null);
    setCameraError('');
  };

  return (
    <div className="idc-root">
      <div className="idc-label">{label}</div>

      {preview ? (
        <div className="idc-preview-wrap">
          <img src={preview} alt={label} className="idc-preview-img" />
          <div className="idc-preview-watermark">MICROTEACH VERIFIED</div>
          <button type="button" className="idc-retake-btn" onClick={retake}>
            ↩ Retake / Change
          </button>
        </div>
      ) : cameraActive ? (
        <div className="idc-camera-wrap">
          <video ref={videoRef} className="idc-video" autoPlay playsInline muted />
          <div className={`idc-overlay ${scanning ? 'scanning' : ''}`}>
            <div className="idc-bracket idc-bracket--tl" />
            <div className="idc-bracket idc-bracket--tr" />
            <div className="idc-bracket idc-bracket--bl" />
            <div className="idc-bracket idc-bracket--br" />
            {scanning && <div className="idc-laser" />}
          </div>
          <div className="idc-camera-hint">Align your card inside the brackets</div>
          <div className="idc-camera-actions">
            <button type="button" className="idc-shutter-btn" onClick={shootPhoto} disabled={scanning}>
              {scanning ? <span className="idc-spinner" /> : <span className="idc-shutter-ring" />}
            </button>
            <button type="button" className="idc-cancel-cam-btn" onClick={stopCamera}>Cancel</button>
          </div>
        </div>
      ) : (
        <div
          className="idc-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="idc-dz-icon">🪪</div>
          <div className="idc-dz-text">
            <strong>Drop image here</strong> or click to browse
          </div>
          <div className="idc-dz-hint">JPG, PNG, WEBP up to 10 MB</div>
          <div className="idc-dz-divider"><span>or</span></div>
          <button
            type="button"
            className="idc-cam-btn"
            onClick={(e) => { e.stopPropagation(); startCamera(); }}
          >
            📷 Use Camera
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="idc-file-input"
            onChange={handleFileChange}
          />
        </div>
      )}

      {cameraError && <div className="idc-error">{cameraError}</div>}
      <canvas ref={canvasRef} className="idc-canvas-hidden" />
    </div>
  );
};

export default IdCardCapture;
