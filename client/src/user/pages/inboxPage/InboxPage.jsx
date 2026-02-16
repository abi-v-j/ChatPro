import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./InboxPage.module.css";


export function formatEmailTime(iso) {
  if (!iso) return "";
  const safeIso =
    typeof iso === "string" && !iso.endsWith("Z") && !iso.includes("+")
      ? iso + "Z"
      : iso;

  const d = new Date(safeIso);

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}



// Base64 helper
const b64ToUint8Array = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function decryptEncryptedAudio(att, currentUser) {
  const privB64 = localStorage.getItem("privateKey");
  if (!privB64) throw new Error("Missing private key");

  const keyEntry = att.encrypted_keys?.find((k) => k.user_id === currentUser.id);
  if (!keyEntry) throw new Error("No key for this user");

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    b64ToUint8Array(privB64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  const aesRaw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    b64ToUint8Array(keyEntry.encrypted_sym_key)
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const res = await fetch(`http://127.0.0.1:8000/${att.file_url}`);
  if (!res.ok) throw new Error("Failed to download encrypted audio");

  const buf = await res.arrayBuffer();

  const iv = b64ToUint8Array(att.iv);
  const cipher = new Uint8Array(buf).slice(iv.length);

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    cipher
  );

  return URL.createObjectURL(new Blob([plain], { type: att.original_type || att.file_type }));
}

// ✅ NEW: decrypt encrypted image
async function decryptEncryptedImage(att, currentUser) {
  const privB64 = localStorage.getItem("privateKey");
  if (!privB64) throw new Error("Missing private key");

  const keyEntry = att.encrypted_keys?.find((k) => k.user_id === currentUser.id);
  if (!keyEntry) throw new Error("No key for this user");

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    b64ToUint8Array(privB64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  const aesRaw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    b64ToUint8Array(keyEntry.encrypted_sym_key)
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const res = await fetch(`http://127.0.0.1:8000/${att.file_url}`);
  if (!res.ok) throw new Error("Failed to download encrypted image");

  const buf = await res.arrayBuffer();

  const iv = b64ToUint8Array(att.iv);
  const cipher = new Uint8Array(buf).slice(iv.length);

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    cipher
  );

  return URL.createObjectURL(new Blob([plain], { type: att.original_type || att.file_type }));
}

// Decrypt encrypted email body (client-side)
async function decryptEmailBody(encrypted_body, encrypted_keys, currentUserId) {
  const privB64 = localStorage.getItem("privateKey");
  if (!privB64) {
    throw new Error("Private key missing — please log in again to restore keys.");
  }

  const ownKeyObj = encrypted_keys?.find((k) => k.user_id === currentUserId);
  if (!ownKeyObj) {
    throw new Error("This message was not encrypted for you.");
  }

  const encSymB64 = ownKeyObj.encrypted_sym_key;

  const privArray = b64ToUint8Array(privB64);
  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    privArray,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  const encSymArray = b64ToUint8Array(encSymB64);
  const symRaw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, encSymArray);

  const symKey = await crypto.subtle.importKey(
    "raw",
    symRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const fullCipherArray = b64ToUint8Array(encrypted_body);
  const iv = fullCipherArray.slice(0, 12);
  const ciphertext = fullCipherArray.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    symKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

async function extractMessageFromImage(imageUrl) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageUrl + "?t=" + Date.now();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Failed to load image"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let binaryMessage = "";
  for (let i = 0; i < data.length; i += 4) {
    const bit = data[i] & 1;
    binaryMessage += bit;

    if (binaryMessage.length > 5000000) {
      throw new Error("No valid hidden message found (too large)");
    }
  }

  if (binaryMessage.length < 32) {
    throw new Error("No hidden message found in image");
  }

  const lengthBits = binaryMessage.slice(0, 32);
  const msgLength = parseInt(lengthBits, 2);

  const totalBitsNeeded = 32 + msgLength * 8;
  if (binaryMessage.length < totalBitsNeeded) {
    throw new Error("Hidden message incomplete or corrupted");
  }

  const msgBits = binaryMessage.slice(32, totalBitsNeeded);
  const bytes = [];
  for (let j = 0; j < msgBits.length; j += 8) {
    const byteStr = msgBits.substr(j, 8);
    bytes.push(parseInt(byteStr, 2));
  }

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}

function InboxPage() {
  const [inboxData, setInboxData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [displayBody, setDisplayBody] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchInbox = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get("http://127.0.0.1:8000/emails/inbox", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const mappedData = response.data.map((email) => {
        const ts = email.sent_at || email.created_at;

        let messagePreview = "No preview";
        if (email.security_type?.includes("steganography")) {
          messagePreview = "🖼️ Hidden in attachment";
        } else if (email.is_encrypted) {
          messagePreview = "🔒 Encrypted message";
        } else if (email.body_preview) {
          messagePreview = email.body_preview;
        } else if (email.body) {
          messagePreview =
            email.body.substring(0, 100) + (email.body.length > 100 ? "..." : "");
        }

        return {
          id: email.id,
          name: email.sender_name || "Unknown Sender",
          email: email.sender_email || "unknown@example.com",
          message: messagePreview,

          // ✅ consistent everywhere
          ts,
          time: ts ? formatEmailTime(ts) : "Just now",

          isStarred: email.is_starred || false,
          unread: !email.is_read,
          priority: email.priority || "normal",
          fullEmail: email,
        };
      });



      setInboxData(mappedData);
    } catch (err) {
      console.error("Error fetching inbox:", err);
      setError(err.response?.data?.detail || "Failed to fetch inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const refreshInbox = () => {
    setLoading(true);
    setError(null);
    fetchInbox();
  };

  const handleStar = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await axios.post(
        `http://127.0.0.1:8000/emails/${id}/star`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setInboxData((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isStarred: !item.isStarred } : item))
      );
    } catch (err) {
      alert("Failed to update star status");
    }
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (!window.confirm("Move this email to trash?")) return;

    try {
      await axios.delete(`http://127.0.0.1:8000/emails/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setInboxData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert("Failed to move to trash");
    }
  };

  const markAsRead = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await axios.post(
        `http://127.0.0.1:8000/emails/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setInboxData((prev) => prev.map((item) => (item.id === id ? { ...item, unread: false } : item)));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const openEmail = async (item) => {
    setSelectedEmail(item.fullEmail);
    setDisplayBody("");
    setProcessError("");
    setProcessing(true);
    markAsRead(item.id);

    let finalBody = "";

    try {
      if (item.fullEmail.security_type?.includes("steganography")) {
        const imageAtts = item.fullEmail.attachments?.filter((a) => a.file_type?.startsWith("image/"));
        if (imageAtts?.length > 0) {
          const imageUrl = `http://127.0.0.1:8000/${imageAtts[0].file_url}`;
          const hiddenData = await extractMessageFromImage(imageUrl);

          try {
            const parsed = JSON.parse(hiddenData);
            if (parsed.is_encrypted && currentUser.id) {
              finalBody = await decryptEmailBody(parsed.encrypted_body, parsed.encrypted_keys, currentUser.id);
            } else {
              finalBody = hiddenData;
            }
          } catch {
            finalBody = hiddenData;
          }
        } else {
          throw new Error("No image attachment found for hidden message");
        }
      } else if (item.fullEmail.is_encrypted && currentUser.id) {
        finalBody = await decryptEmailBody(item.fullEmail.encrypted_body, item.fullEmail.encrypted_keys, currentUser.id);
      } else {
        finalBody = item.fullEmail.body || "No message body";
      }
    } catch (err) {
      console.error("Processing error:", err);
      setProcessError(err.message || "Failed to process message");
    } finally {
      setDisplayBody(finalBody || "No content available");
      setProcessing(false);
    }
  };

  const closeModal = () => {
    setSelectedEmail(null);
    setDisplayBody("");
    setProcessError("");
    setProcessing(false);
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "#dc2626";
      case "high":
        return "#ef4444";
      case "normal":
        return "#3b82f6";
      case "low":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "Urgent";
      case "high":
        return "High";
      case "normal":
        return "Normal";
      case "low":
        return "Low";
      default:
        return "Normal";
    }
  };

  const totalEmails = inboxData.length;
  const unreadEmails = inboxData.filter((i) => i.unread).length;
  const starredEmails = inboxData.filter((i) => i.isStarred).length;
  const formatTime = (iso) => new Date(iso).toLocaleString();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Inbox</h1>
        <p className={styles.subtitle}>Manage your incoming messages</p>

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{totalEmails}</div>
            <div className={styles.statLabel}>Total</div>
          </div>
          <div className={styles.statItem}>
            <div
              className={styles.statNumber}
              style={{ color: unreadEmails > 0 ? "#ef4444" : "#10b981" }}
            >
              {unreadEmails}
            </div>
            <div className={styles.statLabel}>Unread</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{starredEmails}</div>
            <div className={styles.statLabel}>Starred</div>
          </div>
        </div>

        <button onClick={refreshInbox} className={styles.refreshBtn} disabled={loading}>
          ↻ {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading && <div className={styles.loading}>Loading emails...</div>}
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={refreshInbox} className={styles.refreshBtn}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && inboxData.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📭</span>
          <p>No emails in inbox</p>
          <small>All caught up!</small>
        </div>
      )}

      {!loading && !error && inboxData.length > 0 && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>#</th>
                <th className={styles.th}>Sender</th>
                <th className={styles.th}>Message</th>
                <th className={styles.th}>Time</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inboxData.map((item, index) => (
                <tr
                  key={item.id}
                  className={`${styles.tr} ${item.unread ? styles.unread : ""}`}
                  onClick={() => openEmail(item)}
                >
                  <td className={styles.td}>
                    <div className={styles.serial}>{index + 1}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.senderInfo}>
                      <div className={styles.avatar}>
                        {item.name
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0]?.toUpperCase() || "?")
                          .join("")}
                      </div>
                      <div className={styles.senderDetails}>
                        <div className={styles.senderName}>{item.name}</div>
                        <div className={styles.senderEmail}>{item.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.messagePreview}>{item.message}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.time}>{item.time}</div>
                  </td>

                  <td className={styles.td}>
                    <div className={styles.actionButtons}>
                      <button
                        className={`${styles.starBtn} ${item.isStarred ? styles.starred : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStar(item.id);
                        }}
                      >
                        {item.isStarred ? "★" : "☆"}
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedEmail && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={closeModal}>
              ×
            </button>

            <div className={styles.emailHeader}>
              <h2 className={styles.emailSubject}>{selectedEmail.subject || "(No subject)"}</h2>
              <div className={styles.emailMeta}>
                <div className={styles.senderInfo}>
                  <div className={styles.avatarLarge}>
                    {selectedEmail.sender_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0]?.toUpperCase() || "?")
                      .join("")}
                  </div>
                  <div>
                    <div className={styles.senderNameLarge}>{selectedEmail.sender_name}</div>
                    <div className={styles.senderEmailLarge}>{selectedEmail.sender_email}</div>
                  </div>
                </div>
                <div className={styles.emailDate}>
                  {selectedEmail.created_at ? new Date(selectedEmail.created_at).toLocaleString() : "Unknown"}
                </div>
              </div>
              {selectedEmail.security_type?.includes("steganography") && (
                <div className={styles.encryptedBadge}>🖼️ Hidden Message</div>
              )}
              {selectedEmail.is_encrypted && !selectedEmail.security_type?.includes("steganography") && (
                <div className={styles.encryptedBadge}>🔒 Encrypted</div>
              )}
              {selectedEmail.security_type === "both" && (
                <div className={styles.encryptedBadge}>🔒🖼️ Encrypted + Hidden</div>
              )}
            </div>

            <div className={styles.emailBody}>
              {processing && <p>Processing message (extracting/decrypting)...</p>}
              {processError && <p className={styles.error}>⚠️ {processError}</p>}
              {!processing && !processError && <pre className={styles.bodyText}>{displayBody}</pre>}
            </div>

            {selectedEmail.attachments?.length > 0 && (
              <div className={styles.attachmentsSection}>
                <h3>Attachments ({selectedEmail.attachments.length})</h3>
                <div className={styles.attachmentList}>
                  {selectedEmail.attachments.map((att, i) => {
                    const fileUrl = `http://127.0.0.1:8000/${att.file_url}`;

                    // 🎤 AUDIO
                    if (att.file_type?.startsWith("audio/")) {
                      return <EncryptedAudio key={i} attachment={att} currentUser={currentUser} />;
                    }

                    // 🖼️ IMAGE (✅ NOW SUPPORTS ENCRYPTED IMAGE)
                    if (att.file_type?.startsWith("image/")) {
                      return <EncryptedImage key={i} attachment={att} currentUser={currentUser} />;
                    }

                    // 📎 OTHER FILES
                    return (
                      <a
                        key={i}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.attachmentItem}
                      >
                        📎 {att.filename}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxPage;

function EncryptedAudio({ attachment, currentUser }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    let tempUrl = null;

    async function load() {
      try {
        if (!attachment.encrypted) {
          tempUrl = `http://127.0.0.1:8000/${attachment.file_url}`;
        } else {
          tempUrl = await decryptEncryptedAudio(attachment, currentUser);
        }
        if (mounted) setAudioUrl(tempUrl);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to decrypt audio");
      }
    }

    load();

    return () => {
      mounted = false;
      if (tempUrl?.startsWith("blob:")) URL.revokeObjectURL(tempUrl);
    };
  }, [attachment, currentUser]);

  if (error) return <p>⚠️ {error}</p>;
  if (!audioUrl) return <p>Decrypting audio…</p>;

  return (
    <div className={styles.audioAttachment}>
      <div className={styles.audioLabel}>🎤 Voice Message</div>
      <audio controls src={audioUrl} />
    </div>
  );
}

function EncryptedImage({ attachment, currentUser }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    let tempUrl = null;

    async function load() {
      try {
        if (!attachment.encrypted) {
          tempUrl = `http://127.0.0.1:8000/${attachment.file_url}`;
        } else {
          tempUrl = await decryptEncryptedImage(attachment, currentUser);
        }
        if (mounted) setImgUrl(tempUrl);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to decrypt image");
      }
    }

    load();

    return () => {
      mounted = false;
      if (tempUrl?.startsWith("blob:")) URL.revokeObjectURL(tempUrl);
    };
  }, [attachment, currentUser]);

  if (error) return <p>⚠️ {error}</p>;
  if (!imgUrl) return <p>Decrypting image…</p>;

  return (
    <a
      href={imgUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.attachmentItem}
    >
      🖼️ {attachment.filename}
    </a>
  );
}
