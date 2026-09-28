"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "로그인에 실패했습니다.");
        return;
      }
      // Only same-site paths are accepted as the return target.
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <div className="brand">
        <span className="brand-mark" aria-hidden>C</span>
        <div>
          <p className="brand-name">Contoso Electronics</p>
          <p className="gu-muted">디바이스 컨시어지 · 운영형 Generative UI 데모</p>
        </div>
      </div>
      <label htmlFor="password">데모 접속 비밀번호</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "login-error" : undefined}
      />
      {error && (
        <p id="login-error" className="gu-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !password}>
        {busy ? "확인 중…" : "입장하기"}
      </button>
      <p className="gu-muted login-note">공유받은 비밀번호로 접속합니다. 가상 브랜드와 예시 데이터만 사용합니다.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
