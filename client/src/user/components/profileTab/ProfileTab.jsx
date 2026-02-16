import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as faceapi from "face-api.js";
import { motion } from "framer-motion";
import styles from "./ProfileTab.module.css";

const API_BASE = "http://127.0.0.1:8000";

// ✅ SAFE base64 encoder for Float32 descriptor (no JSON, no btoa Unicode issues)
const float32ToB64 = (f32) => {
  const u8 = new Uint8Array(f32.buffer);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
};

function ProfileTab() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [tempUser, setTempUser] = useState({});
  const [profilePic, setProfilePic] = useState("");
  const [faceStatus, setFaceStatus] = useState("Not Added");

  // Face addition states
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceError, setFaceError] = useState("");

  const videoRef = useRef(null);
  const intervalRef = useRef(null);

  const token = localStorage.getItem("token");

  // Fetch user (settings removed)
  const fetchProfile = async () => {
    if (!token) {
      setError("Please log in");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const userRes = await axios.get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userData = userRes.data;
      setUser(userData);
      setTempUser(userData);

      const pic = userData.profile_picture_url || "https://via.placeholder.com/150?text=👤";
      setProfilePic(pic);

      setFaceStatus(userData.face_encoding ? "Added ✅" : "Not Added ❌");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Start camera + detection when modal opens
  useEffect(() => {
    if (!showFaceModal) return;

    const startCamera = async () => {
      try {
        setFaceError("");

        if (!modelsLoaded) {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
            faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
          ]);
          setModelsLoaded(true);
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        intervalRef.current = setInterval(async () => {
          if (!videoRef.current) return;

          const detections = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (!detections || detections.length === 0) {
            setFaceDetected(false);
            setDetectionConfidence(0);
            setFaceError("No face detected");
            return;
          }

          if (detections.length > 1) {
            setFaceDetected(false);
            setDetectionConfidence(0);
            setFaceError("Multiple faces detected. Only one face allowed.");
            return;
          }

          setFaceError("");
          setFaceDetected(true);
          setDetectionConfidence((detections[0].detection.score || 0) * 100);
        }, 400);
      } catch (e) {
        setFaceError("Camera or model initialization failed");
      }
    };

    startCamera();

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;

      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }

      setFaceDetected(false);
      setDetectionConfidence(0);
      setFaceError("");
    };
  }, [showFaceModal, modelsLoaded]);

  // ✅ Capture face descriptor -> base64 string
  const captureFace = async () => {
    if (!videoRef.current || !modelsLoaded) {
      setFaceError("Camera not ready");
      return null;
    }

    const detections = await faceapi
      .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.6 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      setFaceError("No face detected. Please face the camera.");
      return null;
    }

    if (detections.length > 1) {
      setFaceError("Multiple faces detected. Ensure only your face is visible.");
      return null;
    }

    const descriptor = detections[0].descriptor;
    if (!descriptor || descriptor.length !== 128) {
      setFaceError("Invalid face data captured");
      return null;
    }

    return float32ToB64(new Float32Array(descriptor));
  };

  // ✅ Add face (calls backend /add-face)
  const handleAddFace = async () => {
    if (faceLoading || !faceDetected) return;

    setFaceLoading(true);
    setFaceError("");

    const faceEncoding = await captureFace();
    if (!faceEncoding) {
      setFaceLoading(false);
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/add-face`,
        { face_encoding: faceEncoding },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setFaceStatus("Added ✅");
      setUser((prev) => ({ ...prev, face_encoding: faceEncoding }));
      setShowFaceModal(false);
      alert("Face added successfully");
    } catch (err) {
      setFaceError(err.response?.data?.detail || "Failed to add face");
    } finally {
      setFaceLoading(false);
    }
  };

  // Upload profile picture
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const newUrl = res.data.file_url;

      await axios.put(
        `${API_BASE}/users/me`,
        { profile_picture_url: newUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProfilePic(newUrl);
      setUser((prev) => ({ ...prev, profile_picture_url: newUrl }));
      alert("Profile picture updated!");
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
    }
  };

  // Save profile
  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/users/me`, tempUser, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(tempUser);
      setEditing(false);
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Save failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Calculate account age
  const calculateAccountAge = () => {
    if (!user?.join_date) return "New";
    const join = new Date(user.join_date);
    const now = new Date();
    const years = now.getFullYear() - join.getFullYear();
    const months = now.getMonth() - join.getMonth() + years * 12;
    if (months >= 12) return `${Math.floor(months / 12)} year${months >= 24 ? "s" : ""}`;
    if (months > 0) return `${months} month${months > 1 ? "s" : ""}`;
    return "Just joined";
  };

  const countries = ["United States", "India", "Canada", "United Kingdom", "Germany", "France", "Japan", "Australia", "Brazil", "Mexico"];

  if (loading) return <div className={styles.loading}>Loading profile...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!user) return <div className={styles.error}>No user data</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Profile</h1>
        <p className={styles.subtitle}>Manage your account</p>
      </div>

      <div className={styles.profileLayout}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.profileSummary}>
            <div className={styles.avatarSection}>
              <img
                src={profilePic?.startsWith("http") ? profilePic : `http://127.0.0.1:8000/${profilePic}`}
                alt="Profile"
                className={styles.profilePic}
              />
              <label htmlFor="upload-profile" className={styles.uploadButton}>
                <span className={styles.uploadIcon}>📷</span>
                Change Photo
              </label>
              <input
                id="upload-profile"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className={styles.fileInput}
              />
            </div>

            <div className={styles.userInfo}>
              <h2 className={styles.userName}>{user.name}</h2>
              <p className={styles.userEmail}>{user.email}</p>
              <p className={styles.userPosition}>{user.position || "No position set"}</p>

              
            </div>
          </div>

          {/* ✅ only personal + professional */}
          <div className={styles.tabNavigation}>
            {[
              { id: "personal", label: "Personal Info", icon: "👤" },
              { id: "professional", label: "Professional", icon: "💼" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.content}>
          {!editing ? (
            <>
              {/* Personal */}
              {activeTab === "personal" && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>Personal Information</h2>
                    <button
                      className={styles.editButton}
                      onClick={() => {
                        setEditing(true);
                        setTempUser(user);
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </div>

                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <label>Full Name</label>
                      <p>{user.name}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label>Email</label>
                      <p>{user.email}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label>Phone</label>
                      <p>{user.phone || "Not set"}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label>Date of Birth</label>
                      <p>{user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : "Not set"}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label>Location</label>
                      <p>{user.city ? `${user.city}, ${user.country}` : user.country || "Not set"}</p>
                    </div>

                    <div className={styles.infoItem}>
                      <label>Facial Login</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <p>{faceStatus}</p>
                        {faceStatus === "Not Added ❌" && (
                          <button className={styles.addFaceButton} onClick={() => setShowFaceModal(true)}>
                            Add Face 🔐
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.bioSection}>
                    <label>Bio</label>
                    <p className={styles.bioText}>{user.bio || "No bio added yet."}</p>
                  </div>
                </div>
              )}

              {/* Professional */}
              {activeTab === "professional" && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>Professional Info</h2>
                    <button
                      className={styles.editButton}
                      onClick={() => {
                        setEditing(true);
                        setTempUser(user);
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <label>Company</label>
                      <p>{user.company || "Not set"}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label>Position</label>
                      <p>{user.position || "Not set"}</p>
                    </div>
                    <div className={styles.infoItem}>
                      <label>Member Since</label>
                      <p>
                        {new Date(user.join_date).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Edit Mode */
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Edit Profile</h2>
                <div className={styles.editActions}>
                  <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    className={styles.cancelButton}
                    onClick={() => {
                      setEditing(false);
                      setTempUser(user);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className={styles.editForm}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={tempUser.name || ""}
                      onChange={(e) => setTempUser((prev) => ({ ...prev, name: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Email *</label>
                    <input
                      type="email"
                      value={tempUser.email || ""}
                      readOnly
                      className={styles.input}
                      style={{ background: "#f3f4f6" }}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={tempUser.phone || ""}
                      onChange={(e) => setTempUser((prev) => ({ ...prev, phone: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={tempUser.date_of_birth ? tempUser.date_of_birth.split("T")[0] : ""}
                      onChange={(e) => setTempUser((prev) => ({ ...prev, date_of_birth: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Country</label>
                    <select
                      value={tempUser.country || ""}
                      onChange={(e) => setTempUser((prev) => ({ ...prev, country: e.target.value }))}
                      className={styles.select}
                    >
                      <option value="">Select country</option>
                      {countries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>City</label>
                    <input
                      type="text"
                      value={tempUser.city || ""}
                      onChange={(e) => setTempUser((prev) => ({ ...prev, city: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Bio</label>
                  <textarea
                    value={tempUser.bio || ""}
                    onChange={(e) => setTempUser((prev) => ({ ...prev, bio: e.target.value }))}
                    rows="4"
                    className={styles.textarea}
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Company</label>
                    <input
                      type="text"
                      value={tempUser.company || ""}
                      onChange={(e) => setTempUser((prev) => ({ ...prev, company: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Position</label>
                    <input
                      type="text"
                      value={tempUser.position || ""}
                      onChange={(e) => setTempUser((prev) => ({ ...prev, position: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Face Addition Modal */}
      <motion.div
        className={styles.faceModalOverlay}
        initial={{ opacity: 0 }}
        animate={showFaceModal ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: showFaceModal ? "flex" : "none" }}
        onClick={() => setShowFaceModal(false)}
      >
        <motion.div
          className={styles.faceModal}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3>Add Facial Recognition</h3>
          <p>Position your face in the camera and click "Capture Face"</p>

          <div className={styles.videoContainer}>
            <video ref={videoRef} autoPlay muted playsInline className={styles.authVideo} />
            <div className={styles.videoOverlay}>
              <motion.div
                className={styles.faceIndicator}
                initial={false}
                animate={{
                  backgroundColor: faceDetected ? "rgba(0, 255, 136, 0.2)" : "rgba(0, 0, 0, 0.7)",
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

              <motion.div
                className={styles.confidenceBar}
                initial={{ width: 0 }}
                animate={{ width: `${detectionConfidence}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {faceError && <p className={styles.faceError}>{faceError}</p>}

          <div className={styles.modalActions}>
            <button
              onClick={handleAddFace}
              disabled={faceLoading || !faceDetected}
              className={styles.addFaceButton}
            >
              {faceLoading ? "Capturing..." : "Capture Face"}
            </button>
            <button onClick={() => setShowFaceModal(false)} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default ProfileTab;
