"use client";

// Componente de seleção visual de tema dark/light
// Renderiza dois círculos coloridos lado a lado; o círculo ativo tem borda azul e anel externo

interface SeletorTemaProps {
  temaAtual: "dark" | "light";
  onMudar: (tema: "dark" | "light") => void;
}

export default function SeletorTema({ temaAtual, onMudar }: SeletorTemaProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {/* Círculo dark */}
      <button
        onClick={() => onMudar("dark")}
        title="Tema escuro"
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#080C14",
          border: temaAtual === "dark"
            ? "2px solid #2D7EF8"
            : "2px solid rgba(255,255,255,0.3)",
          boxShadow: temaAtual === "dark"
            ? "0 0 0 2px rgba(45,126,248,0.4)"
            : "none",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      />

      {/* Círculo light */}
      <button
        onClick={() => onMudar("light")}
        title="Tema claro"
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#F0F4FF",
          border: temaAtual === "light"
            ? "2px solid #2D7EF8"
            : "2px solid rgba(0,0,0,0.2)",
          boxShadow: temaAtual === "light"
            ? "0 0 0 2px rgba(45,126,248,0.4)"
            : "none",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      />
    </div>
  );
}
