"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ProfissionalRedirect() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  useEffect(() => {
    // Redireciona automaticamente para a agenda do profissional
    router.replace(`/${slug}/profissional/agenda`);
  }, [slug]);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "60vh", color: "#64748B", fontSize: "14px",
      fontFamily: "Inter, sans-serif",
    }}>
      Carregando...
    </div>
  );
}