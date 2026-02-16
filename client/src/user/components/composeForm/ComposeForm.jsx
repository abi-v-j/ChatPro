import React, { useRef, useState } from "react";
import axios from "axios";
import styles from "./ComposeForm.module.css";

// Base64 helpers
const b64ToUint8Array = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const uint8ArrayToB64 = (arr) => btoa(String.fromCharCode(...arr));



async function encryptFile(
  file,
  recipientEmails,
  currentUserId,
  token
) {
  // 1. Read file as bytes
  const buffer = await file.arrayBuffer();
  const plainBytes = new Uint8Array(buffer);

  // 2. Generate AES key
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt file bytes
  const encryptedBytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plainBytes
  );

  const aesRaw = await crypto.subtle.exportKey("raw", aesKey);

  // 4. Encrypt AES key for each recipient
  const encryptAESKey = async (pubB64, userId) => {
    const pubKey = await crypto.subtle.importKey(
      "spki",
      b64ToUint8Array(pubB64),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );

    const encKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      pubKey,
      aesRaw
    );

    return {
      user_id: userId,
      encrypted_sym_key: uint8ArrayToB64(new Uint8Array(encKey)),
    };
  };

  const encryptedKeys = [];

  // sender key
  encryptedKeys.push(
    await encryptAESKey(
      localStorage.getItem("publicKey"),
      currentUserId
    )
  );

  // recipients
  for (const email of recipientEmails) {
    const res = await axios.get(
      `http://127.0.0.1:8000/public-key/${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    encryptedKeys.push(
      await encryptAESKey(res.data.public_key, res.data.user_id)
    );
  }

  // 5. Create encrypted file
  const encryptedBlob = new Blob(
    [iv, new Uint8Array(encryptedBytes)],
    { type: "application/octet-stream" }
  );

  return {
    file: new File(
      [encryptedBlob],
      `${file.name}.enc`,
      { type: "application/octet-stream" }
    ),
    meta: {
      encrypted: true,
      iv: uint8ArrayToB64(iv),
      encrypted_keys: encryptedKeys,
      original_type: file.type,
      original_name: file.name,
    },
  };

}

// Full end-to-end encryption (hybrid RSA-OAEP + AES-GCM)
async function encryptEmailBody(body, recipientEmails, currentUserId, token) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API not supported");
  }

  const ownPubB64 = localStorage.getItem("publicKey");
  if (!ownPubB64) throw new Error("Your encryption keys are missing. Please log in again.");

  const symKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const symExported = await crypto.subtle.exportKey("raw", symKey);

  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    symKey,
    data
  );

  const fullCipher = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  fullCipher.set(iv, 0);
  fullCipher.set(new Uint8Array(ciphertext), iv.byteLength);
  const encryptedBodyB64 = uint8ArrayToB64(fullCipher);

  const encryptSymKey = async (pubB64, userId) => {
    const pubArray = b64ToUint8Array(pubB64);
    const pubKey = await crypto.subtle.importKey(
      "spki",
      pubArray,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    const encSym = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      pubKey,
      symExported
    );
    return {
      user_id: userId,
      encrypted_sym_key: uint8ArrayToB64(new Uint8Array(encSym)),
    };
  };

  const encryptedKeys = [];
  encryptedKeys.push(await encryptSymKey(ownPubB64, currentUserId));

  for (const email of recipientEmails) {
    try {
      const res = await axios.get(
        `http://127.0.0.1:8000/public-key/${encodeURIComponent(email.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      encryptedKeys.push(
        await encryptSymKey(res.data.public_key, res.data.user_id)
      );
    } catch {
      throw new Error(
        `Recipient ${email} has not enabled encryption`
      );
    }
  }

  return {
    encrypted_body: encryptedBodyB64,
    encrypted_keys: encryptedKeys,
  };
}

// LSB Steganography: Embed message in first image attachment
async function embedMessageInImage(file, message) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Steganography requires an image file (PNG/JPG recommended)");
  }

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const msgBytes = new TextEncoder().encode(message);
  const lengthBin = msgBytes.length.toString(2).padStart(32, "0");
  let binaryMessage = lengthBin;
  for (const byte of msgBytes) {
    binaryMessage += byte.toString(2).padStart(8, "0");
  }

  const bitsNeeded = binaryMessage.length;
  const capacity = canvas.width * canvas.height;
  if (bitsNeeded > capacity * 0.9) {
    throw new Error("Message too large for this image. Use a larger image.");
  }

  let bitIndex = 0;
  for (let i = 0; i < data.length && bitIndex < bitsNeeded; i += 4) {
    if (bitIndex < bitsNeeded) {
      const bit = parseInt(binaryMessage[bitIndex]);
      data[i] = (data[i] & 254) | bit;
      bitIndex++;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const stegoFile = new File([blob], file.name, { type: file.type });
      resolve(stegoFile);
    }, file.type, 0.95);
  });
}



async function encryptBinary(dataUint8, recipientEmails, currentUserId, token) {
  const ownPubB64 = localStorage.getItem("publicKey");
  if (!ownPubB64) throw new Error("Missing public key");

  const symKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    symKey,
    dataUint8
  );

  const symRaw = await crypto.subtle.exportKey("raw", symKey);

  const encryptSymKey = async (pubB64, userId) => {
    const pubKey = await crypto.subtle.importKey(
      "spki",
      b64ToUint8Array(pubB64),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    const enc = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, symRaw);
    return {
      user_id: userId,
      encrypted_sym_key: uint8ArrayToB64(new Uint8Array(enc)),
    };
  };

  const encryptedKeys = [];
  encryptedKeys.push(await encryptSymKey(ownPubB64, currentUserId));

  for (const email of recipientEmails) {
    const res = await axios.get(
      `http://127.0.0.1:8000/public-key/${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    encryptedKeys.push(await encryptSymKey(res.data.public_key, res.data.user_id));
  }

  return {
    encrypted_blob: new Uint8Array(encrypted),
    iv: uint8ArrayToB64(iv),
    encrypted_keys: encryptedKeys,
  };
}



function ComposeForm() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]); // Raw File objects
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isSteganography, setIsSteganography] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const audioFile = new File(
        [audioBlob],
        `voice-message-${Date.now()}.webm`,
        { type: "audio/webm" }
      );

      setAttachmentFiles(prev => [...prev, audioFile]);
      audioChunksRef.current = [];
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());

    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setStatusMessage("");

    const trimmedTo = to.trim();
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedTo || !trimmedSubject || (!trimmedBody && attachmentFiles.length === 0)) {
      alert("Message or attachment required");
      setIsSending(false);
      return;
    }


    const recipientEmails = trimmedTo.split(/[,;\s]+/).filter((e) => e.includes("@"));
    if (recipientEmails.length === 0) {
      alert("Please enter at least one valid recipient email.");
      setIsSending(false);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("You are not logged in.");
      setIsSending(false);
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (!currentUser.id) {
      alert("User data missing — please log in again.");
      setIsSending(false);
      return;
    }

    let payload = {
      subject: trimmedSubject,
      body: trimmedBody,
      body_preview: trimmedBody.substring(0, 200),
      recipients: recipientEmails.map((email) => ({
        email,
        name: email.split("@")[0],
        type: "to",
      })),
      attachments: [],
      security_type: "none",
    };

    let messageToHide = null;

    if (isEncrypting) {
      setStatusMessage("Encrypting message...");
      try {
        const encData = await encryptEmailBody(trimmedBody, recipientEmails, currentUser.id, token);
        payload.body = "";
        payload.body_preview = "🔒 Encrypted message";
        payload.encrypted_body = encData.encrypted_body;
        payload.encrypted_keys = encData.encrypted_keys;
        payload.security_type = isSteganography ? "both" : "encrypted";

        if (isSteganography) {
          messageToHide = JSON.stringify({
            is_encrypted: true,
            encrypted_body: encData.encrypted_body,
            encrypted_keys: encData.encrypted_keys,
          });
        }
      } catch (err) {
        alert(err.message);
        setIsSending(false);
        return;
      }

    } else if (isSteganography) {
      payload.body = "";
      payload.body_preview = "🖼️ Hidden in attachment";
      payload.security_type = "steganography";
      messageToHide = trimmedBody;
    }
    const processedFiles = [];

    for (const file of attachmentFiles) {
      if (isEncrypting) {
        const encrypted = await encryptFile(
          file,
          recipientEmails,
          currentUser.id,
          token
        );

        processedFiles.push(encrypted);
      } else {
        processedFiles.push({ file, meta: null });
      }
    }


    if (isSteganography && messageToHide) {
      const imageItem = processedFiles.find(
        (f) => f.file.type.startsWith("image/")
      );

      if (!imageItem) {
        alert("Steganography requires at least one image attachment.");
        setIsSending(false);
        return;
      }

      setStatusMessage("Embedding hidden message in image...");

      try {
        const stegoFile = await embedMessageInImage(
          imageItem.file,
          messageToHide
        );

        imageItem.file = stegoFile; // ✅ in-place replace

        setStatusMessage("Message hidden successfully!");
      } catch (err) {
        alert("Steganography failed: " + err.message);
        setIsSending(false);
        return;
      }
    }


    setStatusMessage("Uploading attachments...");
    const attachmentDetails = [];
    for (const item of processedFiles) {
      const formData = new FormData();
      formData.append("file", item.file);

      const res = await axios.post("http://127.0.0.1:8000/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      attachmentDetails.push({
        filename: item.file.name,
        file_url: res.data.file_url,
        file_size: item.file.size,
        file_type: item.meta?.original_type || item.file.type,
        encrypted: !!item.meta,
        iv: item.meta?.iv,
        encrypted_keys: item.meta?.encrypted_keys,
        original_type: item.meta?.original_type,
      });
    }


    payload.attachments = attachmentDetails;

    setStatusMessage("Sending email...");
    try {
      await axios.post("http://127.0.0.1:8000/emails/send", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      alert("Email sent successfully!");
      setTo("");
      setSubject("");
      setBody("");
      setAttachmentFiles([]);
      setIsEncrypting(false);
      setIsSteganography(false);
      setStatusMessage("");
    } catch (error) {
      console.error("Send error:", error);
      alert(`Failed to send: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachmentFiles((prev) => [...prev, ...files]);
    e.target.value = null;
  };

  const removeAttachment = (index) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Compose New Email</h1>
        <p className={styles.subtitle}>Create and send secure messages</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.securityFeatures}>
          <h3 className={styles.securityTitle}>Security Options</h3>
          <div className={styles.securityButtons}>
            <button
              type="button"
              className={`${styles.securityButton} ${isSteganography ? styles.active : ""}`}
              onClick={() => setIsSteganography(!isSteganography)}
            >
              <span className={styles.securityIcon}>🖼️</span>
              Steganography
              {isSteganography && <span className={styles.badge}>Active</span>}
            </button>
            <button
              type="button"
              className={`${styles.securityButton} ${isEncrypting ? styles.active : ""}`}
              onClick={() => setIsEncrypting(!isEncrypting)}
            >
              <span className={styles.securityIcon}>🔒</span>
              Encryption
              {isEncrypting && <span className={styles.badge}>Active</span>}
            </button>
          </div>
          {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}
          {isSteganography && (
            <p className={styles.stegoNote}>
              🖼️ The message will be hidden in the first image attachment.
            </p>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>To (comma-separated)</label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            className={styles.input}
            placeholder="recipient1@example.com, recipient2@example.com"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className={styles.input}
            placeholder="Email subject..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            required
            className={styles.textarea}
            placeholder="Type your message here..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Attachments ({attachmentFiles.length})</label>
          <div className={styles.attachmentSection}>
            <label htmlFor="file-upload" className={styles.uploadButton}>
              <span className={styles.uploadIcon}>📎</span>
              Add Files
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              onChange={handleFileChange}
              className={styles.fileInput}
            />

            {attachmentFiles.length > 0 && (
              <div className={styles.attachmentsList}>
                {attachmentFiles.map((file, index) => (
                  <div key={index} className={styles.attachmentItem}>
                    <span className={styles.fileIcon}>
                      {file.type.startsWith("image/") ? "🖼️" : "📄"}
                    </span>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileSize}>
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className={styles.removeButton}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.voiceSection}>
          <button
            type="button"
            className={`${styles.voiceButton} ${isRecording ? styles.recording : ""}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
          >
            🎤 {isRecording ? `Recording… ${recordingTime}s` : "Hold to Record"}
          </button>
        </div>


        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}
        >
          <span className={styles.sendIcon}>✉️</span>
          {isSending ? "Sending..." : "Send Email"}
          {isEncrypting && <span className={styles.securityBadge}>Encrypted</span>}
          {isSteganography && <span className={styles.securityBadge}>Hidden</span>}
        </button>
      </form>
    </div>
  );
}

export default ComposeForm;