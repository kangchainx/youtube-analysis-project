import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import DetailPage from "./pages/DetailPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />}></Route>
      <Route path="/home" element={<HomePage />}></Route>
      <Route path="/detail/:videoId" element={<DetailPage />}></Route>
      <Route path="*" element={<Navigate to="/" replace />}></Route>
    </Routes>
  );
}

export default App;
