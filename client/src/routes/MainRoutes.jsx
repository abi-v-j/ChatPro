import React from "react";
import { Route, Routes } from "react-router-dom";
import AdminRoutes from "./AdminRoutes";
import UserLayout from "../user/App";
import GuestLayout from "../guest/guestLayout/GuestLayout";
import ProtectedRoute from "./ProtectedRoute";

const MainRoutes = () => {
  return (
    <Routes>
      <Route path="*" element={<GuestLayout />} />

      <Route path="admin/*" element={<AdminRoutes />} />

      {/* ✅ Protected User */}
      <Route element={<ProtectedRoute redirectTo="/" />}>
        <Route path="user/*" element={<UserLayout />} />
      </Route>
    </Routes>
  );
};

export default MainRoutes;
