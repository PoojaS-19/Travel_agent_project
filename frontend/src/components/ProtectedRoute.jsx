import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    // Redirect to login, replacing history entry for security
    return <Navigate to="/login" replace />;
  }

  return children;
}
