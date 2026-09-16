import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import TreePage from "@/pages/TreePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ContributePage from "@/pages/ContributePage";
import AdminPage from "@/pages/AdminPage";
import { Toaster } from "sonner";
import "@/App.css";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Header />
          <Routes>
            <Route path="/" element={<TreePage />} />
            <Route path="/tree/:personId" element={<TreePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/contribute" element={<ContributePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#fffdf8",
                color: "#1c2024",
                border: "1px solid #e2dacd",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
