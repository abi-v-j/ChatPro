import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./SentPage.module.css";

function SentPage() {
  const [sentData, setSentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch sent data
  useEffect(() => {
    const fetchSent = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in. Please login first.");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get("http://127.0.0.1:8000/emails/sent", {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        // Map API response to local format
        const mappedData = response.data.map((email) => {
          const firstRecipient = email.recipients[0] || {};
          const status = firstRecipient.status || "sent"; // Default to sent
          return {
            id: email.id,
            name: firstRecipient.name || firstRecipient.email || "Unknown Recipient",
            email: firstRecipient.email || "",
            message: `${email.subject} - ${email.body_preview || email.body.substring(0, 100)}...`,
            time: new Date(email.sent_at || email.created_at).toLocaleDateString([], { 
              month: 'short', 
              day: 'numeric' 
            }) || "Just now", // Simple relative format
            status: status.toLowerCase(),
            attachments: email.attachments.length,
            fullEmail: email, // Store full for actions
          };
        });

        setSentData(mappedData);
      } catch (err) {
        console.error("Error fetching sent emails:", err);
        setError(err.response?.data?.detail || "Failed to fetch sent emails");
      } finally {
        setLoading(false);
      }
    };

    fetchSent();
  }, []);

  // API-integrated Functions
  const handleResend = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Note: Backend doesn't have /resend yet; simulate by alerting or implement full resend logic
    const email = sentData.find(item => item.id === id);
    if (email) {
      alert(`Resending email to ${email.name} (${email.email})`);
      // TODO: In full impl, fetch full email details and POST to /emails/send
    }
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await axios.delete(`http://127.0.0.1:8000/emails/${id}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      setSentData(prevData => prevData.filter(item => item.id !== id));
    } catch (err) {
      console.error("Error deleting email:", err);
      alert("Failed to delete email");
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered': return '✓';
      case 'read': return '👁️';
      case 'failed': return '❌';
      default: return '↗️';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return '#10b981';
      case 'read': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'delivered': return 'Delivered';
      case 'read': return 'Read';
      case 'failed': return 'Failed';
      default: return 'Sent';
    }
  };

  // Render Table Function
  const renderTable = (data, showActions = false) => {
    if (loading) {
      return (
        <div className={styles.tableContainer}>
          <div className={styles.loading}>Loading sent emails...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.tableContainer}>
          <div className={styles.error}>{error}</div>
        </div>
      );
    }

    return (
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>#</th>
              <th className={styles.th}>Recipient</th>
              <th className={styles.th}>Message</th>
              <th className={styles.th}>Time</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Attachments</th>
              {showActions && <th className={styles.th}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((item, index) => (
                <tr
                  key={item.id}
                  className={styles.tr}
                >
                  <td className={styles.td}>
                    <div className={styles.serial}>{index + 1}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.recipientInfo}>
                      <div className={styles.avatar}>
                        {item.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className={styles.recipientDetails}>
                        <div className={styles.recipientName}>{item.name}</div>
                        <div className={styles.recipientEmail}>{item.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.messagePreview}>
                      {item.message}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.time}>{item.time}</div>
                  </td>
                  <td className={styles.td}>
                    <div 
                      className={styles.statusBadge}
                      style={{ color: getStatusColor(item.status) }}
                    >
                      <span className={styles.statusIcon}>{getStatusIcon(item.status)}</span>
                      {getStatusText(item.status)}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.attachments}>
                      {item.attachments > 0 ? (
                        <div className={styles.attachmentCount}>
                          <span className={styles.attachmentIcon}>📎</span>
                          {item.attachments} file{item.attachments !== 1 ? 's' : ''}
                        </div>
                      ) : (
                        <span className={styles.noAttachments}>—</span>
                      )}
                    </div>
                  </td>
                  {showActions && (
                    <td className={styles.td}>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.resendBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResend(item.id);
                          }}
                        >
                          Resend
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showActions ? 7 : 6} className={styles.td}>
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📤</span>
                    <p>No sent messages yet</p>
                    <small>Emails you send will appear here</small>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Stats Calculation
  const totalSent = sentData.length;
  const readEmails = sentData.filter(item => item.status === 'read').length;
  const totalAttachments = sentData.reduce((sum, item) => sum + item.attachments, 0);
  const readRate = totalSent > 0 ? Math.round((readEmails / totalSent) * 100) : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sent Messages</h1>
        <p className={styles.subtitle}>Emails you've sent to others</p>
        
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{totalSent}</div>
            <div className={styles.statLabel}>Total Sent</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{readEmails}</div>
            <div className={styles.statLabel}>Read</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{totalAttachments}</div>
            <div className={styles.statLabel}>Attachments</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{readRate}%</div>
            <div className={styles.statLabel}>Read Rate</div>
          </div>
        </div>
      </div>

      {renderTable(sentData, true)}
    </div>
  );
}

export default SentPage;