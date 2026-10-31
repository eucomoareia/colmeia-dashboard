// Configuracao do painel. Os dados agora ficam no proprio repositorio, em dados/:
// o painel nao depende mais do Supabase.
window.CONFIG = {
  titulo: "Monitoramento da colmeia",
  arquivoLeituras: "dados/leituras.csv",   // t (unix, s), temp, umidade, db, audio
  arquivoEventos: "dados/eventos.json",    // aberturas da caixa e intervencoes
  pastaAudios: "dados/audios/",            // clipes WAV de 2 s
  dispositivo: "colmeia-01",
  fuso: "America/Belem",                   // horario de Maraba, UTC-3
  // Leituras com db abaixo deste valor sao tratadas como "sem sinal" do microfone.
  pisoRuidoDb: -120,
  // Janelas usadas no TCC (inicio e fim em UTC).
  janelas: {
    primeiros: { rotulo: "5 primeiros dias", ini: "2026-08-22T20:42:00Z", fim: "2026-08-28T02:59:59Z" },
    ultimos:   { rotulo: "5 últimos dias",   ini: "2026-09-06T03:00:00Z", fim: "2026-09-10T21:00:00Z" },
    ambos:     { rotulo: "5 primeiros + 5 últimos dias", partes: ["primeiros", "ultimos"] }
  }
};
