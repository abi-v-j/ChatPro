import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import styles from "./TrashPage.module.css";

const API_BASE = "http://127.0.0.1:8000";

function TrashPage() {
  const [trashEmails, setTrashEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

    const token = localStorage.getItem("token");

  // Fetch trash emails
  const fetchTrash = useCallback(async (reset = false) => {
    if (!token) {
      setError("Please log in to view trash.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_BASE}/emails/trash`, {
        params: { skip: reset ? 0 : skip, limit },
        headers: { Authorization: `Bearer ${token}` },
      });

      const newEmails = res.data;
      setTrashEmails(prev => reset ? newEmails : [...prev, ...newEmails]);
      setHasMore(newEmails.length === limit);
      if (reset) setSkip(0);
      else setSkip(prev => prev + limit);
    } catch (err) {
      console.error("Failed to load trash:", err);
      setError(err.response?.data?.detail || "Failed to load trash. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token, skip, limit]);

  useEffect(() => {
    fetchTrash(true);
  }, [fetchTrash]);

  // Restore email
 const handleRestore = async (emailId) => {
  if (!confirm("Restore this email?")) return;
  try {
    await axios.patch(`http://127.0.0.1:8000/emails/${emailId}/restore`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTrashEmails(prev => prev.filter(e => e.id !== emailId));
  } catch (err) {
    alert("Restore failed: " + err.response?.data?.detail);
  }
};
  // Permanent delete
  const handleDeletePermanently = async (emailId) => {
    if (!window.confirm("Permanently delete this email? This cannot be undone.")) return;

    try {
      await axios.delete(`${API_BASE}/emails/${emailId}/permanent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrashEmails(prev => prev.filter(e => e.id !== emailId));
      alert("Email deleted permanently.");
    } catch (err) {
      alert("Failed to delete: " + (err.response?.data?.detail || err.message));
    }
  };

  // Empty trash
  const handleEmptyTrash = async () => {
    if (trashEmails.length === 0) {
      alert("Trash is already empty!");
      return;
    }

    if (!window.confirm(`Permanently delete all ${trashEmails.length} items?`)) return;

    try {
      await axios.delete(`${API_BASE}/emails/trash/empty`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrashEmails([]);
      alert("Trash emptied successfully.");
    } catch (err) {
      alert("Failed to empty trash: " + (err.response?.data?.detail || err.message));
    }
  };

  // Restore all (bonus feature)
  const handleRestoreAll = async () => {
    if (!window.confirm(`Restore all ${trashEmails.length} emails?`)) return;

    try {
      for (const email of trashEmails) {
        await axios.patch(`${API_BASE}/emails/${email.id}/restore`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setTrashEmails([]);
      alert("All emails restored!");
    } catch (err) {
      alert("Some emails failed to restore.");
    }
  };

  // Helper functions
  const getDaysLeft = (email) => {
    const deletedAt = new Date(email.updated_at || email.created_at);
    const daysSince = Math.floor((Date.now() - deletedAt) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysSince);
  };

  const getDaysLeftColor = (days) => {
    if (days <= 3) return '#ef4444';
    if (days <= 7) return '#f59e0b';
    if (days <= 14) return '#3b82f6';
    return '#10b981';
  };

  const getDaysLeftText = (days) => {
    if (days === 0) return 'Deleted today';
    if (days === 1) return 'Final day';
    if (days <= 3) return 'Almost gone';
    if (days <= 7) return 'This week';
    return 'Safe';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSenderName = (email) => {
    if (email.sender_id) {
      const recipient = email.recipients.find(r => r.email !== localStorage.getItem("user_email"));
      return recipient ? recipient.name || recipient.email.split("@")[0] : "You";
    }
    return email.recipients[0]?.name || email.recipients[0]?.email.split("@")[0] || "Unknown";
  };

  const totalSize = trashEmails.reduce((sum, e) => {
    return sum + (e.attachments?.reduce((s, a) => s + a.file_size, 0) || 0);
  }, 0);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const urgentCount = trashEmails.filter(e => getDaysLeft(e) <= 3).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.trashIcon}>🗑️</span>
          <h1 className={styles.title}>Trash</h1>
        </div>
        <p className={styles.subtitle}>
          Emails stay in trash for 30 days before permanent deletion
        </p>

        {urgentCount > 0 && (
          <div className={styles.warning}>
            <span className={styles.warningIcon}>⚠️</span>
            <span>{urgentCount} item{urgentCount > 1 ? 's' : ''} will be deleted soon!</span>
          </div>
        )}

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{trashEmails.length}</div>
            <div className={styles.statLabel}>Items</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{urgentCount}</div>
            <div className={styles.statLabel}>Urgent</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{formatSize(totalSize)}</div>
            <div className={styles.statLabel}>Size</div>
          </div>
        </div>

        {trashEmails.length > 0 && (
          <div className={styles.bulkActions}>
            <button className={styles.bulkRestoreBtn} onClick={handleRestoreAll}>
              <span className={styles.bulkIcon}>↶</span> Restore All
            </button>
            <button className={styles.bulkDeleteBtn} onClick={handleEmptyTrash}>
              <span className={styles.bulkIcon}>🗑️</span> Empty Trash
            </button>
          </div>
        )}
      </div>

      {loading && !trashEmails.length && (
        <div className={styles.loading}>Loading trash...</div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sender</th>
              <th>Subject</th>
              <th>Preview</th>
              <th>Deleted</th>
              <th>Days Left</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trashEmails.length === 0 && !loading ? (
              <tr>
                <td colSpan="7" className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🗑️</span>
                  <p>Trash is empty</p>
                  <small>Deleted emails appear here for 30 days</small>
                </td>
              </tr>
            ) : (
              trashEmails.map((email) => {
                const daysLeft = getDaysLeft(email);
                const attachmentSize = email.attachments?.reduce((s, a) => s + a.file_size, 0) || 0;

                return (
                  <tr key={email.id} className={daysLeft <= 3 ? styles.urgent : ''}>
                    <td>
                      <div className={styles.sender}>
                        <div className={styles.avatar}>
                          {getSenderName(email).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.senderName}>{getSenderName(email)}</div>
                          <div className={styles.senderEmail}>
                            {email.sender_id ? "Me" : email.recipients[0]?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.subject}>{email.subject || "(no subject)"}</td>
                    <td className={styles.preview}>{email.body_preview || email.body?.substring(0, 60) + "..."}</td>
                    <td>{formatDate(email.updated_at)}</td>
                    <td>
                      <div className={styles.daysLeftBadge} style={{ color: getDaysLeftColor(daysLeft) }}>
                        <strong>{daysLeft}</strong> <small>{getDaysLeftText(daysLeft)}</small>
                      </div>
                    </td>
                    <td>{formatSize(attachmentSize + (email.body?.length || 0))}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.restoreBtn}
                          onClick={() => handleRestore(email.id)}
                          title="Restore"
                        >
                          ↶
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeletePermanently(email.id)}
                          title="Delete forever"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {hasMore && !loading && (
          <div className={styles.loadMore}>
            <button onClick={() => fetchTrash()}>Load More</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrashPage;