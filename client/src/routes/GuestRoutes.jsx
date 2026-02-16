import { Route, Routes } from "react-router-dom";
import Register from "../guest/pages/register/Register.jsx";
import Login from "../guest/pages/login/Login.jsx";
import ForgetPassword from "../guest/pages/forgetPassword/ForgetPassword.jsx";
import ResetPassword from "../guest/pages/ResetPassword/ResetPassword.jsx";

const GuestRoutes = () => {
  return (
    <Routes>
      <Route path="register" element={<Register />} />
            <Route path="forget-password" element={<ForgetPassword />} />

      <Route path="" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

    </Routes>
  );
};

export default GuestRoutes;
