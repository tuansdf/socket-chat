import { useNavigate } from "@solidjs/router";
import { generateId } from "../utils/crypto.js";

export default function IndexPage() {
  const navigate = useNavigate();

  return (
    <div class="welcome-container">
      <div>
        <h1>Welcome to Socket Chat</h1>
        <button onClick={() => navigate(`/chat/${generateId()}`)}>Create a new room</button>
      </div>
    </div>
  );
}
