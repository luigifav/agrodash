"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function NormalizarTalhoesButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ type: "idle" });

  async function handleClick() {
    setStatus({ type: "loading" });

    try {
      const res = await fetch("/api/normalize-talhoes", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", message: json.error ?? "Erro desconhecido" });
        return;
      }

      const normalizado: number = json.normalizado ?? 0;
      const message =
        normalizado === 0
          ? "Nenhum talhão duplicado encontrado."
          : `${normalizado} talhão${normalizado !== 1 ? "es" : ""} consolidado${normalizado !== 1 ? "s" : ""}. Recarregando...`;

      setStatus({ type: "success", message });

      if (normalizado > 0) {
        setTimeout(() => {
          router.refresh();
          setStatus({ type: "idle" });
        }, 1500);
      }
    } catch {
      setStatus({ type: "error", message: "Falha na conexão com o servidor." });
    }
  }

  const loading = status.type === "loading";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analisando talhões...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Normalizar nomes com IA
          </>
        )}
      </button>

      {status.type === "success" && (
        <p className="text-sm text-green-700">{status.message}</p>
      )}
      {status.type === "error" && (
        <p className="text-sm text-red-600">{status.message}</p>
      )}
    </div>
  );
}
