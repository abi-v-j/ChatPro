import { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as faceapi from "face-api.js";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import styles from "./FaceAuth.module.css";

const FaceAuth = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const videoRef = useRef();
  const loginTimeoutRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // Load models & start webcam
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("Loading face detection models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        console.log("All models loaded successfully");
        setModelsLoaded(true);
      } catch (err) {
        console.error("Model loading error:", err);
        setError(`Failed to load face detection models: ${err.message}`);
      }
    };

    loadModels();

    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: "user",
        },
      })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log("HD Webcam stream initialized");
        }
      })
      .catch((err) => {
        console.error("Webcam error:", err);
        setError("Camera access required for facial authentication");
      });

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  // Continuous face detection for better UX
  useEffect(() => {
    if (modelsLoaded && videoRef.current) {
      detectionIntervalRef.current = setInterval(async () => {
        try {
          const detections = await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

          setFaceDetected(!!detections);
          setDetectionConfidence(
            detections ? detections.detection._score * 100 : 0
          );
        } catch (err) {
          // Silent fail for continuous detection
        }
      }, 500);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [modelsLoaded]);

  // Capture face descriptor
  const captureFace = async () => {
    if (!videoRef.current || !modelsLoaded) {
      setError("Camera not ready");
      return null;
    }

    try {
      const detections = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections?.descriptor) {
        setError(
          "No face detected. Please ensure your face is clearly visible"
        );
        return null;
      }

      const descriptorArray = Array.from(detections.descriptor);
      return btoa(JSON.stringify(descriptorArray));
    } catch (err) {
      console.error("Face detection error:", err);
      setError("Face detection failed. Please try again");
      return null;
    }
  };

  // Handle facial registration
  const handleRegister = async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setError("");
    const faceEncoding = await captureFace();
    if (!faceEncoding) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post("http://127.0.0.1:8000/register", {
        username,
        name: username,
        email: `${username}@whispermail.com`,
        face_encoding: faceEncoding,
      });

      alert("Registration successful! You can now login with your face.");
      setError("");
      setIsRegisterMode(false);
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err.response?.data?.detail || "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle facial login
  const handleLogin = async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (isLoading) return;
    if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);

    setIsLoading(true);
    setError("");
    const faceEncoding = await captureFace();
    if (!faceEncoding) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post("http://127.0.0.1:8000/login", {
        username,
        face_encoding: faceEncoding,
      });

      onLogin(response.data.access_token, username);
      setError("");
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err.response?.data?.detail || "Authentication failed. Please try again."
      );
    } finally {
      loginTimeoutRef.current = setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 },
    },
  };

  const buttonVariants = {
    initial: { scale: 1 },
    hover: {
      scale: 1.02,
      transition: { duration: 0.2 },
    },
    tap: { scale: 0.98 },
  };

  return (
    <motion.div
      className={styles.premiumAuthContainer}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div
        className={styles.authGlassCard}
        variants={itemVariants}
        whileHover={{ y: -5 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <motion.div className={styles.authHeader} variants={itemVariants}>
          <motion.div
            className={styles.appLogo}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <motion.span
              className={styles.logoIcon}
              animate={{ rotate: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
            >
              🔐
            </motion.span>
            <h1>WhisperMail</h1>
          </motion.div>
          <motion.h2 variants={itemVariants}>
            {isRegisterMode ? "Face Registration" : "Secure Login"}
          </motion.h2>
          <motion.p className={styles.authSubtitle} variants={itemVariants}>
            {isRegisterMode
              ? "Register your face for secure access"
              : "Use facial recognition to access your account"}
          </motion.p>
        </motion.div>

        <motion.div className={styles.authContent} variants={containerVariants}>
          <motion.div
            className={styles.videoContainer}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
          >
            <video ref={videoRef} autoPlay muted className={styles.authVideo} />
            <div className={styles.videoOverlay}>
              <motion.div
                className={styles.faceIndicator}
                initial={false}
                animate={{
                  backgroundColor: faceDetected
                    ? "rgba(0, 255, 136, 0.2)"
                    : "rgba(0, 0, 0, 0.7)",
                }}
              >
                <motion.div
                  className={styles.indicatorDot}
                  animate={{
                    scale: faceDetected ? [1, 1.2, 1] : 1,
                    backgroundColor: faceDetected ? "#00ff88" : "#ff6b6b",
                  }}
                  transition={{ duration: 0.5 }}
                />
                <span>
                  {faceDetected ? "Face Detected" : "Searching for Face"}
                  {faceDetected && ` (${detectionConfidence.toFixed(0)}%)`}
                </span>
              </motion.div>

              {/* Face Detection Confidence Bar */}
              <motion.div
                className={styles.confidenceBar}
                initial={{ width: 0 }}
                animate={{ width: `${detectionConfidence}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Scanning Animation */}
            <motion.div
              className={styles.scanningLine}
              animate={{ y: ["0%", "100%", "0%"] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>

          <motion.div className={styles.inputGroup} variants={itemVariants}>
            <motion.input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className={styles.premiumInput}
              disabled={isLoading}
              whileFocus={{
                scale: 1.02,
                borderColor: "rgba(255, 255, 255, 0.8)",
              }}
              transition={{ type: "spring", stiffness: 400 }}
            />
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                className={styles.errorMessage}
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className={styles.errorIcon}>⚠️</span>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className={styles.authActions}
            variants={containerVariants}
          >
            {isRegisterMode ? (
              <>
                <motion.button
                  onClick={handleRegister}
                  className={`${styles.premiumBtn} ${styles.primary}`}
                  disabled={isLoading || !faceDetected}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                >
                  {isLoading ? (
                    <motion.div
                      className={styles.loadingSpinner}
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  ) : (
                    <>
                      <span>Register Face</span>
                      <motion.span
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </>
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setIsRegisterMode(false)}
                  className={`${styles.premiumBtn} ${styles.secondary}`}
                  disabled={isLoading}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                >
                  Back to Login
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  onClick={handleLogin}
                  className={`${styles.premiumBtn} ${styles.primary}`}
                  disabled={isLoading || !faceDetected}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                >
                  {isLoading ? (
                    <motion.div
                      className={styles.loadingSpinner}
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  ) : (
                    <>
                      <span>Login with Face</span>
                      <motion.span
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        🔑
                      </motion.span>
                    </>
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setIsRegisterMode(true)}
                  className={`${styles.premiumBtn} ${styles.secondary}`}
                  disabled={isLoading}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                >
                  New User? Register
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>

        <motion.div className={styles.authFooter} variants={itemVariants}>
          <motion.p
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Secure • Private • Encrypted
          </motion.p>
        </motion.div>

        {/* Background decorative elements */}
        <motion.div
          className={styles.floatingOrb1}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className={styles.floatingOrb2}
          animate={{
            y: [0, 15, 0],
            x: [0, -15, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </motion.div>
  );
};

export default FaceAuth;
