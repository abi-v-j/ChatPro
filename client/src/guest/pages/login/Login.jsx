import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import * as faceapi from "face-api.js";
import styles from "./login.module.css";
import { generateAndUploadKeyPair } from "../../../utils/cryptoKeys";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username_or_email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loginMode, setLoginMode] = useState("password");

  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceError, setFaceError] = useState("");

  const videoRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // ✅ Use refs to avoid stale state inside interval
  const modelsLoadedRef = useRef(false);
  const cameraReadyRef = useRef(false);

  const stopFaceMode = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }

    cameraReadyRef.current = false;
    setFaceDetected(false);
    setDetectionConfidence(0);
  };

  const loadModelsOnce = async () => {
    if (modelsLoadedRef.current) return;

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]);

    modelsLoadedRef.current = true;
  };

  const startCamera = async () => {
    if (cameraReadyRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      cameraReadyRef.current = true;

      // ✅ wait for video to actually be ready
      await new Promise((resolve) => {
        const v = videoRef.current;
        if (!v) return resolve();
        if (v.readyState >= 2) return resolve();
        v.onloadeddata = () => resolve();
      });
    }
  };

  const startDetectionLoop = () => {
    if (detectionIntervalRef.current) return;

    detectionIntervalRef.current = setInterval(async () => {
      try {
        if (!modelsLoadedRef.current || !cameraReadyRef.current || !videoRef.current) return;

        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        const ok = !!detection;
        setFaceDetected(ok);
        setDetectionConfidence(ok ? Math.round(detection.detection.score * 100) : 0);
      } catch (err) {
        // prevent crashing loop
        console.error("Detection error:", err);
      }
    }, 300);
  };

  useEffect(() => {
    if (loginMode !== "face") {
      stopFaceMode();
      setFaceError("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setFaceError("");
        setMessage("");
        await loadModelsOnce();
        if (cancelled) return;

        await startCamera();
        if (cancelled) return;

        startDetectionLoop();
      } catch (err) {
        console.error(err);
        setFaceError(
          err?.name === "NotAllowedError"
            ? "Camera permission denied"
            : "Failed to start face login"
        );
      }
    })();

    return () => {
      cancelled = true;
      stopFaceMode();
    };
  }, [loginMode]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      const res = await axios.post("http://127.0.0.1:8000/login", formData);

      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      await generateAndUploadKeyPair(res.data.access_token);

      setMessage("Login successful!");
      setTimeout(() => navigate("/User/compose"), 800);
    } catch (err) {
      setMessage(err.response?.data?.detail || "Login failed");
    }
  };

  const captureFace = async () => {
    if (!videoRef.current || !modelsLoadedRef.current) return null;

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    // keep same format your backend expects
    return btoa(JSON.stringify(Array.from(detection.descriptor)));
  };
const handleFaceSubmit = async (e) => {
  e.preventDefault();

  if (!formData.username_or_email.trim()) {
    setFaceError("Username or email required");
    return;
  }

  setFaceLoading(true);
  setFaceError("");
  setMessage("");

  let navTimer = null;

  try {
    const encoding = await captureFace();
    if (!encoding) {
      setFaceError("No face detected. Look directly at the camera!");
      return;
    }

    const res = await axios.post("http://127.0.0.1:8000/face-login", {
      username_or_email: formData.username_or_email.trim(),
      face_encoding: encoding,
    });

    // ✅ save auth
    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("user", JSON.stringify(res.data.user));

    await generateAndUploadKeyPair(res.data.access_token);

    // ✅ IMPORTANT: stop camera + interval immediately on success
    stopFaceMode();
    setLoginMode("password"); // optional: prevents re-opening camera state
    setMessage("Face recognized! Welcome back!");

    navTimer = setTimeout(() => navigate("/User/compose"), 800);
  } catch (err) {
    setFaceError(err.response?.data?.detail || "Face not recognized");
  } finally {
    setFaceLoading(false);
    // ✅ safety: clear timer if component unmounts quickly
    return () => {
      if (navTimer) clearTimeout(navTimer);
    };
  }
};


  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Secure login to your account</p>
        </div>

        <div className={styles.toggle}>
          <button
            onClick={() => setLoginMode("password")}
            className={loginMode === "password" ? styles.active : ""}
          >
            Password
          </button>
          <button
            onClick={() => setLoginMode("face")}
            className={loginMode === "face" ? styles.active : ""}
          >
            Face ID
          </button>
        </div>

        {loginMode === "password" && (
          <form onSubmit={handlePasswordSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                name="username_or_email"
                placeholder="Username or Email"
                value={formData.username_or_email}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.forgot}>
              <span onClick={() => navigate("/forget-password")}>Forgot password?</span>
            </div>

            <button type="submit" className={styles.btn}>
              Login with Password
            </button>
          </form>
        )}

        {loginMode === "face" && (
          <form onSubmit={handleFaceSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                name="username_or_email"
                placeholder="Enter username or email"
                value={formData.username_or_email}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.cameraContainer}>
              <video ref={videoRef} autoPlay muted playsInline className={styles.video} />
              <div className={styles.overlay}>
                <div className={`${styles.faceBox} ${faceDetected ? styles.detected : ""}`} />
              </div>

              <div className={styles.status}>
                {faceDetected ? (
                  <span className={styles.success}>Face Detected ({detectionConfidence}%)</span>
                ) : (
                  <span className={styles.waiting}>Position your face in the frame...</span>
                )}
              </div>
            </div>

            {faceError && <p className={styles.error}>{faceError}</p>}

            <button
              type="submit"
              disabled={faceLoading || !faceDetected}
              className={styles.btn}
            >
              {faceLoading ? "Verifying..." : "Login with Face"}
            </button>
          </form>
        )}

        {message && (
          <div
            className={
              message.includes("successful") || message.includes("recognized")
                ? styles.successMsg
                : styles.errorMsg
            }
          >
            {message}
          </div>
        )}

        <div className={styles.footer}>
          <p>
            Don't have an account? <a href="/register">Register</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
