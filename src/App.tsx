import { Route, Routes } from "react-router-dom";
import Login from "@/features/login/Login";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />}></Route>
    </Routes>
  );
}

export default App;
