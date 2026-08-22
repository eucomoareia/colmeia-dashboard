// Configuracao do painel. A chave abaixo e publica (publishable/anon):
// ela so consegue ler a tabela porque existe uma policy de RLS de leitura publica.
// Nunca coloque aqui a service_role key.
window.CONFIG = {
  supabaseUrl: "https://mownkkgvqixlodofanyd.supabase.co",
  supabaseKey: "sb_publishable_uFec9t4nYoTWeAHOTt_NxA_PbaBxsfj",
  // Chave anon legada, usada automaticamente caso a publishable seja rejeitada.
  supabaseKeyFallback: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd25ra2d2cWl4bG9kb2ZhbnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NzI5MTQsImV4cCI6MjA5ODE0ODkxNH0.5t_OFnVfXxH0tUAOI0kwhjckKohMZz6usvTGp0MS8vc",
  table: "leituras",
  bucket: "audio-colmeia",
  titulo: "Monitoramento da colmeia",
  // Leituras com db abaixo deste valor sao tratadas como "sem sinal" do microfone.
  pisoRuidoDb: -120,
  // Depois de quantos minutos sem leitura o dispositivo aparece como offline.
  minutosParaOffline: 10,
  // Intervalo do refresh automatico, em segundos (0 desliga).
  segundosRefresh: 30,
  // Teto de linhas buscadas por consulta.
  limiteLinhas: 5000
};
