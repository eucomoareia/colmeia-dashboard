# Painel da colmeia

Site estatico que le a telemetria da colmeia direto do Supabase, no navegador, e mostra:

- estado atual (temperatura, umidade, nivel sonoro, contagem de leituras);
- graficos de linha das tres series, com cursor e tooltip;
- tabela das leituras recentes, com player para os clipes de audio do bucket.

Sem build, sem framework, sem servidor: sao quatro arquivos estaticos.

## Como funciona

O navegador chama a API REST do Supabase (PostgREST) com a chave publica do projeto:

```
GET {SUPABASE_URL}/rest/v1/leituras?select=...&order=criado_em.desc&limit=5000
     apikey: {chave publica}
```

Isso so funciona porque a tabela `leituras` tem uma policy de RLS de leitura
publica (`SELECT` liberado para o papel `anon`). A chave publishable/anon nao da
acesso a nada alem do que as policies permitirem. **Nunca coloque a
`service_role` key neste repositorio** - ela ignora RLS e ficaria visivel para
qualquer visitante.

Os audios vem do bucket publico `audio-colmeia`, montando a URL:

```
{SUPABASE_URL}/storage/v1/object/public/audio-colmeia/{audio_nome}
```

Leituras com `db <= -120` sao tratadas como "microfone sem sinal": ficam de fora
dos graficos e das estatisticas, e aparecem como *sem sinal* na tabela.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | estrutura da pagina |
| `styles.css` | tema claro/escuro, layout, tokens de cor |
| `app.js` | busca os dados, desenha os graficos em SVG e monta a tabela |
| `config.js` | URL do projeto, chave publica e ajustes (periodo, refresh, piso de ruido) |

## Ajustes rapidos

Tudo que costuma mudar esta em `config.js`:

- `titulo` - nome que aparece no topo e na aba;
- `segundosRefresh` - de quanto em quanto tempo recarrega (0 desliga);
- `minutosParaOffline` - a partir de quando o dispositivo aparece como offline;
- `pisoRuidoDb` - abaixo disso, a leitura de ruido conta como sem sinal;
- `limiteLinhas` - teto de linhas por consulta.

## Rodando local

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Abrir o `index.html` por `file://` nao funciona por causa de CORS: use um
servidor local.

## Publicando

O repositorio ja esta ligado ao GitHub Pages (branch `main`, pasta raiz).
Cada push na `main` republica o site em alguns segundos.

Se o painel abrir e mostrar erro de conexao, confira em
**Supabase → Project Settings → API → CORS** se o dominio do Pages esta liberado.

## Esquema esperado

```sql
create table public.leituras (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  dispositivo text not null default 'colmeia-01',
  temp        real,
  umidade     real,
  db          real,
  audio_nome  text
);
```
