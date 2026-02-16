import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./HelpTab.module.css";

const API_BASE = "http://127.0.0.1:8000";

function HelpTab() {
  const [openFaq, setOpenFaq] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [showContactForm, setShowContactForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const token = localStorage.getItem("token");

  // ✅ Load current user from backend to auto-fill contact form (name/email)
  const fetchMe = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const u = res.data || {};
      setContactForm((prev) => ({
        ...prev,
        name: prev.name || u.name || "",
        email: prev.email || u.email || "",
      }));
    } catch {
      // silent (help tab can still be used)
    }
  };

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Demo Data - Expanded FAQ categories
  const faqCategories = [
    { id: "all", name: "All Questions", icon: "❓" },
    { id: "getting-started", name: "Getting Started", icon: "🚀" },
    { id: "composing", name: "Composing Emails", icon: "✏️" },
    { id: "security", name: "Security & Privacy", icon: "🔒" },
    { id: "troubleshooting", name: "Troubleshooting", icon: "🔧" },
    { id: "account", name: "Account Management", icon: "👤" },
  ];

  const faqs = [
    {
      id: 1,
      question: "How do I compose a new email?",
      answer:
        "Click on the 'Compose' tab in the sidebar. Fill in the recipient's email address, subject line, and message body. You can attach files using the attachment button and use security features like encryption or steganography before sending.",
      category: "composing",
      popularity: 95,
    },
    {
      id: 2,
      question: "How can I change my profile picture?",
      answer:
        "Navigate to 'My Profile' from the sidebar. Click on your current profile picture and select 'Upload New Image'. Supported formats include JPG, PNG, and WebP with a maximum file size of 5MB.",
      category: "account",
      popularity: 78,
    },
    {
      id: 3,
      question: "Is there a limit to the number of attachments?",
      answer:
        "You can attach multiple files to a single email. The total size limit per email is 25MB. For larger files, consider using cloud storage services and sharing links instead.",
      category: "composing",
      popularity: 82,
    },
    {
      id: 4,
      question: "How does email encryption work?",
      answer:
        "When you enable encryption, your email content is encrypted before it leaves your device and can only be decrypted by the intended recipient using their private key.",
      category: "security",
      popularity: 91,
    },
    {
      id: 5,
      question: "What is steganography and how do I use it?",
      answer:
        "Steganography allows you to hide secret messages within other files like images. To use it, compose your email, click the steganography option, and select an image file. Your message will be embedded within the image pixels.",
      category: "security",
      popularity: 67,
    },
    {
      id: 6,
      question: "How do I recover deleted emails?",
      answer:
        "Deleted emails are moved to the Trash folder where they remain for 30 days. You can restore them from Trash. After 30 days, emails may be permanently deleted.",
      category: "troubleshooting",
      popularity: 88,
    },
    {
      id: 7,
      question: "Can I schedule emails to send later?",
      answer:
        "If scheduling is enabled in your compose flow, you can choose a date/time and send later. Otherwise, send immediately as normal.",
      category: "composing",
      popularity: 74,
    },
    {
      id: 8,
      question: "How do I set up email filters?",
      answer:
        "If your app includes filters/folders, you can create rules to automatically organize mail. Otherwise, use folders or search to manage messages.",
      category: "getting-started",
      popularity: 63,
    },
    {
      id: 9,
      question: "Is my data backed up?",
      answer:
        "Your emails and contacts are stored in the database. You can export or back up using your server/database backup strategy.",
      category: "account",
      popularity: 59,
    },
    {
      id: 10,
      question: "How do I enable two-factor authentication?",
      answer:
        "If 2FA is available in settings, enable it there. If not yet implemented, it will appear once the feature is added to backend + UI.",
      category: "security",
      popularity: 85,
    },
  ];

  // Toggle FAQ
  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Submit support ticket to backend
  const handleContactSubmit = async (e) => {
    e.preventDefault();

    setSubmitError("");
    setSubmitSuccess("");

    if (!token) {
      setSubmitError("You are not logged in.");
      return;
    }

    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setSubmitError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      await axios.post(
        `${API_BASE}/support`,
        {
          subject: contactForm.subject?.trim() || "Support Request",
          message: contactForm.message?.trim(),
          category: "general",
          priority: "normal",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSubmitSuccess("✅ Ticket submitted! Our support team will contact you soon.");
      setContactForm((prev) => ({
        ...prev,
        subject: "",
        message: "",
      }));
      setShowContactForm(false);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setContactForm((prev) => ({ ...prev, [name]: value }));
  };

  // Filter FAQs based on category and search
  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCategory = activeCategory === "all" || faq.category === activeCategory;
      const matchesSearch =
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [faqs, activeCategory, searchTerm]);

  const getPopularityColor = (popularity) => {
    if (popularity >= 80) return "#10b981";
    if (popularity >= 60) return "#f59e0b";
    return "#ef4444";
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "getting-started":
        return "#3b82f6";
      case "composing":
        return "#8b5cf6";
      case "security":
        return "#ef4444";
      case "troubleshooting":
        return "#f59e0b";
      case "account":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Help & Support</h1>
        <p className={styles.subtitle}>Find answers to common questions and get help when you need it</p>
      </div>

      {/* Quick Stats */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{faqs.length}</div>
          <div className={styles.statLabel}>Help Articles</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>24/7</div>
          <div className={styles.statLabel}>Support Available</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>98%</div>
          <div className={styles.statLabel}>Satisfaction Rate</div>
        </div>
      </div>

      {/* Search and Categories */}
      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.categoryButtons}>
          {faqCategories.map((category) => (
            <button
              key={category.id}
              className={`${styles.categoryButton} ${activeCategory === category.id ? styles.active : ""}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className={styles.categoryIcon}>{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ List */}
      <div className={styles.faqSection}>
        <h2 className={styles.sectionTitle}>
          Frequently Asked Questions
          {activeCategory !== "all" && (
            <span className={styles.resultsCount}>
              ({filteredFaqs.length} {filteredFaqs.length === 1 ? "result" : "results"})
            </span>
          )}
        </h2>

        {filteredFaqs.length > 0 ? (
          <div className={styles.faqList}>
            {filteredFaqs.map((faq, index) => (
              <div key={faq.id} className={styles.faqItem}>
                <div className={styles.faqQuestion} onClick={() => toggleFaq(index)}>
                  <div className={styles.questionContent}>
                    <span className={styles.questionText}>{faq.question}</span>
                    <div className={styles.questionMeta}>
                      <span className={styles.popularity} style={{ color: getPopularityColor(faq.popularity) }}>
                        {faq.popularity}% helpful
                      </span>
                      <span className={styles.categoryTag} style={{ backgroundColor: getCategoryColor(faq.category) }}>
                        {faqCategories.find((cat) => cat.id === faq.category)?.name}
                      </span>
                    </div>
                  </div>
                  <span className={styles.arrow}>{openFaq === index ? "▲" : "▼"}</span>
                </div>

                {openFaq === index && (
                  <div className={styles.faqAnswer}>
                    <p>{faq.answer}</p>
                    <div className={styles.answerFooter}>
                      <span className={styles.wasHelpful}>Was this helpful?</span>
                      <button className={styles.helpfulButton}>👍 Yes</button>
                      <button className={styles.notHelpfulButton}>👎 No</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.noResults}>
            <span className={styles.noResultsIcon}>🔍</span>
            <h3>No results found</h3>
            <p>Try adjusting your search terms or browse different categories</p>
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className={styles.contactSection}>
        <div className={styles.contactHeader}>
          <h2 className={styles.sectionTitle}>Still need help?</h2>
          <p>Our support team is here to assist you with any questions or issues</p>
        </div>

        {!!submitSuccess && <div className={styles.success}>{submitSuccess}</div>}
        {!!submitError && <div className={styles.error}>{submitError}</div>}

        {!showContactForm ? (
          <div className={styles.contactOptions}>
            <div className={styles.contactCard}>
              <div className={styles.contactIcon}>📧</div>
              <h3>Email Support</h3>
              <p>Send us a detailed message and we'll respond soon</p>
              <button className={styles.contactButton} onClick={() => setShowContactForm(true)}>
                Send Message
              </button>
            </div>

            <div className={styles.contactCard}>
              <div className={styles.contactIcon}>💬</div>
              <h3>Live Chat</h3>
              <p>Chat feature can be connected via Socket.IO later</p>
              <button className={styles.contactButton} onClick={() => alert("Chat not implemented yet")}>
                Start Chat
              </button>
            </div>

            <div className={styles.contactCard}>
              <div className={styles.contactIcon}>📞</div>
              <h3>Phone Support</h3>
              <p>Call support if you have a hotline set up</p>
              <button className={styles.contactButton} onClick={() => alert("Phone support not configured")}>
                Call Now
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.contactForm}>
            <h3>Contact Support</h3>
            <form onSubmit={handleContactSubmit}>
              <div className={styles.formRow}>
                <input
                  type="text"
                  name="name"
                  placeholder="Your Name *"
                  value={contactForm.name}
                  onChange={handleInputChange}
                  className={styles.input}
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Your Email *"
                  value={contactForm.email}
                  onChange={handleInputChange}
                  className={styles.input}
                  required
                  readOnly={!!token} // ✅ if logged in, keep consistent with backend user
                />
              </div>

              <input
                type="text"
                name="subject"
                placeholder="Subject"
                value={contactForm.subject}
                onChange={handleInputChange}
                className={styles.input}
              />

              <textarea
                name="message"
                placeholder="Describe your issue in detail... *"
                value={contactForm.message}
                onChange={handleInputChange}
                rows={6}
                className={styles.textarea}
                required
              />

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton} disabled={submitting}>
                  {submitting ? "Sending..." : "Send Message"}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowContactForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default HelpTab;
