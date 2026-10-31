# Painel da colmeia

Site estático que mostra os dados coletados por um nó IoT dentro de uma caixa de jataí
(*Tetragonisca angustula*) em Marabá, PA, de 22/08 a 10/09/2026:

- resumo do período (temperatura, umidade, nível sonoro, número de leituras);
- gráficos das três séries, com os eventos registrados marcados por linha tracejada;
- lista dos eventos (aberturas da caixa e intervenções);
- tabela das leituras, com player para os clipes de áudio.

Sem build, sem framework, sem servidor. A coleta terminou e o Supabase foi pausado,
então os dados agora ficam no próprio repositório.

## Dados

| Arquivo | Conteúdo |
|---|---|
| `dados/leituras.csv` | uma linha por leitura: `t` (horário Unix, em segundos), `temp` (°C), `umidade` (%), `db` (dBFS) e `audio` (nome do clipe gravado naquela leitura, quando houver) |
| `dados/eventos.json` | eventos registrados: horário, tipo, se a caixa foi aberta, duração e descrição |
| `dados/audios/` | clipes WAV de 2 s, 16 kHz, gravados a cada 7 min |

São 28.032 leituras e 1.233 clipes. Os horários são mostrados no fuso de Marabá (UTC-3).

## Períodos

Os botões de período contam a partir da última leitura da coleta, não da hora atual:

- **Tudo**: a coleta inteira;
- **5 primeiros dias** e **5 últimos dias**: as duas janelas comparadas no TCC
  (22/08 17h42 a 27/08 23h59 e 06/09 0h00 a 10/09 18h00);
- **7 d finais** e **24 h finais**: o fim da coleta.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | estrutura da página |
| `styles.css` | tema claro/escuro, layout, cores |
| `app.js` | lê os arquivos de `dados/`, desenha os gráficos em SVG e monta a tabela |
| `config.js` | caminhos dos dados, fuso, janelas e ajustes |
| `pesar.html` | página antiga de pesagem manual; dependia do Supabase e não funciona mais |

## Rodando local

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Abrir o `index.html` direto do disco (`file://`) não funciona, porque o navegador
bloqueia a leitura dos arquivos de `dados/`. Use um servidor local.

## Publicando

O repositório está ligado ao GitHub Pages (branch `main`, pasta raiz). Cada push na
`main` republica o site em alguns segundos.
