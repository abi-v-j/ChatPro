import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "./ContactsList.module.css";

const API_BASE = "http://127.0.0.1:8000";

function ContactsList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    position: "",
    category: "work",
    notes: "",
    avatar_url: ""
  });

  const token = localStorage.getItem("token");

  // Fetch contacts
  const fetchContacts = async () => {
    if (!token) {
      setError("Please log in");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_BASE}/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category: selectedCategory === "all" ? undefined : selectedCategory }
      });
      setContacts(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [selectedCategory]);

  // Show toast
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  // Handle input
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Add or Update contact
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showToast("Name and email are required", "error");
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${API_BASE}/contacts/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showToast("Contact updated successfully!");
      } else {
        await axios.post(`${API_BASE}/contacts`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showToast("Contact added successfully!");
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData({
        name: "", email: "", phone: "", company: "", position: "",
        category: "work", notes: "", avatar_url: ""
      });
      fetchContacts();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to save contact", "error");
    }
  };

  // Edit contact
  const handleEdit = (contact) => {
    setFormData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      company: contact.company || "",
      position: contact.position || "",
      category: contact.category,
      notes: contact.notes || "",
      avatar_url: contact.avatar_url || ""
    });
    setEditingId(contact.id);
    setIsAdding(true);
  };

  // Delete contact
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this contact permanently?")) return;

    try {
      await axios.delete(`${API_BASE}/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast("Contact deleted");
      fetchContacts();
    } catch (err) {
      showToast("Delete failed", "error");
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (contact.company || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const categories = [
    { id: "all", name: "All", icon: "👥" },
    { id: "work", name: "Work", icon: "💼" },
    { id: "business", name: "Business", icon: "🤝" },
    { id: "personal", name: "Personal", icon: "👤" },
    { id: "family", name: "Family", icon: "🏡" },
    { id: "friends", name: "Friends", icon: "❤️" }
  ];

  const getCategoryColor = (cat) => {
    const colors = {
      work: "#3b82f6",
      business: "#8b5cf6",
      personal: "#10b981",
      family: "#f59e0b",
      friends: "#ec4899"
    };
    return colors[cat] || "#6b7280";
  };

  if (loading) return <div className={styles.loading}>Loading contacts...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      {/* Toast */}
      {toast.show && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>Contacts</h1>
        <p className={styles.subtitle}>Manage your network securely</p>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{contacts.length}</div>
          <div className={styles.statLabel}>Total</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{contacts.filter(c => c.is_favorite).length}</div>
          <div className={styles.statLabel}>Favorites</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{contacts.filter(c => c.category === "work").length}</div>
          <div className={styles.statLabel}>Work</div>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search name, email, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.categoryFilter}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={selectedCategory === cat.id ? styles.active : ''}
            >
              <span className={styles.categoryIcon}>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        <button className={styles.addButton} onClick={() => { setIsAdding(true); setEditingId(null); }}>
          + New Contact
        </button>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className={styles.addContactForm}>
          <h3>{editingId ? "Edit Contact" : "New Contact"}</h3>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <input name="name" placeholder="Full Name *" value={formData.name} onChange={handleChange} required />
              <input name="email" type="email" placeholder="Email *" value={formData.email} onChange={handleChange} required />
            </div>
            <div className={styles.formRow}>
              <input name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} />
              <input name="company" placeholder="Company" value={formData.company} onChange={handleChange} />
            </div>
            <div className={styles.formRow}>
              <input name="position" placeholder="Position" value={formData.position} onChange={handleChange} />
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="work">Work</option>
                <option value="business">Business</option>
                <option value="personal">Personal</option>
                <option value="family">Family</option>
                <option value="friends">Friends</option>
              </select>
            </div>
            <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} rows="2" />
            <div className={styles.formActions}>
              <button type="submit" className={styles.saveButton}>
                {editingId ? "Update" : "Save"}
              </button>
              <button type="button" className={styles.cancelButton} onClick={() => {
                setIsAdding(false); setEditingId(null); setFormData({
                  name: "", email: "", phone: "", company: "", position: "", category: "work", notes: "", avatar_url: ""
                });
              }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contacts Grid */}
      <div className={styles.contactsGrid}>
        {filteredContacts.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>👥</span>
            <h3>No contacts found</h3>
            <p>{searchTerm ? "Try different keywords" : "Add your first contact!"}</p>
          </div>
        ) : (
          filteredContacts.map(contact => (
            <div key={contact.id} className={styles.contactCard}>
              <div className={styles.contactHeader}>
                {contact.avatar_url ? (
                  <img src={contact.avatar_url} alt={contact.name} className={styles.avatarImg} />
                ) : (
                  <div className={styles.avatar} style={{ backgroundColor: getCategoryColor(contact.category) }}>
                    {contact.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </div>
                )}
                <div className={styles.contactInfo}>
                  <h3>{contact.name} {contact.is_favorite && "⭐"}</h3>
                  <p>{contact.email}</p>
                </div>
                <span className={styles.categoryBadge} style={{ backgroundColor: getCategoryColor(contact.category) }}>
                  {contact.category}
                </span>
              </div>

              <div className={styles.contactDetails}>
                {contact.phone && <div><span>📞</span> {contact.phone}</div>}
                {contact.company && <div><span>🏢</span> {contact.company}</div>}
                {contact.position && <div><span>💼</span> {contact.position}</div>}
              </div>

              <div className={styles.contactActions}>
                <button onClick={() => handleEdit(contact)} title="Edit">✏️</button>
                <button onClick={() => window.open(`mailto:${contact.email}`)} title="Email">✉️</button>
                <button onClick={() => handleDelete(contact.id)} title="Delete">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ContactsList;