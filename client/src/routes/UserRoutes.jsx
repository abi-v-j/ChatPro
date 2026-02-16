import React from 'react'
import { Route, Routes } from 'react-router-dom'
import UserLayout from '../user/App'
import ComposeForm from '../user/components/composeForm/ComposeForm'
import InboxPage from '../user/pages/inboxPage/InboxPage'
import StarredPage from '../user/pages/starredPage/StarredPage'
import SentPage from '../user/pages/sendPage/SentPage'
import TrashPage from '../user/pages/trashPage/TrashPage'
import SettingsTab from '../user/components/settingsTab/SettingsTab'
import HelpTab from '../user/components/helpTab/HelpTab'
import AnalyticsTab from '../user/components/analyticsTab/AnalyticsTab'
import ContactsList from '../user/components/contactList/ContactsList'
import ProfileTab from '../user/components/profileTab/ProfileTab'


const UserRoutes = () => (
  <Routes>
      <Route path="compose" element={<ComposeForm />} />
      <Route path="inbox" element={<InboxPage />} />
      <Route path="starred" element={<StarredPage />} />
      <Route path="sent" element={<SentPage />} />
      <Route path="trash" element={<TrashPage />} />
      <Route path="contacts" element={<ContactsList />} />
      <Route path="settings" element={<SettingsTab />} />
      <Route path="help" element={<HelpTab />} />
      <Route path="analytics" element={<AnalyticsTab />} />
      <Route path="profile" element={<ProfileTab />} />
  </Routes>
)

export default UserRoutes
