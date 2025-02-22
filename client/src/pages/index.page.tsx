import { useNavigate } from "@solidjs/router";
import { generateId } from "../utils/crypto.util.ts";

export default function IndexPage() {
  const navigate = useNavigate();

  return (
    <div class="h-100 d-flex justify-content-center align-items-center text-center">
      <div>
        <h1 class="fs-3">Welcome to Socket Chat</h1>
        <button class="btn btn-primary w-100 mt-3" onClick={() => navigate(`/chat/${generateId()}`)}>
          Create a new room
        </button>
      </div>
    </div>
  );
}
